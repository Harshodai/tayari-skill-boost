package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"tayari-backend/internal/concurrency"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
)

type LocalAuth struct {
	DB     *database.DB
	Config *config.Config
	Worker *concurrency.AuditWorker
}

func NewLocalAuth(db *database.DB, cfg *config.Config, worker *concurrency.AuditWorker) *LocalAuth {
	return &LocalAuth{DB: db, Config: cfg, Worker: worker}
}

func (a *LocalAuth) Register(ctx context.Context, email, password string) (*models.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		ID:    uuid.New(),
		Email: email,
		Role:  "user",
	}

	// Use transaction for atomic user + profile creation
	tx, err := a.DB.Conn.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert into auth.users emulation table
	query := `INSERT INTO auth.users (id, email, encrypted_password, role, created_at, updated_at) 
              VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, created_at`

	err = tx.QueryRowContext(ctx, query, user.ID, user.Email, string(hash), user.Role).Scan(&user.ID, &user.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Create profile within same transaction
	_, err = tx.ExecContext(ctx, "INSERT INTO public.profiles (id, email) VALUES ($1, $2)", user.ID, user.Email)
	if err != nil {
		return nil, fmt.Errorf("failed to create profile: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return user, nil
}

// hashIP creates a SHA256 hash of the IP address for privacy
func hashIP(ip string) string {
	if ip == "" {
		return "unknown"
	}
	hash := sha256.Sum256([]byte(ip))
	return hex.EncodeToString(hash[:16]) // Use first 16 bytes
}

func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
	}
	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	// Fall back to RemoteAddr
	return r.RemoteAddr
}

func (a *LocalAuth) Login(ctx context.Context, email, password string) (string, error) {
	return a.LoginWithRequest(ctx, email, password, nil)
}

func (a *LocalAuth) LoginWithRequest(ctx context.Context, email, password string, r *http.Request) (string, error) {
	// Determine IP hash
	ipHash := "unknown"
	if r != nil {
		ipHash = hashIP(getClientIP(r))
	}

	// Helper to send audit log asynchronously using Go routines
	logAttempt := func(success bool) {
		if a.Worker != nil {
			select {
			case a.Worker.JobQueue <- concurrency.AuditLogJob{
				Email:     email,
				Action:    "LOGIN_ATTEMPT",
				Success:   success,
				Timestamp: time.Now(),
				IPHash:    ipHash,
			}:
			default:
				// Channel full, drop log to avoid blocking login
			}
		}
	}

	var user models.User
	query := `SELECT id, email, encrypted_password, role FROM auth.users WHERE email = $1`
	err := a.DB.Conn.QueryRowContext(ctx, query, email).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Role)
	if err == sql.ErrNoRows {
		logAttempt(false)
		return "", ErrUnauthorized
	} else if err != nil {
		return "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		logAttempt(false)
		return "", ErrUnauthorized
	}

	logAttempt(true)
	return a.generateToken(&user)
}

func (a *LocalAuth) VerifyToken(tokenString string) (*models.User, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(a.Config.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	userIDStr, ok := claims["sub"].(string)
	if !ok {
		return nil, ErrInvalidToken
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, ErrInvalidToken
	}

	return &models.User{ID: userID}, nil
}

func (a *LocalAuth) generateToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":  user.ID.String(),
		"role": user.Role,
		"exp":  time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
		"iss":  "tayari-backend",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(a.Config.JWTSecret))
}
