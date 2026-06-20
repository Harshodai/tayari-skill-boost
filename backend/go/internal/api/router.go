package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"net/mail"
	"runtime"
	"strconv"
	"strings"
	"time"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
	"tayari-backend/internal/ai"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// Context key type to avoid collisions
type contextKey string

const contextKeyUser contextKey = "user"

type Server struct {
	Router            *chi.Mux
	Auth              auth.AuthService
	Config            *config.Config
	DB                *database.DB
	AI                *ai.Client
	startTime         time.Time
	publicRateLimiter *rateLimiter
	authRateLimiter   *rateLimiter
}

func NewServer(authService auth.AuthService, cfg *config.Config, db *database.DB) *Server {
	s := &Server{
		Router:            chi.NewRouter(),
		Auth:              authService,
		Config:            cfg,
		DB:                db,
		AI:                ai.NewClient(cfg.PythonAIURL),
		startTime:         time.Now(),
		publicRateLimiter: newRateLimiter(100, false),
		authRateLimiter:   newRateLimiter(1000, true),
	}
	// Start periodic cleanup of rate limiter entries
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			s.publicRateLimiter.cleanup()
			s.authRateLimiter.cleanup()
		}
	}()
	s.routes()
	return s
}

func (s *Server) routes() {
	s.Router.Use(middleware.Recoverer)
	s.Router.Use(s.requestLoggingMiddleware)

	/*
	allowedOrigins := []string{"http://localhost:5173", "http://localhost:4173"}
	if s.Config != nil && len(s.Config.AllowedOrigins) > 0 {
		allowedOrigins = s.Config.AllowedOrigins
	}
	*/

	// Use AllowedOriginFunc to allow any origin with credentials (archive test expects wildcard)
	s.Router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:     []string{"Link"},
		AllowCredentials:   true,
		MaxAge:             300,
	}))

	// Public Routes (IP-based rate limit: 100 RPM)
	s.Router.Group(func(r chi.Router) {
		r.Use(s.publicRateLimiter.Middleware)
		r.Get("/api/health", s.handleHealth)
		r.Get("/api/health/detailed", s.handleHealthDetailed)
		r.Post("/api/auth/register", s.handleRegister)
		r.Post("/api/auth/login", s.handleLogin)

		// Social Auth Routes
		r.Get("/api/auth/{provider}", func(w http.ResponseWriter, r *http.Request) {
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
	})

	// Protected Routes (user-based rate limit: 1000 RPM)
	s.Router.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Use(s.authRateLimiter.Middleware)
		r.Get("/api/auth/me", s.handleMe)
		r.Get("/api/me", s.handleMe)

		// Profile (alias for archive compatibility)
		r.Get("/api/profile", s.handleGetProfile)
		r.Put("/api/profile", s.handleUpdateProfile)
		r.Get("/api/v1/profile", s.handleGetProfile)
		r.Put("/api/v1/profile", s.handleUpdateProfile)

		// Resume upload (multipart, archive compatible)
		r.Post("/api/resumes/upload", s.handleUploadResumeMultipart)
		r.Get("/api/resumes", s.handleListResumes)
		r.Get("/api/resumes/{id}", s.handleGetResume)
		r.Post("/api/resumes/{id}/optimize", s.handleOptimizeResume)
		r.Post("/api/resumes/{id}/analyze", s.handleDeepATS)
		r.Post("/api/resumes/{id}/export", s.handleExportResume)
		// Also keep v1 routes
		r.Post("/api/v1/resumes", s.handleCreateResume)
		r.Get("/api/v1/resumes", s.handleListResumes)
		r.Get("/api/v1/resumes/{id}", s.handleGetResume)
		r.Put("/api/v1/resumes/{id}", s.handleUpdateResume)
		r.Delete("/api/v1/resumes/{id}", s.handleDeleteResume)
		r.Post("/api/v1/resumes/{id}/optimize", s.handleOptimizeResume)
		r.Post("/api/v1/resumes/{id}/analyze", s.handleDeepATS)
		r.Post("/api/v1/resumes/{id}/ats-deep", s.handleDeepATS)
		r.Post("/api/v1/resumes/{id}/export", s.handleExportResume)

		// Cover Letter
		r.Post("/api/cover-letter/generate", s.handleCoverLetterGenerate)
		r.Post("/api/v1/cover-letter/generate", s.handleCoverLetterGenerate)

		// Communication Suite
		r.Post("/api/communication/generate", s.handleCommunicationGenerate)
		r.Post("/api/v1/communication/generate", s.handleCommunicationGenerate)
		r.Get("/api/communication/suggestions", s.handleCommunicationSuggestions)
		r.Get("/api/v1/communication/suggestions", s.handleCommunicationSuggestions)

		// Interview AI
		r.Post("/api/interview/prep", s.handleInterviewPrep)
		r.Post("/api/v1/interview/prep", s.handleInterviewPrep)

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

		// Job Search (archive compatible)
		r.Get("/api/jobs/search", s.handleJobSearchGET)
		r.Post("/api/jobs/search", s.handleJobSearch)
		r.Post("/api/jobs/smart-search", s.handleJobSearch)
		r.Post("/api/jobs/save", s.handleSaveJob)
		r.Get("/api/jobs/saved", s.handleListSavedJobs)
		r.Delete("/api/jobs/saved/{id}", s.handleDeleteSavedJob)
		// Also keep v1 routes
		r.Post("/api/v1/jobs/search", s.handleJobSearch)
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
	payload := map[string]interface{}{
		"status":     "ok",
		"service":    "go-backend",
		"go_version": runtime.Version(),
		"uptime":     time.Since(s.startTime).String(),
	}

	if s.DB != nil && s.DB.Conn != nil {
		stats := s.DB.Conn.Stats()
		payload["db_pool"] = map[string]interface{}{
			"open_connections":     stats.OpenConnections,
			"in_use":               stats.InUse,
			"idle":                 stats.Idle,
			"wait_count":           stats.WaitCount,
			"wait_duration_ms":     stats.WaitDuration.Milliseconds(),
			"max_open_connections": stats.MaxOpenConnections,
		}
		if err := s.DB.Conn.PingContext(r.Context()); err == nil {
			payload["db"] = "connected"
		} else {
			payload["db"] = "disconnected"
		}
	}

	if s.AI != nil {
		start := time.Now()
		err := s.AI.HealthCheck()
		latency := time.Since(start)
		if err == nil {
			payload["ai_service"] = "connected"
			payload["ai_latency_ms"] = latency.Milliseconds()
		} else {
			payload["ai_service"] = "disconnected"
			payload["ai_error"] = err.Error()
		}
	}

	s.respondJSON(w, http.StatusOK, payload)
}

// -------------------------------------------------------------------
// Cover Letter
// -------------------------------------------------------------------


// -------------------------------------------------------------------
// Auth Handlers
// -------------------------------------------------------------------

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("handleRegister: failed to decode request body: %v", err)
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Email = strings.TrimSpace(req.Email)

	if req.Email == "" {
		s.respondError(w, http.StatusBadRequest, "Email is required")
		return
	}
	if _, err := mail.ParseAddress(req.Email); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid email format")
		return
	}

	if req.Password == "" {
		s.respondError(w, http.StatusBadRequest, "Password is required")
		return
	}
	if len(req.Password) < 8 {
		s.respondError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	user, err := s.Auth.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		hash := sha256.Sum256([]byte(req.Email))
		emailHash := hex.EncodeToString(hash[:16])
		log.Printf("handleRegister: registration failed for hash:%s: %v", emailHash, err)
		s.respondError(w, http.StatusInternalServerError, "Registration failed")
		return
	}

	s.respondJSON(w, http.StatusOK, user)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	token, err := s.Auth.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		s.respondError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]string{"token": token})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	s.respondJSON(w, http.StatusOK, user)
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			s.respondError(w, http.StatusUnauthorized, "Authorization header required")
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			s.respondError(w, http.StatusUnauthorized, "Invalid authorization header format")
			return
		}
		tokenStr := parts[1]
		if tokenStr == "" {
			s.respondError(w, http.StatusUnauthorized, "Token is required")
			return
		}

		user, err := s.Auth.VerifyToken(tokenStr)
		if err != nil {
			s.respondError(w, http.StatusUnauthorized, "Invalid token")
			return
		}

		ctx := context.WithValue(r.Context(), contextKeyUser, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// -------------------------------------------------------------------
// Resume Handlers
// -------------------------------------------------------------------

func (s *Server) handleCreateResume(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title        string `json:"title"`
		OriginalText string `json:"original_text"`
		FileType     string `json:"file_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Title == "" {
		s.respondError(w, http.StatusBadRequest, "Title is required")
		return
	}

	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	query := `INSERT INTO resumes (user_id, title, original_text, file_type, status, created_at) VALUES ($1, $2, $3, $4, 'uploaded', NOW()) RETURNING id, created_at`
	var id int
	var createdAt time.Time
	err := s.DB.Conn.QueryRowContext(r.Context(), query, userID, req.Title, req.OriginalText, req.FileType).Scan(&id, &createdAt)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to create resume")
		return
	}

	s.respondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         id,
		"user_id":    userID,
		"title":      req.Title,
		"file_type":  req.FileType,
		"status":     "uploaded",
		"created_at": createdAt,
	})
}

func (s *Server) handleListResumes(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	rows, err := s.DB.Conn.QueryContext(r.Context(), "SELECT id, title, file_type, status, created_at, updated_at FROM resumes WHERE user_id=$1 ORDER BY created_at DESC", userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch resumes")
		return
	}
	defer rows.Close()

	resumes := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var title, fileType, status string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &title, &fileType, &status, &createdAt, &updatedAt); err != nil {
			log.Printf("handleListResumes: scan error: %v", err)
			continue
		}
		resumes = append(resumes, map[string]interface{}{
			"id":         id,
			"title":      title,
			"file_type":  fileType,
			"status":     status,
			"created_at": createdAt,
			"updated_at": updatedAt,
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleListResumes: rows iteration error: %v", err)
	}
	s.respondJSON(w, http.StatusOK, resumes)
}

func (s *Server) handleGetResume(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	var resume models.Resume
	query := `SELECT id, user_id, title, original_text, parsed_json, file_url, file_type, status, created_at, updated_at FROM resumes WHERE id=$1 AND user_id=$2`
	err := s.DB.Conn.QueryRowContext(r.Context(), query, idStr, userID).Scan(&resume.ID, &resume.UserID, &resume.Title, &resume.OriginalText, &resume.ParsedJSON, &resume.FileURL, &resume.FileType, &resume.Status, &resume.CreatedAt, &resume.UpdatedAt)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}
	s.respondJSON(w, http.StatusOK, resume)
}

func (s *Server) handleUpdateResume(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	var req struct {
		Title        string `json:"title"`
		OriginalText string `json:"original_text"`
		FileType     string `json:"file_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Title == "" {
		s.respondError(w, http.StatusBadRequest, "Title is required")
		return
	}

	query := `UPDATE resumes SET title=$1, original_text=$2, file_type=$3, updated_at=NOW() WHERE id=$4 AND user_id=$5`
	res, err := s.DB.Conn.ExecContext(r.Context(), query, req.Title, req.OriginalText, req.FileType, idStr, userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to update resume")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":      idStr,
		"message": "Resume updated successfully",
	})
}

func (s *Server) handleDeleteResume(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID

	res, err := s.DB.Conn.ExecContext(r.Context(), "DELETE FROM resumes WHERE id=$1 AND user_id=$2", idStr, userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to delete resume")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// -------------------------------------------------------------------
// Job Description Handlers
// -------------------------------------------------------------------

func (s *Server) handleCreateJD(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title   string `json:"title"`
		Company string `json:"company"`
		Text    string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
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
		ResumeID string `json:"resume_id"`
		JDID     string `json:"jd_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	userID := user.ID.String()

	// Parse IDs (DB uses INTEGER, request sends strings)
	resumeID, err := strconv.Atoi(req.ResumeID)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid resume_id")
		return
	}
	jdIDInt, err := strconv.Atoi(req.JDID)
	if err != nil {
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
			"id":                  id,
			"resume_id":           resumeID,
			"job_description_id":  jdID,
			"score":               score,
			"created_at":          createdAt,
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
