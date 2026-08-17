package api

import (
	"net/http"
	"strings"
	"time"

	"tayari-backend/internal/ai"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/billing"
	"tayari-backend/internal/capabilities"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
	"tayari-backend/internal/observability"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"golang.org/x/time/rate"
)

type contextKey string

const (
	contextKeyUser              = auth.ContextKeyUser
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
	voiceRateLimiter  *rateLimiter
	metrics           *observability.Metrics
	capabilities      *capabilities.Registry
}

func NewServer(authService auth.AuthService, cfg *config.Config, db *database.DB) *Server {
	s := &Server{
		Router:            chi.NewRouter(),
		Auth:              authService,
		Config:            cfg,
		DB:                db,
		AI:                ai.NewClientWithToken(cfg.PythonAIURL, cfg.AIInternalToken),
		Billing:           billing.NewBillingService(db),
		startTime:         time.Now(),
		publicRateLimiter: newRateLimiter(rate.Limit(10.0), 100, false),
		authRateLimiter:   newRateLimiter(rate.Limit(50.0), 200, true),
		loginRateLimiter:  newRateLimiter(rate.Limit(10.0), 100, false),
		// Voice streams are expensive and long-lived: allow at most two initial
		// connections per user, refilling at one connection every five seconds.
		voiceRateLimiter: newRateLimiter(rate.Limit(0.2), 2, true),
		metrics:          observability.NewMetrics(),
		capabilities:     capabilities.NewFromEnv(),
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
	s.Router.Get("/metrics", s.handleMetrics)
	s.registerCoreRoutes(s.Router)
	s.RegisterOneStopRoutes(s.Router)
	s.routesOmniSave(s.Router)
	s.RegisterBillingRoutes(s.Router, s.Billing)
	s.RegisterWaitlistRoutes(s.Router)
	s.RegisterSSERoutes(s.Router)
	s.RegisterMemoryRoutes(s.Router) // conversations + preferences + feedback (was dead)
	s.RegisterProvenanceRoutes(s.Router)
	s.routesMVP(s.Router)    // all 24 previously unregistered MVP handlers
	s.routesSocial(s.Router) // connections, shared Qs, outcome funnel (Phase 4.2)
	s.routesJobWatches(s.Router)
	s.routesCareerOps(s.Router)
	s.routesCareerIntelligence(s.Router)
	s.routesReviewQueue(s.Router)
	s.routesExtensionExtra(s.Router)
	s.routesAgents(s.Router)
	s.routesTasks(s.Router)
	s.routesAnalytics(s.Router)
	s.routesTenant(s.Router)
	s.routesPush(s.Router)

}

// requireFeature checks billing entitlement for the given feature name.
// Returns false and writes a 402 response if the user's plan doesn't cover it.
// When BILLING_ENABLED=false (self-hosted), always returns true.
func (s *Server) requireCapability(w http.ResponseWriter, capability capabilities.Name) bool {
	if s.capabilities == nil || !s.capabilities.Enabled(capability) {
		s.respondJSON(w, http.StatusLocked, map[string]string{
			"code":       "disabled_by_launch_scope",
			"capability": string(capability),
			"message":    "This capability is not enabled for the current deployment scope.",
		})
		return false
	}
	return true
}

func (s *Server) requireFeature(w http.ResponseWriter, r *http.Request, feature string) bool {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return false
	}
	allowed, reason := s.Billing.CanUseFeature(user.ID.String(), feature)
	if !allowed {
		s.respondJSON(w, http.StatusPaymentRequired, map[string]string{
			"error":   reason,
			"upgrade": "/pricing",
		})
		return false
	}
	return true
}
