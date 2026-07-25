package api

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
)

const contextKeyProvider contextKey = "provider"

var allowedSocialProviders = map[string]bool{
	"google": true,
	"github": true,
}

func (s *Server) registerCoreRoutes(r chi.Router) {
	// Public Health & Info
	r.Group(func(r chi.Router) {
		r.Use(s.publicRateLimiter.Middleware)
		r.Get("/api/v1/health", s.handleHealth)
		r.Get("/api/v1/health/detailed", s.handleHealthDetailed)

		r.With(s.loginRateLimiter.Middleware).Post("/api/v1/auth/register", s.handleRegister)
		r.With(s.loginRateLimiter.Middleware).Post("/api/auth/register", s.handleRegister)
		r.With(s.loginRateLimiter.Middleware).Post("/api/v1/auth/login", s.handleLogin)
		r.With(s.loginRateLimiter.Middleware).Post("/api/auth/login", s.handleLogin)

		r.Get("/api/v1/tenants/branding", s.handleGetTenantBranding)
		r.Post("/api/v1/analytics/performance", s.handleAnalyticsPerformance)

		s.routesPasswordReset(r)

		// Social Auth Routes
		r.Get("/api/auth/{provider}", s.handleSocialLogin)
		r.Get("/api/v1/auth/{provider}", s.handleSocialLogin)
		r.Get("/api/auth/{provider}/callback", s.handleSocialCallback)
		r.Get("/api/v1/auth/{provider}/callback", s.handleSocialCallback)

		s.routesPublic(r)
		s.routesGmail(r)

		// Public legacy aliases
		r.Get("/api/health", s.handleHealth)
		r.Get("/api/health/detailed", s.handleHealthDetailed)

		// Public no-signup ATS scan
		r.Post("/api/v1/public/analyze-text", s.handleAnalyzeText)
		r.Post("/api/public/analyze-text", s.handleAnalyzeText)
	})

	// Protected Routes
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Use(s.authRateLimiter.Middleware)

		r.Get("/api/v1/auth/me", s.handleMe)
		r.Get("/api/v1/me", s.handleMe)

		r.Get("/api/v1/profile", s.handleGetProfile)
		r.Put("/api/v1/profile", s.handleUpdateProfile)

		r.Post("/api/v1/analyze", s.handleAnalyzeText)
		r.Get("/api/v1/analyze/history", s.handleListAnalysisHistory)
		s.routesKnowledgeHub(r)

		r.Post("/api/v1/applications/{id}/notes", s.handleAddApplicationNote)
		r.Post("/api/v1/applications/parse-email", s.handleParseApplicationEmail)

		r.Post("/api/v1/resumes", s.handleCreateResume)
		r.Post("/api/v1/resumes/upload", s.handleUploadResumeMultipart)
		r.Get("/api/v1/resumes", s.handleListResumes)
		r.Post("/api/v1/resumes/analyze-text", s.handleAnalyzeText)
		r.Get("/api/v1/resumes/{id}", s.handleGetResume)
		r.Delete("/api/v1/resumes/{id}", s.handleDeleteResume)
		r.Post("/api/v1/resumes/{id}/optimize", s.handleOptimizeResume)
		r.Post("/api/v1/resumes/{id}/analyze", s.handleAnalyzeResume)
		r.Post("/api/v1/resumes/{id}/export", s.handleExportResume)
		r.Get("/api/v1/resumes/{id}/docx", s.handleDownloadResumeDocx)
		r.Get("/api/v1/resume-versions/{id}/docx", s.handleDownloadVersionDocx)
		r.Post("/api/v1/job-descriptions", s.handleCreateJD)
		r.Get("/api/v1/job-descriptions", s.handleListJDs)
		r.Get("/api/v1/job-descriptions/{id}", s.handleGetJD)
		s.routesApplications(r)
		s.routesAPIKeys(r)
		s.routesHermes(r)
		s.RegisterBrowserRoutes(r)

		// Legacy alias fallback registrations
		s.registerLegacyAliases(r)
	})
}

func (s *Server) setupSocialAuthContext(r *http.Request) (*http.Request, bool) {
	provider := chi.URLParam(r, "provider")
	if !allowedSocialProviders[provider] {
		return r, false
	}
	q := r.URL.Query()
	q.Set("provider", provider)
	r.URL.RawQuery = q.Encode()
	r = r.WithContext(context.WithValue(r.Context(), contextKeyProvider, provider))
	return r, true
}

func (s *Server) handleSocialLogin(w http.ResponseWriter, r *http.Request) {
	r, ok := s.setupSocialAuthContext(r)
	if !ok {
		http.Error(w, "invalid provider", http.StatusBadRequest)
		return
	}
	s.Auth.SocialLogin(w, r)
}

func (s *Server) handleSocialCallback(w http.ResponseWriter, r *http.Request) {
	r, ok := s.setupSocialAuthContext(r)
	if !ok {
		http.Error(w, "invalid provider", http.StatusBadRequest)
		return
	}
	s.Auth.SocialCallback(w, r)
}

func (s *Server) registerLegacyAliases(r chi.Router) {
	r.Get("/api/profile", s.handleGetProfile)
	r.Put("/api/profile", s.handleUpdateProfile)
	r.Get("/api/auth/me", s.handleMe)
	r.Get("/api/me", s.handleMe)
	r.Post("/api/resumes/upload", s.handleUploadResumeMultipart)
	r.Get("/api/resumes", s.handleListResumes)
	r.Post("/api/resumes", s.handleCreateResume)
	r.Get("/api/resumes/{id}", s.handleGetResume)
	r.Delete("/api/resumes/{id}", s.handleDeleteResume)
	r.Post("/api/analyze", s.handleAnalyzeText)
	r.Post("/api/resumes/analyze-text", s.handleAnalyzeText)
	r.Post("/api/resumes/{id}/optimize", s.handleOptimizeResume)
	r.Post("/api/resumes/{id}/analyze", s.handleAnalyzeResume)
	r.Post("/api/resumes/{id}/export", s.handleExportResume)
	r.Get("/api/resumes/{id}/docx", s.handleDownloadResumeDocx)
	r.Get("/api/resume-versions/{id}/docx", s.handleDownloadVersionDocx)
	r.Get("/api/v1/resume-versions/{id}/docx", s.handleDownloadVersionDocx)
	r.Post("/api/job-descriptions", s.handleCreateJD)
	r.Get("/api/job-descriptions", s.handleListJDs)
	r.Get("/api/job-descriptions/{id}", s.handleGetJD)
	r.Get("/api/tenants/branding", s.handleGetTenantBranding)
	r.Post("/api/analytics/performance", s.handleAnalyticsPerformance)
	r.Get("/api/applications", s.handleListApplications)
	r.Post("/api/applications", s.handleCreateApplication)
	r.Get("/api/applications/{id}", s.handleGetApplication)
	r.Put("/api/applications/{id}", s.handleUpdateApplication)
	r.Delete("/api/applications/{id}", s.handleDeleteApplication)
	r.Post("/api/applications/{id}/notes", s.handleAddApplicationNote)
	r.Post("/api/applications/parse-email", s.handleParseApplicationEmail)
}
