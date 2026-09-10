package api

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"tayari-backend/internal/ai"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/billing"
	"tayari-backend/internal/capabilities"
	"tayari-backend/internal/clientip"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
	"tayari-backend/internal/observability"
	"tayari-backend/internal/repository"

	"github.com/getsentry/sentry-go"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"golang.org/x/time/rate"
)

type contextKey string

const (
	contextKeyUser               = auth.ContextKeyUser
	contextKeyTenant  contextKey = "tenant"
	contextKeyTraceID contextKey = "trace_id"
	// contextKeyRequestIdentity carries a *requestIdentityBox — see
	// requestLoggingMiddleware for why this indirection exists.
	contextKeyRequestIdentity contextKey = "request_identity_box"
)

// requestIdentityBox is a mutable box requestLoggingMiddleware installs into
// the request context before calling downstream handlers. authMiddleware
// (which runs *inside* the logging middleware in the chain) writes the
// resolved user/tenant into this same shared pointer. Because
// r.WithContext() always returns a new *http.Request, authMiddleware's own
// context enrichment is invisible to requestLoggingMiddleware's outer `r` —
// it captured that before calling next.ServeHTTP and never sees the derived
// request object. A shared mutable pointer sidesteps that: both middlewares
// hold the same *requestIdentityBox regardless of which request object they
// each see, so a write from the inner middleware is visible to the outer one
// after next.ServeHTTP returns.
type requestIdentityBox struct {
	userID   string
	tenantID string
}

type Server struct {
	Router            *chi.Mux
	Auth              auth.AuthService
	Config            *config.Config
	DB                *database.DB
	Repos             *repository.Repositories
	AI                *ai.Client
	Billing           *billing.BillingService
	startTime         time.Time
	publicRateLimiter *rateLimiter
	authRateLimiter   *rateLimiter
	loginRateLimiter  *rateLimiter
	voiceRateLimiter  *rateLimiter
	aiPerUserLimiter  *perUserAILimiter
	metrics           *observability.Metrics
	capabilities      *capabilities.Registry
	allowedOriginSet  map[string]struct{}
}

func NewServer(authService auth.AuthService, cfg *config.Config, db *database.DB) *Server {
	allowedOriginSet := make(map[string]struct{})
	if cfg != nil {
		for _, o := range cfg.AllowedOrigins {
			o = strings.TrimSpace(o)
			if o != "" && o != "*" {
				allowedOriginSet[o] = struct{}{}
			}
		}
	}

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
		// ponytail: per-user AI limiter is additive — the shared
		// auth/public/login/voice limiters above are untouched.
		aiPerUserLimiter: newPerUserAILimiter(),
		metrics:          observability.NewMetrics(),

		capabilities:     capabilities.NewFromEnv(),
		allowedOriginSet: allowedOriginSet,
	}
	resolver, err := clientip.NewResolver(cfg.TrustedProxyCIDRs)
	if err != nil {
		panic(err)
	}
	s.publicRateLimiter.ipResolver = resolver
	s.authRateLimiter.ipResolver = resolver
	s.loginRateLimiter.ipResolver = resolver
	s.voiceRateLimiter.ipResolver = resolver
	if db != nil && db.Conn != nil {
		s.Repos = repository.NewPostgresRepositories(db.Conn)
	}
	s.routes()
	return s

}

func (s *Server) routes() {
	s.Router.Use(s.recoverWithSentry)
	// 300s, not 240s: this must be >= every synchronous per-route budget
	// underneath it, or this outer deadline force-cuts the request before
	// the route's own (deliberately longer) timeout gets to fire. Verified
	// live: handleBrowserAutomation (routes_browser.go) sets its own 5min
	// (300s) context via browserRunTimeout for a single blocking automation
	// run, and Python's browser_agent_routes.py BROWSER_RUN_TIMEOUT_SECONDS
	// defaults to 300s to match — but this global middleware was still
	// 240s, so it silently killed any automation run past 240s regardless
	// of the 300s budget both layers below it were coded for. 300s is now
	// the floor for every layer in the chain: this middleware, nginx's
	// proxy_read_timeout/proxy_send_timeout on /api/ (nginx.conf,
	// infra/routing/nginx.conf), the python-lb nginx upstream
	// (deploy/nginx/python-upstream.conf), the Go AI client's
	// http.Client.Timeout (internal/ai/client.go, also raised to 300s —
	// it's an absolute cap that applies on top of any per-call context
	// deadline), and Python's own per-route timeout
	// (browser_agent_routes.py). The SSE stream route
	// (/api/v1/browser/automation/stream) is coded for a 20min
	// (browserStreamTimeout) budget, which this 300s floor would silently
	// truncate. It is no longer routed through s.Router at all — it is
	// mounted as a sibling router in Handler() (router.go) with its own,
	// longer Timeout, specifically so a global number here can never
	// re-cap it by accident. See streamRouter() in routes_browser.go.
	s.Router.Use(middleware.Timeout(300 * time.Second))
	s.Router.Use(s.csrfCheck)
	s.Router.Use(s.requestLoggingMiddleware)
	s.Router.Use(s.tenantMiddleware)

	s.Router.Use(cors.Handler(s.corsOptions()))

	// Register Domain Routes
	s.Router.Get("/metrics", s.handleMetrics)
	s.Router.Get("/metrics/prometheus", s.handlePrometheusMetrics)
	s.registerCoreRoutes(s.Router)
	s.RegisterOneStopRoutes(s.Router)
	s.routesOmniSave(s.Router)
	s.RegisterBillingRoutes(s.Router, s.Billing)
	s.RegisterWaitlistRoutes(s.Router)
	s.RegisterSSERoutes(s.Router)
	s.RegisterMemoryRoutes(s.Router) // conversations + preferences + feedback (was dead)
	s.RegisterProvenanceRoutes(s.Router)
	s.RegisterComputerRoutes(s.Router)
	s.routesMVP(s.Router)    // all 24 previously unregistered MVP handlers
	s.routesSocial(s.Router) // connections, shared Qs, outcome funnel (Phase 4.2)
	s.routesJobWatches(s.Router)
	s.routesCareerOps(s.Router)
	s.routesCareerIntelligence(s.Router)
	s.routesReviewQueue(s.Router)
	s.routesExtensionExtra(s.Router)
	s.routesAgents(s.Router)
	s.routesAgentRuns(s.Router)
	s.routesTasks(s.Router)
	s.routesAutomations(s.Router)
	s.routesNotifications(s.Router)
	s.routesAnalytics(s.Router)
	s.routesTenant(s.Router)
	s.routesPush(s.Router)
	s.RegisterSkillGapRoutes(s.Router)  // POST /skill-gaps (was dead — defined since 4998855, never wired)
	s.routesApplicationsExtra(s.Router) // notes/interview-questions/parse-email/voice/stage (was dead)
	s.RegisterChainRoutes(s.Router)     // GET /chain/{userId}, Dashboard pipeline strip (was dead)
	s.routesCoverLetters(s.Router)
	s.routesRoadmapInterviewSessions(s.Router)
	s.routesHarness(s.Router)
}

func (s *Server) recoverWithSentry(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rvr := recover(); rvr != nil {
				if rvr != http.ErrAbortHandler {
					sentry.CaptureException(fmt.Errorf("panic: %v", rvr))
					sentry.Flush(2 * time.Second)
					slog.Error("recovered from panic", "error", rvr)
					http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
				}
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (s *Server) csrfCheck(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
			origin := r.Header.Get("Origin")
			if origin != "" && len(s.allowedOriginSet) > 0 {
				if _, ok := s.allowedOriginSet[origin]; !ok {
					slog.Warn("CSRF check blocked request with invalid origin", "origin", origin, "path", r.URL.Path)
					http.Error(w, "CSRF: origin not allowed", http.StatusForbidden)
					return
				}
			}
		}
		next.ServeHTTP(w, r)
	})
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

func (s *Server) routesHarness(r chi.Router) {
	r.Route("/api/v1/harness", func(r chi.Router) {
		r.Use(s.requireAuth)
		r.Post("/run", s.handleOneStopProxy("/api/v1/harness/run"))
		r.Get("/schemas", s.handleOneStopProxyGET("/api/v1/harness/schemas"))
	})
	r.Route("/api/harness", func(r chi.Router) {
		r.Use(s.requireAuth)
		r.Post("/run", s.handleOneStopProxy("/api/v1/harness/run"))
		r.Get("/schemas", s.handleOneStopProxyGET("/api/v1/harness/schemas"))
	})
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return s.authMiddleware(next)
}

func (s *Server) proxyToPython(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		s.handleOneStopProxyGET(r.URL.Path)(w, r)
	} else {
		s.handleOneStopProxy(r.URL.Path)(w, r)
	}
}

// corsOptions builds the shared CORS policy. Extracted so the SSE stream
// router (which cannot reuse s.Router's middleware chain — see Handler())
// can apply the identical origin policy without duplicating it by hand.
func (s *Server) corsOptions() cors.Options {
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

	corsOriginSet := make(map[string]struct{}, len(defaultOrigins))
	for _, o := range defaultOrigins {
		corsOriginSet[o] = struct{}{}
	}

	return cors.Options{
		AllowedOrigins: defaultOrigins,
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			_, ok := corsOriginSet[origin]
			return ok
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Tenant-Domain"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}
}

// Handler returns the HTTP handler wrapped with OpenTelemetry tracing.
//
// The browser-automation SSE stream route is mounted as a SIBLING of
// s.Router, not nested inside it: s.Router.Use(middleware.Timeout(300s))
// applies to every route reachable through s.Router's own ServeHTTP,
// including ones registered many r.Group()s deep (chi.Group clones the
// middleware chain accumulated so far — it can add to it, it cannot strip
// an already-applied middleware.Timeout off the parent). The only way to
// give the SSE route a materially longer budget is to keep it off that
// chain entirely and give it its own, with the same auth/CORS/logging
// middleware applied explicitly. See streamRouter() in routes_browser.go.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	streamHandler := s.streamRouter()
	mux.Handle("/api/v1/browser/automation/stream", streamHandler)
	mux.Handle("/api/browser/automation/stream", streamHandler)
	mux.Handle("/", s.Router)
	return otelhttp.NewHandler(mux, "tayari-gateway")
}

