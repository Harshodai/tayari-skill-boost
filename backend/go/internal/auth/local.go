package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"time"
	"unicode/utf8"

	"tayari-backend/internal/clientip"
	"tayari-backend/internal/concurrency"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type LocalAuth struct {
	DB         *database.DB
	Config     *config.Config
	Worker     *concurrency.AuditWorker
	IPResolver *clientip.Resolver
}

func NewLocalAuth(db *database.DB, cfg *config.Config, worker *concurrency.AuditWorker) *LocalAuth {
	resolver, _ := clientip.NewResolver(configValue(cfg, "trusted-proxy-cidrs"))
	return &LocalAuth{DB: db, Config: cfg, Worker: worker, IPResolver: resolver}
}

// ValidatePassword enforces 12-72 characters (rune count) and bcrypt's 72-byte limit.
func ValidatePassword(password string) error {
	runes := utf8.RuneCountInString(password)
	if runes < 12 || runes > 72 {
		return fmt.Errorf("password must be 12-72 characters")
	}
	if len(password) > 72 {
		return fmt.Errorf("password exceeds maximum length of 72 bytes")
	}
	return nil
}

func (a *LocalAuth) Register(ctx context.Context, email, password string) (*models.User, error) {
	if !validateEmail(email) {
		return nil, fmt.Errorf("invalid email")
	}
	// ponytail: bcrypt errors on >72 bytes; 12 is the min policy requirement.
	if err := ValidatePassword(password); err != nil {
		return nil, err
	}
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

func configValue(cfg *config.Config, key string) string {
	if cfg == nil {
		return ""
	}
	if key == "trusted-proxy-cidrs" {
		return cfg.TrustedProxyCIDRs
	}
	return ""
}

func (a *LocalAuth) getClientIP(r *http.Request) string {
	if a.IPResolver != nil {
		return a.IPResolver.Resolve(r)
	}
	resolver, _ := clientip.NewResolver("")
	return resolver.Resolve(r)
}

func (a *LocalAuth) Login(ctx context.Context, email, password string) (string, error) {
	return a.LoginWithRequest(ctx, email, password, nil)
}

func (a *LocalAuth) LoginWithRequest(ctx context.Context, email, password string, r *http.Request) (string, error) {
	if !validateEmail(email) {
		return "", ErrUnauthorized
	}
	// Determine IP hash
	ipHash := "unknown"
	if r != nil {
		ipHash = hashIP(a.getClientIP(r))
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
				// Channel full, log warning to avoid losing security-critical audit events
				log.Printf("WARNING: Audit queue full, dropping event: Action=LOGIN_ATTEMPT Success=%v IPHash=%s", success, ipHash)
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

func (a *LocalAuth) VerifyIdentity(tokenString string) (*Identity, error) {
	user, err := a.VerifyToken(tokenString)
	if err != nil || user == nil {
		return nil, ErrInvalidToken
	}
	return &Identity{UserID: user.ID, Email: user.Email, Roles: []string{user.Role}, Method: AuthMethodUserJWT, User: user}, nil
}

func (a *LocalAuth) VerifyToken(tokenString string) (*models.User, error) {
	// ponytail: HMAC method check denies 'none' alg; WithExpirationRequired + WithIssuer enforce claims in the parser (root-cause single guard for all callers).
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(a.Config.JWTSecret), nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired(), jwt.WithIssuer("tayari-backend"))

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

	role, ok := claims["role"].(string)
	if !ok {
		// Fallback for older tokens or missing role (issuer already validated by parser)
		log.Println("Token missing role claim, defaulting to 'user'")
		role = "user"
	}

	email, _ := claims["email"].(string)
	return &models.User{ID: userID, Email: email, Role: role}, nil
}

func (a *LocalAuth) generateToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":   user.ID.String(),
		"aud":   "authenticated",
		"email": user.Email,
		"role":  user.Role,
		"exp":   time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
		"iss":   "tayari-backend",
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(a.Config.JWTSecret))
}
