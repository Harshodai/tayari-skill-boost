package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"net/mail"
	"strings"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/config"
	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// Context key type to avoid collisions
type contextKey string

const contextKeyUser contextKey = "user"

type Server struct {
	Router *chi.Mux
	Auth   auth.AuthService
	Config *config.Config
}

func NewServer(authService auth.AuthService, cfg *config.Config) *Server {
	s := &Server{
		Router: chi.NewRouter(),
		Auth:   authService,
		Config: cfg,
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	s.Router.Use(middleware.Logger)
	s.Router.Use(middleware.Recoverer)

	allowedOrigins := []string{"http://localhost:5173", "http://localhost:4173"}
	if s.Config != nil && len(s.Config.AllowedOrigins) > 0 {
		allowedOrigins = s.Config.AllowedOrigins
	}

	s.Router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	s.Router.Get("/api/health", s.handleHealth)

	// Auth Routes
	s.Router.Post("/api/auth/register", s.handleRegister)
	s.Router.Post("/api/auth/login", s.handleLogin)

	// Social Auth Routes
	// Inject provider param into context for Goth
	s.Router.Get("/api/auth/{provider}", func(w http.ResponseWriter, r *http.Request) {
		provider := chi.URLParam(r, "provider")

		// Gothic expects provider in query params
		q := r.URL.Query()
		q.Add("provider", provider)
		r.URL.RawQuery = q.Encode()

		r = r.WithContext(context.WithValue(r.Context(), contextKey("provider"), provider))
		s.Auth.SocialLogin(w, r)
	})

	s.Router.Get("/api/auth/{provider}/callback", func(w http.ResponseWriter, r *http.Request) {
		provider := chi.URLParam(r, "provider")

		// Gothic expects provider in query params
		q := r.URL.Query()
		q.Add("provider", provider)
		r.URL.RawQuery = q.Encode()

		r = r.WithContext(context.WithValue(r.Context(), contextKey("provider"), provider))
		s.Auth.SocialCallback(w, r)
	})

	// Protected Routes
	s.Router.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/api/me", s.handleMe)
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status": "ok", "service": "go-backend"}`))
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("handleRegister: failed to decode request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Trim email only (passwords should be used as-is)
	req.Email = strings.TrimSpace(req.Email)

	// Validate email is non-empty and valid format
	if req.Email == "" {
		log.Printf("handleRegister: validation failed - empty email")
		http.Error(w, "Email is required", http.StatusBadRequest)
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		log.Printf("handleRegister: validation failed - invalid email format")
		http.Error(w, "Invalid email format", http.StatusBadRequest)
		return
	}

	// Validate password constraints
	if req.Password == "" {
		log.Printf("handleRegister: validation failed - empty password")
		http.Error(w, "Password is required", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		log.Printf("handleRegister: validation failed - password too short")
		http.Error(w, "Password must be at least 8 characters", http.StatusBadRequest)
		return
	}

	user, err := s.Auth.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		// Hash email for privacy in error log
		hash := sha256.Sum256([]byte(req.Email))
		emailHash := hex.EncodeToString(hash[:16])
		log.Printf("handleRegister: registration failed for hash:%s: %v", emailHash, err)
		http.Error(w, "Registration failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("handleLogin: failed to decode request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	token, err := s.Auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	// User is set in context by middleware
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		http.Error(w, "User not found in context", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// Parse Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
			return
		}
		tokenStr := parts[1]
		if tokenStr == "" {
			http.Error(w, "Token is required", http.StatusUnauthorized)
			return
		}

		user, err := s.Auth.VerifyToken(tokenStr)
		if err != nil {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		// Store user in context for downstream handlers
		ctx := context.WithValue(r.Context(), contextKeyUser, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
