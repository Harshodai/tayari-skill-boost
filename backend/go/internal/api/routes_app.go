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
	// Authentication endpoints use their own limiter. Keeping them outside the
	// shared public bucket prevents anonymous analytics/branding traffic from
	// starving legitimate registration and login attempts.
	r.Group(func(r chi.Router) {
		r.Use(s.loginRateLimiter.Middleware)
		r.Post("/api/v1/auth/register", s.handleRegister)
		r.Post("/api/auth/register", s.handleRegister)
		r.Post("/api/v1/auth/login", s.handleLogin)
		r.Post("/api/auth/login", s.handleLogin)
		r.Post("/api/v1/auth/verify-email", s.handleVerifyEmail)
		r.Post("/api/auth/verify-email", s.handleVerifyEmail)
		r.Post("/api/v1/auth/resend-verification", s.handleResendVerificationEmail)
		r.Post("/api/auth/resend-verification", s.handleResendVerificationEmail)
	})

	// Public Health & Info
	r.Group(func(r chi.Router) {
		r.Use(s.publicRateLimiter.Middleware)
		r.Get("/api/v1/health", s.handleHealth)
		r.Get("/api/v1/health/detailed", s.handleHealthDetailed)
		r.Get("/api/v1/capabilities", s.handleCapabilities)
		r.Get("/healthz", s.handleHealth)
		r.Get("/readyz", s.handleReady)

		// ---- Auth rate-limit read (replaces check-rate-limit edge fn) ----
		// Unauthenticated pre-login read: caller checks lockout before login.
		// Global IP rate limiter (publicRateLimiter above) caps abuse. POST with
		// a JSON body keeps the email out of the URL (no query-string leakage).
		r.Post("/api/v1/auth/rate-limit", s.handleAuthRateLimit)
		r.Post("/api/auth/rate-limit", s.handleAuthRateLimit)

		r.Get("/api/v1/tenants/branding", s.handleGetTenantBranding)
		r.Post("/api/v1/analytics/performance", s.handleAnalyticsPerformance)

		r.Get("/api/v1/auth/extension/config", s.handleExtensionAuthConfig)
		r.Get("/api/auth/extension/config", s.handleExtensionAuthConfig)
		s.routesExtensionHandoff(r)
		s.routesPasswordReset(r)

		// Social Auth Routes
		r.Get("/api/auth/{provider}", s.handleSocialLogin)
		r.Get("/api/v1/auth/{provider}", s.handleSocialLogin)
		r.Get("/api/auth/{provider}/callback", s.handleSocialCallback)
		r.Get("/api/v1/auth/{provider}/callback", s.handleSocialCallback)

		s.routesPublic(r)
		s.routesGmail(r)
		s.routesGoogleCalendar(r)
		s.routesGoogleDrive(r)
		s.routesSecurity(r)

		// Public legacy aliases
		r.Get("/api/health", s.handleHealth)
		r.Get("/api/health/detailed", s.handleHealthDetailed)
		r.Get("/api/capabilities", s.handleCapabilities)
		r.Get("/health", s.handleHealth)

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
		s.routesProtectedExtensionHandoff(r)

		r.Get("/api/v1/profile", s.handleGetProfile)
		r.Put("/api/v1/profile", s.handleUpdateProfile)
		r.Patch("/api/v1/account/password", s.handleChangePassword)
		r.Patch("/api/account/password", s.handleChangePassword)

		r.Get("/api/v1/analyze/history", s.handleListAnalysisHistory)
		s.routesKnowledgeHub(r)

		// ponytail: applications/{id}/notes and applications/parse-email used
		// to also be registered here as handleAddApplicationNote (a no-op
		// stub: always returned {"status":"note_added"} without writing
		// anything) and handleParseApplicationEmail (hardcoded 501). Both are
		// shadowed dead code today — routesApplicationsExtra (router.go,
		// registered after this file) has the real implementations
		// (handleAddNote actually updates notes_log; handleParseEmail calls
		// Python's real parser) and wins per chi's last-registration-wins
		// behavior. Found by TestNoDuplicateRouteRegistrations. Current live
		// behavior is correct by luck of registration order, not by design —
		// removed the stubs so a future reordering can't silently revert
		// real note-saving/email-parsing back to a fake success response.

		// GDPR: account lifecycle
		r.Delete("/api/v1/account", s.handleDeleteAccount)
		r.Delete("/api/account", s.handleDeleteAccount)
		r.Get("/api/v1/account/export", s.handleExportAccount)
		r.Get("/api/account/export", s.handleExportAccount)

		r.Post("/api/v1/resumes", s.handleCreateResume)
		r.Post("/api/v1/resumes/upload", s.handleUploadResumeMultipart)
		r.Get("/api/v1/resumes", s.handleListResumes)
		r.Get("/api/v1/resumes/{id}", s.handleGetResume)
		r.Put("/api/v1/resumes/{id}", s.handleUpdateResume)
		r.Delete("/api/v1/resumes/{id}", s.handleDeleteResume)
		r.Post("/api/v1/resumes/{id}/export", s.handleExportResume)
		r.Post("/api/v1/resumes/generate-pdf", s.handleGenerateResumePdf)
		r.Get("/api/v1/verification/status", s.handleVerificationStatus)
		r.Get("/api/v1/resumes/{id}/docx", s.handleDownloadResumeDocx)
		r.Get("/api/v1/resume-versions/{id}/docx", s.handleDownloadVersionDocx)
		r.Post("/api/v1/job-descriptions", s.handleCreateJD)
		r.Post("/api/v1/job-descriptions/import", s.handleImportJobDescription)
		r.Get("/api/v1/job-descriptions", s.handleListJDs)
		r.Get("/api/v1/job-descriptions/{id}", s.handleGetJD)
		// ponytail: LLM-heavy AI proxy endpoints live in routesAIProxy
		// (per-user sliding-window limiter); everything else keeps the
		// shared limiters above.
		s.routesAIProxy(r)
		s.routesApplications(r)
		s.routesAPIKeys(r)
		s.routesHermes(r)
		s.RegisterBrowserRoutes(r)
		s.routesVoice(r)

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
	if s.Auth == nil {
		http.Error(w, "social authentication is unavailable", http.StatusServiceUnavailable)
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
	if s.Auth == nil {
		http.Error(w, "social authentication is unavailable", http.StatusServiceUnavailable)
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
	r.Put("/api/resumes/{id}", s.handleUpdateResume)
	r.Delete("/api/resumes/{id}", s.handleDeleteResume)
	// ponytail: /api twins for analyze/optimize/verification/referral/
	// interview live in routesAIProxy so both prefixes share the per-user
	// limiter; keeping them here too would double-register the pattern.
	r.Post("/api/resumes/{id}/export", s.handleExportResume)
	r.Post("/api/resumes/generate-pdf", s.handleGenerateResumePdf)
	r.Get("/api/verification/status", s.handleVerificationStatus)
	r.Get("/api/resumes/{id}/docx", s.handleDownloadResumeDocx)
	r.Get("/api/resume-versions/{id}/docx", s.handleDownloadVersionDocx)
	// (the /api/v1/ alias of this route already exists above — this is the
	// bare-/api/ alias block, a copy-paste duplicate of it was removed here)
	r.Post("/api/job-descriptions", s.handleCreateJD)
	r.Post("/api/job-descriptions/import", s.handleImportJobDescription)
	r.Get("/api/job-descriptions", s.handleListJDs)
	r.Get("/api/job-descriptions/{id}", s.handleGetJD)
	r.Get("/api/tenants/branding", s.handleGetTenantBranding)
	r.Post("/api/analytics/performance", s.handleAnalyticsPerformance)
	r.Get("/api/applications", s.handleListApplications)
	r.Post("/api/applications", s.handleCreateApplication)
	r.Get("/api/applications/{id}", s.handleGetApplication)
	r.Put("/api/applications/{id}", s.handleUpdateApplication)
	r.Delete("/api/applications/{id}", s.handleDeleteApplication)
	r.Get("/api/applications/{id}/resume-docx", s.handleDownloadApplicationResume)
	// See the matching comment above (v1 block) — these two are registered
	// by routesApplicationsExtra with real implementations; the stubs that
	// used to be registered here too were removed as dead/shadowed code.
}
