package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"time"

	"tayari-backend/internal/ai"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"golang.org/x/time/rate"
)

// Context key type to avoid collisions
type contextKey string

const (
	contextKeyUser   contextKey = "user"
	contextKeyTenant contextKey = "tenant"
)

type Server struct {
	Router            *chi.Mux
	Auth              auth.AuthService
	Config            *config.Config
	DB                *database.DB
	AI                *ai.Client
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
		startTime:         time.Now(),
		publicRateLimiter: newRateLimiter(rate.Limit(1.6), 10, false),
		authRateLimiter:   newRateLimiter(rate.Limit(16.0), 50, true),
		loginRateLimiter:  newRateLimiter(rate.Limit(0.1), 5, false),
	}
	// Start periodic cleanup of rate limiter entries
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			s.publicRateLimiter.cleanup()
			s.authRateLimiter.cleanup()
			s.loginRateLimiter.cleanup()
		}
	}()
	s.routes()
	return s
}

func (s *Server) routes() {
	s.Router.Use(middleware.Recoverer)
	s.Router.Use(s.requestLoggingMiddleware)
	s.Router.Use(s.tenantMiddleware)

	/*
		allowedOrigins := []string{"http://localhost:5173",
		"http://127.0.0.1:5173", "http://localhost:4173"}
		if s.Config != nil && len(s.Config.AllowedOrigins) > 0 {
			allowedOrigins = s.Config.AllowedOrigins
		}
	*/

	// CORS — explicit allowlist. Never use "*" with AllowCredentials=true:
	// go-chi/cors echoes the request Origin in that case, which effectively
	// lets any site make credentialed cross-origin requests.
	// Use config-driven origins with sensible defaults
	defaultOrigins := []string{
		"http://localhost:8080",
		"http://localhost:8083",
		"http://localhost:8085",
		"http://localhost:5173",
		"http://127.0.0.1:8080",
		"http://127.0.0.1:8083",
		"http://127.0.0.1:8085",
		"http://127.0.0.1:5173",
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
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Tenant-Domain", "X-User-ID", "X-User-Email"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public Routes (IP-based rate limit: 100 RPM)
	s.Router.Group(func(r chi.Router) {
		r.Use(s.publicRateLimiter.Middleware)
		r.Get("/api/health", s.handleHealth)
		r.Get("/api/v1/health", s.handleHealth)
		r.Get("/api/health/detailed", s.handleHealthDetailed)
		r.Get("/api/v1/health/detailed", s.handleHealthDetailed)
		// Auth endpoints get an extra strict per-IP brute-force limiter
		// (10 requests / minute) layered on top of the public limiter.
		// Returns HTTP 429 with Retry-After when exceeded.
		r.With(s.loginRateLimiter.Middleware).Post("/api/auth/register", s.handleRegister)
		r.With(s.loginRateLimiter.Middleware).Post("/api/v1/auth/register", s.handleRegister)
		r.With(s.loginRateLimiter.Middleware).Post("/api/auth/login", s.handleLogin)
		r.With(s.loginRateLimiter.Middleware).Post("/api/v1/auth/login", s.handleLogin)

		// Public tenant branding (must be outside auth group so OPTIONS preflight passes)
		r.Get("/api/v1/tenants/branding", s.handleGetTenantBranding)
		r.Get("/api/tenants/branding", s.handleGetTenantBranding)

		// Password Reset (public)
		s.routesPasswordReset(r)

		// Social Auth Routes
		r.Get("/api/auth/{provider}", func(w http.ResponseWriter, r *http.Request) {
			provider := chi.URLParam(r, "provider")
			q := r.URL.Query()
			q.Add("provider", provider)
			r.URL.RawQuery = q.Encode()
			r = r.WithContext(context.WithValue(r.Context(), contextKey("provider"), provider))
			s.Auth.SocialLogin(w, r)
		})
		r.Get("/api/v1/auth/{provider}", func(w http.ResponseWriter, r *http.Request) {
			provider := chi.URLParam(r, "provider")
			q := r.URL.Query()
			q.Add("provider", provider)
			r.URL.RawQuery = q.Encode()
			r = r.WithContext(context.WithValue(r.Context(), contextKey("provider"), provider))
			s.Auth.SocialLogin(w, r)
		})
		r.Get("/api/auth/{provider}/callback", func(w http.ResponseWriter, r *http.Request) {
			provider := chi.URLParam(r, "provider")
			q := r.URL.Query()
			q.Add("provider", provider)
			r.URL.RawQuery = q.Encode()
			r = r.WithContext(context.WithValue(r.Context(), contextKey("provider"), provider))
			s.Auth.SocialCallback(w, r)
		})
		r.Get("/api/v1/auth/{provider}/callback", func(w http.ResponseWriter, r *http.Request) {
			provider := chi.URLParam(r, "provider")
			q := r.URL.Query()
			q.Add("provider", provider)
			r.URL.RawQuery = q.Encode()
			r = r.WithContext(context.WithValue(r.Context(), contextKey("provider"), provider))
			s.Auth.SocialCallback(w, r)
		})

		// Public API endpoints (API key auth)
		s.routesPublic(r)
		s.routesGmail(r)
	})

	// Protected Routes (user-based rate limit: 1000 RPM)
	s.Router.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Use(s.authRateLimiter.Middleware)
		r.Get("/api/auth/me", s.handleMe)
		r.Get("/api/v1/auth/me", s.handleMe)
		r.Get("/api/me", s.handleMe)
		r.Get("/api/v1/me", s.handleMe)

		// Profile (alias for archive compatibility)
		r.Get("/api/profile", s.handleGetProfile)
		r.Put("/api/profile", s.handleUpdateProfile)
		r.Get("/api/v1/profile", s.handleGetProfile)
		r.Put("/api/v1/profile", s.handleUpdateProfile)

		// Resume upload (multipart, archive compatible)
		r.Post("/api/resumes", s.handleCreateResume)
		r.Post("/api/resumes/upload", s.handleUploadResumeMultipart)
		r.Post("/api/v1/resumes/upload", s.handleUploadResumeMultipart)
		r.Get("/api/resumes", s.handleListResumes)
		r.Post("/api/resumes/analyze-text", s.handleAnalyzeText)
		r.Get("/api/resumes/{id}", s.handleGetResume)
		r.Post("/api/resumes/{id}/optimize", s.handleOptimizeResume)
		r.Post("/api/resumes/{id}/analyze", s.handleAnalyzeResume)
		r.Post("/api/resumes/{id}/export", s.handleExportResume)
		r.Get("/api/resumes/{id}/docx", s.handleDownloadResumeDocx)
		r.Get("/api/resume-versions/{id}/docx", s.handleDownloadVersionDocx)
		// Also keep v1 routes
		r.Post("/api/v1/resumes", s.handleCreateResume)
		r.Get("/api/v1/resumes", s.handleListResumes)
		r.Post("/api/v1/resumes/analyze-text", s.handleAnalyzeText)
		r.Get("/api/v1/resumes/{id}", s.handleGetResume)
		r.Put("/api/v1/resumes/{id}", s.handleUpdateResume)
		r.Delete("/api/v1/resumes/{id}", s.handleDeleteResume)
		r.Post("/api/v1/resumes/{id}/optimize", s.handleOptimizeResume)
		r.Post("/api/v1/resumes/{id}/analyze", s.handleAnalyzeResume)
		r.Post("/api/v1/resumes/{id}/ats-deep", s.handleDeepATS)
		r.Post("/api/v1/resumes/{id}/export", s.handleExportResume)
		r.Get("/api/v1/resumes/{id}/docx", s.handleDownloadResumeDocx)
		r.Get("/api/v1/resume-versions/{id}/docx", s.handleDownloadVersionDocx)

		r.Post("/api/optimize/stream", s.handleOptimizeResumeStream)
		r.Post("/api/v1/optimize/stream", s.handleOptimizeResumeStream)

		// Cover Letter
		r.Post("/api/cover-letter/generate", s.handleCoverLetterGenerate)
		r.Post("/api/v1/cover-letter/generate", s.handleCoverLetterGenerate)

		// Communication Suite
		r.Post("/api/communication/generate", s.handleCommunicationGenerate)
		r.Post("/api/v1/communication/generate", s.handleCommunicationGenerate)
		r.Get("/api/communication/suggestions", s.handleCommunicationSuggestions)
		r.Get("/api/v1/communication/suggestions", s.handleCommunicationSuggestions)
		// Audit #6 — response-rate tracking (persist on generate above; mark +
		// aggregate here). Parity: both /api and /api/v1 aliases.
		r.Patch("/api/communications/{commId}/response", s.handleCommunicationResponse)
		r.Patch("/api/v1/communications/{commId}/response", s.handleCommunicationResponse)
		r.Get("/api/communication/stats", s.handleCommunicationStats)
		r.Get("/api/v1/communication/stats", s.handleCommunicationStats)

		// Interview AI
		r.Post("/api/interview/prep", s.handleInterviewPrep)
		r.Post("/api/v1/interview/prep", s.handleInterviewPrep)
		r.Post("/api/interview/copilot", s.handleInterviewCopilot)
		r.Post("/api/v1/interview/copilot", s.handleInterviewCopilot)

		// Candidate Answer Bank & ATS Detect
		r.Post("/api/candidate-bank/match", s.handleCandidateBankMatch)
		r.Post("/api/v1/candidate-bank/match", s.handleCandidateBankMatch)
		r.Post("/api/ats/detect", s.handleATSDetect)
		r.Post("/api/v1/ats/detect", s.handleATSDetect)

		// Truth Check Guardrail
		r.Post("/api/guardrails/truth-check", s.handleTruthCheck)
		r.Post("/api/v1/guardrails/truth-check", s.handleTruthCheck)

		// Recruiter Lookup & Offer Calculator
		r.Post("/api/recruiter/lookup", s.handleRecruiterLookup)
		r.Post("/api/v1/recruiter/lookup", s.handleRecruiterLookup)
		r.Post("/api/offer/calculate", s.handleOfferCalculate)
		r.Post("/api/v1/offer/calculate", s.handleOfferCalculate)

		// Resume Knowledge Graph
		r.Post("/api/v1/resumes/{id}/knowledge-graph", s.handleResumeKnowledgeGraph)

		// Profile Import
		r.Post("/api/profile/import-pdf", s.handleImportProfilePDF)
		r.Post("/api/v1/profile/import-pdf", s.handleImportProfilePDF)


		// Job Description Routes
		r.Post("/api/v1/job-descriptions", s.handleCreateJD)
		r.Get("/api/v1/job-descriptions", s.handleListJDs)
		r.Get("/api/v1/job-descriptions/{id}", s.handleGetJD)
		r.Put("/api/v1/job-descriptions/{id}", s.handleUpdateJD)
		r.Delete("/api/v1/job-descriptions/{id}", s.handleDeleteJD)

		// Job Search
		r.Get("/api/jobs/search", s.handleJobSearchGET)
		r.Get("/api/v1/jobs/search", s.handleJobSearchGET)
		r.Post("/api/jobs/search", s.handleJobSearch)
		r.Post("/api/jobs/agent-search", s.handleAgentSearch)
		r.Post("/api/jobs/save", s.handleSaveJob)
		r.Get("/api/jobs/saved", s.handleListSavedJobs)
		r.Delete("/api/jobs/saved/{id}", s.handleDeleteSavedJob)
		// Also keep v1 routes
		r.Post("/api/v1/jobs/search", s.handleJobSearch)
		r.Post("/api/v1/jobs/agent-search", s.handleAgentSearch)
		r.Post("/api/v1/jobs/save", s.handleSaveJob)
		r.Get("/api/v1/jobs/saved", s.handleListSavedJobs)
		r.Delete("/api/v1/jobs/saved/{id}", s.handleDeleteSavedJob)

		// Autopilot (archive compatible)
		r.Post("/api/autopilot/start", s.handleAutopilotStart)
		r.Get("/api/autopilot/runs", s.handleListAutopilotRuns)
		r.Get("/api/autopilot/runs/{id}", s.handleGetAutopilotRun)
		r.Post("/api/autopilot/applications", s.handleCreateApplication)
		r.Get("/api/autopilot/applications", s.handleListApplications)
		r.Patch("/api/autopilot/applications/{id}", s.handleUpdateApplication)
		r.Delete("/api/autopilot/applications/{id}", s.handleDeleteApplication)
		r.Get("/api/autopilot/applications/{id}/resume-docx", s.handleDownloadApplicationResume)
		r.Post("/api/autopilot/schedules", s.handleCreateSchedule)
		r.Get("/api/autopilot/schedules", s.handleListSchedules)
		r.Patch("/api/autopilot/schedules/{id}", s.handleUpdateSchedule)
		r.Delete("/api/autopilot/schedules/{id}", s.handleDeleteSchedule)
		// Also keep v1 routes
		r.Post("/api/v1/autopilot/start", s.handleAutopilotStart)
		r.Get("/api/v1/autopilot/runs", s.handleListAutopilotRuns)
		r.Get("/api/v1/autopilot/runs/{id}", s.handleGetAutopilotRun)
		r.Post("/api/v1/autopilot/applications", s.handleCreateApplication)
		r.Get("/api/v1/autopilot/applications", s.handleListApplications)
		r.Get("/api/v1/autopilot/applications/{id}", s.handleGetApplication)
		r.Put("/api/v1/autopilot/applications/{id}", s.handleUpdateApplication)
		r.Delete("/api/v1/autopilot/applications/{id}", s.handleDeleteApplication)
		r.Get("/api/v1/autopilot/applications/{id}/download", s.handleDownloadApplicationResume)
		r.Post("/api/v1/autopilot/schedules", s.handleCreateSchedule)
		r.Get("/api/v1/autopilot/schedules", s.handleListSchedules)
		r.Put("/api/v1/autopilot/schedules/{id}", s.handleUpdateSchedule)
		r.Delete("/api/v1/autopilot/schedules/{id}", s.handleDeleteSchedule)

		// Analysis Routes
		r.Post("/api/v1/analyze", s.handleAnalyze)
		r.Get("/api/v1/analyze/history", s.handleAnalysisHistory)
		r.Get("/api/v1/analyze/{id}", s.handleGetAnalysis)

		// Dashboard stats
		r.Get("/api/dashboard/stats", s.handleDashboardStats)
		r.Get("/api/v1/dashboard/stats", s.handleDashboardStats)
		// Extension-friendly stats alias
		r.Get("/api/v1/stats", s.handleDashboardStats)

		// Hermes agent layer (WS-E) — scrape, cached jobs, run status
		s.routesHermes(r)
		s.RegisterBrowserRoutes(r)
		s.routesAgents(r)
		s.routesCareerOps(r)
		s.RegisterOneStopRoutes(r)
		// K3/K5 + memory layer (skill-gaps, chain strip, conversations, preferences)
		s.RegisterSkillGapRoutes(r)
		s.RegisterChainRoutes(r)
		s.RegisterMemoryRoutes(r)

		// Career Intelligence Engine
		s.routesCareerIntelligence(r)

		// Voice AI Interview stream
		s.routesVoice(r)

		// Predictive Funnel Analytics
		s.routesAnalytics(r)

		// Multi-Tenant & Advisor Cohort dashboard
		s.routesTenant(r)

		// Web-Push Notifications
		s.routesPush(r)

		// Knowledge Hub (Omni-Save)
		s.routesKnowledgeHub(r)

		// Per-Application Extra features (notes, voice notes, interview questions, email parse)
		s.routesApplicationsExtra(r)

		// Chrome Extension endpoints
		s.routesExtensionExtra(r)

		// API Key management
		s.routesAPIKeys(r)

		// LinkedIn Profile analysis
		r.Post("/api/v1/linkedin/analyze", s.handleLinkedInAnalyze)
		r.Post("/api/linkedin/analyze", s.handleLinkedInAnalyze)

		// Review Queue Routes
		r.Get("/api/v1/review-queue", s.handleListReviewQueue)
		r.Get("/api/v1/review-queue/{id}", s.handleGetReviewQueueItem)
		r.Put("/api/v1/review-queue/{id}/approve", s.handleApproveReviewQueueItem)
		r.Put("/api/v1/review-queue/{id}/reject", s.handleRejectReviewQueueItem)
		r.Put("/api/v1/review-queue/{id}/modify", s.handleModifyReviewQueueItem)
		r.Put("/api/v1/review-queue/{id}/submit", s.handleSubmitApplication)
		r.Post("/api/v1/review-queue/bulk-action", s.handleBulkReviewQueueAction)
		r.Get("/api/v1/review-queue/stats", s.handleReviewQueueStats)
		r.Get("/api/v1/review-queue/history/{id}", s.handleReviewQueueHistory)
		// Extension integration: queue for review from extension
		r.Post("/api/v1/review-queue/queue", s.handleQueueApplicationForReview)
		// Archive-compatible aliases
		r.Get("/api/review-queue", s.handleListReviewQueue)
		r.Get("/api/review-queue/{id}", s.handleGetReviewQueueItem)
		r.Put("/api/review-queue/{id}/approve", s.handleApproveReviewQueueItem)
		r.Put("/api/review-queue/{id}/reject", s.handleRejectReviewQueueItem)
		r.Put("/api/review-queue/{id}/modify", s.handleModifyReviewQueueItem)
		r.Put("/api/review-queue/{id}/submit", s.handleSubmitApplication)
		r.Post("/api/review-queue/bulk-action", s.handleBulkReviewQueueAction)
		r.Get("/api/review-queue/stats", s.handleReviewQueueStats)
		r.Get("/api/review-queue/history/{id}", s.handleReviewQueueHistory)
		r.Post("/api/review-queue/queue", s.handleQueueApplicationForReview)
	})
}

// -------------------------------------------------------------------
// Health
// -------------------------------------------------------------------

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	payload := map[string]interface{}{
		"status":       "ok",
		"service":      "go-backend",
		"agent_engine": "hermes-local",
		"go_version":   runtime.Version(),
		"uptime":       time.Since(s.startTime).String(),
	}
	if s.DB != nil {
		if err := s.DB.Conn.PingContext(r.Context()); err == nil {
			payload["db"] = "connected"
		} else {
			payload["db"] = "disconnected"
		}
	}
	if s.AI != nil {
		if err := s.AI.HealthCheck(); err == nil {
			payload["ai_service"] = "connected"
		} else {
			payload["ai_service"] = "disconnected"
		}
	}
	s.respondJSON(w, http.StatusOK, payload)
}

func (s *Server) handleHealthDetailed(w http.ResponseWriter, r *http.Request) {
	// Public endpoint — keep response minimal. Never expose Go version,
	// DB pool internals, AI service error strings, or server uptime, since
	// they help attackers fingerprint the deployment and target CVEs.
	payload := map[string]interface{}{
		"status":  "ok",
		"service": "go-backend",
	}

	if s.DB != nil && s.DB.Conn != nil {
		if err := s.DB.Conn.PingContext(r.Context()); err == nil {
			payload["db"] = "connected"
		} else {
			payload["db"] = "disconnected"
		}
	}

	if s.AI != nil {
		if err := s.AI.HealthCheck(); err == nil {
			payload["ai_service"] = "connected"
		} else {
			payload["ai_service"] = "disconnected"
		}
	}

	s.respondJSON(w, http.StatusOK, payload)
}

// -------------------------------------------------------------------
// Cover Letter
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// Job Description Handlers
// -------------------------------------------------------------------

func (s *Server) handleCreateJD(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title   string `json:"title"`
		Company string `json:"company"`
		Text    string `json:"text"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Title == "" || req.Text == "" {
		s.respondError(w, http.StatusBadRequest, "Title and text are required")
		return
	}

	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	query := `INSERT INTO job_descriptions (user_id, title, company, text, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, created_at`
	var id int
	var createdAt time.Time
	err := s.DB.Conn.QueryRowContext(r.Context(), query, userID, req.Title, req.Company, req.Text).Scan(&id, &createdAt)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to create job description")
		return
	}

	s.respondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         id,
		"user_id":    userID,
		"title":      req.Title,
		"company":    req.Company,
		"created_at": createdAt,
	})
}

func (s *Server) handleListJDs(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	rows, err := s.DB.Conn.QueryContext(r.Context(), "SELECT id, title, company, created_at FROM job_descriptions WHERE user_id=$1 ORDER BY created_at DESC", userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch job descriptions")
		return
	}
	defer rows.Close()

	jds := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var title, company string
		var createdAt time.Time
		if err := rows.Scan(&id, &title, &company, &createdAt); err != nil {
			log.Printf("handleListJDs: scan error: %v", err)
			continue
		}
		jds = append(jds, map[string]interface{}{
			"id":         id,
			"title":      title,
			"company":    company,
			"created_at": createdAt,
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleListJDs: rows iteration error: %v", err)
	}
	s.respondJSON(w, http.StatusOK, jds)
}

func (s *Server) handleGetJD(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	var jd models.JobDescription
	query := `SELECT id, user_id, title, company, text, created_at FROM job_descriptions WHERE id=$1 AND user_id=$2`
	err := s.DB.Conn.QueryRowContext(r.Context(), query, idStr, userID).Scan(&jd.ID, &jd.UserID, &jd.Title, &jd.Company, &jd.Text, &jd.CreatedAt)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Job description not found")
		return
	}
	s.respondJSON(w, http.StatusOK, jd)
}

func (s *Server) handleUpdateJD(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	var req struct {
		Title   string `json:"title"`
		Company string `json:"company"`
		Text    string `json:"text"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Title == "" || req.Text == "" {
		s.respondError(w, http.StatusBadRequest, "Title and text are required")
		return
	}

	query := `UPDATE job_descriptions SET title=$1, company=$2, text=$3 WHERE id=$4 AND user_id=$5`
	res, err := s.DB.Conn.ExecContext(r.Context(), query, req.Title, req.Company, req.Text, idStr, userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to update job description")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Job description not found")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":      idStr,
		"message": "Job description updated successfully",
	})
}

func (s *Server) handleDeleteJD(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	res, err := s.DB.Conn.ExecContext(r.Context(), "DELETE FROM job_descriptions WHERE id=$1 AND user_id=$2", idStr, userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to delete job description")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Job description not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// -------------------------------------------------------------------
// Analysis Handlers
// -------------------------------------------------------------------

func (s *Server) handleAnalyze(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ResumeID interface{} `json:"resume_id"`
		JDID     interface{} `json:"jd_id"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID.String()

	var resumeID int
	switch v := req.ResumeID.(type) {
	case float64:
		resumeID = int(v)
	case string:
		var err error
		resumeID, err = strconv.Atoi(v)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Invalid resume_id")
			return
		}
	default:
		s.respondError(w, http.StatusBadRequest, "Invalid resume_id")
		return
	}

	var jdIDInt int
	switch v := req.JDID.(type) {
	case float64:
		jdIDInt = int(v)
	case string:
		var err error
		jdIDInt, err = strconv.Atoi(v)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Invalid jd_id")
			return
		}
	default:
		s.respondError(w, http.StatusBadRequest, "Invalid jd_id")
		return
	}

	// Fetch resume and JD
	var resumeText, jdText string
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT original_text FROM resumes WHERE id=$1 AND user_id=$2", resumeID, userID).Scan(&resumeText); err != nil {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT text FROM job_descriptions WHERE id=$1 AND user_id=$2", jdIDInt, userID).Scan(&jdText); err != nil {
		s.respondError(w, http.StatusNotFound, "Job description not found")
		return
	}

	// Call AI service
	analysis, err := s.AI.AnalyzeResume(resumeText, jdText)
	if err != nil {
		log.Printf("AI analysis failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "AI analysis failed")
		return
	}

	// Store result
	var score int
	switch v := analysis["score"].(type) {
	case int:
		score = v
	case int64:
		score = int(v)
	case float64:
		score = int(v)
	}
	breakdown, _ := json.Marshal(analysis["breakdown"])
	keywords, _ := json.Marshal(analysis["keywords"])
	recommendations, _ := json.Marshal(analysis["recommendations"])

	query := `INSERT INTO analysis_results (user_id, resume_id, job_description_id, score, breakdown, keyword_matches, recommendations, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id, created_at`
	var newID int
	var createdAt time.Time
	err = s.DB.Conn.QueryRowContext(r.Context(), query, userID, resumeID, jdIDInt, score, string(breakdown), string(keywords), string(recommendations)).Scan(&newID, &createdAt)
	if err != nil {
		log.Printf("Failed to store analysis: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to store analysis")
		return
	}

	analysis["analysis_id"] = newID
	analysis["created_at"] = createdAt
	s.respondJSON(w, http.StatusOK, analysis)
}

func (s *Server) handleAnalysisHistory(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID.String()

	rows, err := s.DB.Conn.QueryContext(r.Context(), "SELECT id, resume_id, job_description_id, score, created_at FROM analysis_results WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50", userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch analysis history")
		return
	}
	defer rows.Close()

	history := []map[string]interface{}{}
	for rows.Next() {
		var id, resumeID, jdID int
		var score int
		var createdAt time.Time
		if err := rows.Scan(&id, &resumeID, &jdID, &score, &createdAt); err != nil {
			log.Printf("handleAnalysisHistory: scan error: %v", err)
			continue
		}
		history = append(history, map[string]interface{}{
			"id":                 id,
			"resume_id":          resumeID,
			"job_description_id": jdID,
			"score":              score,
			"created_at":         createdAt,
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleAnalysisHistory: rows iteration error: %v", err)
	}
	s.respondJSON(w, http.StatusOK, history)
}

func (s *Server) handleGetAnalysis(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid analysis id")
		return
	}
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID.String()

	query := `SELECT id, user_id, resume_id, job_description_id, score, breakdown, keyword_matches, recommendations, created_at FROM analysis_results WHERE id=$1 AND user_id=$2`
	var ar models.AnalysisResult
	err = s.DB.Conn.QueryRowContext(r.Context(), query, id, userID).Scan(
		&ar.ID, &ar.UserID, &ar.ResumeID, &ar.JobDescriptionID, &ar.Score,
		&ar.Breakdown, &ar.KeywordMatches, &ar.Recommendations, &ar.CreatedAt,
	)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Analysis not found")
		return
	}
	s.respondJSON(w, http.StatusOK, ar)
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

func (s *Server) respondJSON(w http.ResponseWriter, statusCode int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(payload)
}

func (s *Server) respondError(w http.ResponseWriter, statusCode int, message string) {
	s.respondJSON(w, statusCode, map[string]string{"error": message})
}
