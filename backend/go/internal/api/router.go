package api

import (
	"net/http"
	"strings"
	"time"

	"tayari-backend/internal/ai"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/billing"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"golang.org/x/time/rate"
)

type contextKey string

const (
	contextKeyUser   = auth.ContextKeyUser
	contextKeyTenant contextKey = "tenant"
)

type Server struct {
	Router            *chi.Mux
	Auth              auth.AuthService
	Config            *config.Config
	DB                *database.DB
	AI                *ai.Client
	Billing           *billing.BillingService
	startTime         time.Time
	publicRateLimiter *rateLimiter
	authRateLimiter   *rateLimiter
	loginRateLimiter  *rateLimiter
}

func NewServer(authService auth.AuthService, cfg *config.Config, db *database.DB) *Server {
	s := &Server{
		Router:            chi.NewRouter(),
		Auth:              authService,
		Config:            cfg,
		DB:                db,
		AI:                ai.NewClient(cfg.PythonAIURL),
		Billing:           billing.NewBillingService(),
		startTime:         time.Now(),
		publicRateLimiter: newRateLimiter(rate.Limit(10.0), 100, false),
		authRateLimiter:   newRateLimiter(rate.Limit(50.0), 200, true),
		loginRateLimiter:  newRateLimiter(rate.Limit(10.0), 100, false),
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	s.Router.Use(middleware.Recoverer)
	s.Router.Use(s.requestLoggingMiddleware)
	s.Router.Use(s.tenantMiddleware)

	defaultOrigins := []string{
		"http://localhost:8080", "http://localhost:8083", "http://localhost:8085", "http://localhost:5173",
		"http://127.0.0.1:8080", "http://127.0.0.1:8083", "http://127.0.0.1:8085", "http://127.0.0.1:5173",
	}

	if s.Config != nil {
		for _, o := range s.Config.AllowedOrigins {
			o = strings.TrimSpace(o)
			if o != "" && o != "*" {
				defaultOrigins = append(defaultOrigins, o)
			}
		}
		for _, o := range s.Config.CORSAllowedOrigins {
			o = strings.TrimSpace(o)
			if o != "" && o != "*" {
				defaultOrigins = append(defaultOrigins, o)
			}
		}
	}

	allowedOriginSet := make(map[string]struct{}, len(defaultOrigins))
	for _, o := range defaultOrigins {
		allowedOriginSet[o] = struct{}{}
	}

	s.Router.Use(cors.Handler(cors.Options{
		AllowedOrigins: defaultOrigins,
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			_, ok := allowedOriginSet[origin]
			return ok
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Tenant-Domain"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Register Domain Routes
	s.registerCoreRoutes(s.Router)
	s.RegisterOneStopRoutes(s.Router)
	s.RegisterBillingRoutes(s.Router, s.Billing)
}
