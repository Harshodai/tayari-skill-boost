package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"
)

// Context key type to avoid collisions
type contextKey string

const contextKeyUser contextKey = "user"

type Server struct {
	Router *chi.Mux
	Auth   auth.AuthService
}

func NewServer(authService auth.AuthService) *Server {
	s := &Server{
		Router: chi.NewRouter(),
		Auth:   authService,
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	s.Router.Use(middleware.Logger)
	s.Router.Use(middleware.Recoverer)
	s.Router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:4173"},
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
		r = r.WithContext(context.WithValue(r.Context(), "provider", provider))
		s.Auth.SocialLogin(w, r)
	})

	s.Router.Get("/api/auth/{provider}/callback", func(w http.ResponseWriter, r *http.Request) {
		provider := chi.URLParam(r, "provider")
		r = r.WithContext(context.WithValue(r.Context(), "provider", provider))
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

	user, err := s.Auth.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		log.Printf("handleRegister: registration failed for %s: %v", req.Email, err)
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
