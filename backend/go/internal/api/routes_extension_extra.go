package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/models"
)

// routesExtensionExtra registers Chrome extension helper endpoints.
func (s *Server) routesExtensionExtra(r chi.Router) {
	r.Post("/api/extension/capture", s.handleExtensionCapture)
	r.Post("/api/extension/quick-ats", s.handleExtensionQuickATS)
	r.Get("/api/extension/autofill", s.handleExtensionAutofill)
	// v1 aliases
	r.Post("/api/v1/extension/capture", s.handleExtensionCapture)
	r.Post("/api/v1/extension/quick-ats", s.handleExtensionQuickATS)
	r.Get("/api/v1/extension/autofill", s.handleExtensionAutofill)
}

// -------------------------------------------------------------------
// Extension: Capture — save job to autopilot / kanban from extension
// -------------------------------------------------------------------

func (s *Server) handleExtensionCapture(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Company     string `json:"company"`
		Location    string `json:"location"`
		URL         string `json:"url"`
		Description string `json:"description"`
		AddToBoard  bool   `json:"add_to_board"`
		Stage       string `json:"stage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Title == "" {
		s.respondError(w, http.StatusUnprocessableEntity, "title is required")
		return
	}
	if req.Stage == "" {
		req.Stage = "saved"
	}

	// 1. Save to saved_jobs
	jobMap := map[string]interface{}{
		"title":       req.Title,
		"company":     req.Company,
		"location":    req.Location,
		"url":         req.URL,
		"description": req.Description,
	}
	jobJSON, _ := json.Marshal(jobMap)
	dedupeKey := req.URL
	if dedupeKey == "" {
		dedupeKey = req.Title + "_" + req.Company
	}

	var savedJobID int
	querySaved := `INSERT INTO saved_jobs (user_id, dedupe_key, job, status, saved_at, updated_at) 
		VALUES ($1, $2, $3, 'saved', NOW(), NOW()) 
		ON CONFLICT (user_id, dedupe_key) DO UPDATE SET job = EXCLUDED.job, updated_at = NOW() 
		RETURNING id`
	err := s.DB.Conn.QueryRowContext(r.Context(), querySaved, user.ID, dedupeKey, jobJSON).Scan(&savedJobID)
	if err != nil {
		log.Printf("handleExtensionCapture: failed to save to saved_jobs: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to save job")
		return
	}

	savedJobObj := map[string]interface{}{
		"id":         savedJobID,
		"user_id":    user.ID.String(),
		"dedupe_key": dedupeKey,
		"job":        jobMap,
		"status":     "saved",
	}

	var appObj map[string]interface{}
	if req.AddToBoard {
		appID := uuid.New()
		queryApp := `INSERT INTO applications
			(application_id, user_id, title, company, location, job_url, stage, status, notes, job, created_at, updated_at)
			VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$7,$8,$9::jsonb,NOW(),NOW())`
		_, err = s.DB.Conn.ExecContext(r.Context(), queryApp,
			appID, user.ID, req.Title, req.Company, req.Location, req.URL, req.Stage, req.Description, string(jobJSON))
		if err != nil {
			log.Printf("handleExtensionCapture: failed to create application: %v", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to create application card")
			return
		}
		appObj = map[string]interface{}{
			"id":             appID.String(),
			"application_id": appID.String(),
			"stage":          req.Stage,
			"title":          req.Title,
			"company":        req.Company,
			"location":       req.Location,
		}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"saved_job":   savedJobObj,
		"application": appObj,
	})
}

// -------------------------------------------------------------------
// Extension: Quick ATS — instant ATS score from extension
// -------------------------------------------------------------------

func (s *Server) handleExtensionQuickATS(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req struct {
		JobDescription     string `json:"job_description"`
		CustomInstructions string `json:"custom_instructions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.JobDescription == "" || len(req.JobDescription) < 20 {
		s.respondError(w, http.StatusUnprocessableEntity, "Provide a job description.")
		return
	}

	var resumeID int
	var resumeTitle string
	var resumeText string
	query := `SELECT id, title, original_text FROM resumes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`
	err := s.DB.Conn.QueryRowContext(r.Context(), query, user.ID).Scan(&resumeID, &resumeTitle, &resumeText)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "No resume found. Add a resume in Job Tayari first.")
		return
	}

	aiReq := map[string]interface{}{
		"resume_text":         resumeText,
		"job_description":     req.JobDescription,
		"custom_instructions": req.CustomInstructions,
	}

	aiResp, err := s.AI.PostJSON("/api/v1/resumes/analyze-text", aiReq)
	if err != nil {
		log.Printf("handleExtensionQuickATS: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "ATS check failed")
		return
	}

	// aiResp has format {"result": {...}}
	result, _ := aiResp["result"]

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"resume_id":    strconv.Itoa(resumeID),
		"resume_title": resumeTitle,
		"result":       result,
	})
}

// -------------------------------------------------------------------
// Extension: Autofill — return user profile for form prefill
// -------------------------------------------------------------------

func (s *Server) handleExtensionAutofill(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var p models.Profile
	query := `SELECT id, full_name, avatar_url, email, headline, summary, skills, desired_roles, locations, experience_years, open_to_remote, links, created_at, updated_at FROM profiles WHERE id=$1`
	err := s.DB.Conn.QueryRowContext(r.Context(), query, user.ID).Scan(
		&p.ID, &p.FullName, &p.AvatarURL, &p.Email, &p.Headline, &p.Summary,
		&p.Skills, &p.DesiredRoles, &p.Locations, &p.ExperienceYears, &p.OpenToRemote, &p.Links,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		// Fall back to default profile values instead of 404
		p.Email = user.Email
	}

	locationStr := ""
	if len(p.Locations) > 0 {
		locationStr = p.Locations[0]
	}

	phoneStr := ""
	_ = s.DB.Conn.QueryRowContext(r.Context(), "SELECT COALESCE(phone, '') FROM auth.users WHERE id=$1", user.ID).Scan(&phoneStr)

	skillsList := p.Skills
	if skillsList == nil {
		skillsList = []string{}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"full_name":        p.FullName,
		"email":            p.Email,
		"phone":            phoneStr,
		"location":         locationStr,
		"current_role":     p.Headline,
		"skills":           skillsList,
		"desired_roles":    p.DesiredRoles,
		"experience_years": p.ExperienceYears,
		"open_to_remote":   p.OpenToRemote,
	})
}
