package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
)

// routesCareerIntelligence wires the career intelligence proxy routes.
// These all call out to the Python AI backend, so — matching the auth-gating
// convention used for other AI-calling proxy routes (routes_social.go,
// routes_mvp.go) — they're kept behind authMiddleware to avoid unauthenticated
// abuse of the AI service.
func (s *Server) routesCareerIntelligence(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		// v1 routes
		r.Post("/api/v1/career-intelligence/skills-gap", s.handleGetSkillsGap)
		r.Post("/api/v1/career-intelligence/learning-path", s.handleGetLearningPath)
		r.Post("/api/v1/career-intelligence/salary-benchmark", s.handleGetSalaryBenchmark)
		r.Get("/api/v1/career-intelligence/trending-skills", s.handleGetTrendingSkills)
		r.Get("/api/v1/career/next-actions", s.handleCareerNextActions)
		r.Get("/api/v1/career-intelligence/next-actions", s.handleCareerNextActions)
		r.Post("/api/v1/career/scenario-plan", s.handleCareerScenarioPlan)
		r.Post("/api/v1/jobs/fit-matrix", s.handleJobFitMatrix)

		// aliases
		r.Post("/api/career-intelligence/skills-gap", s.handleGetSkillsGap)
		r.Post("/api/career-intelligence/learning-path", s.handleGetLearningPath)
		r.Post("/api/career-intelligence/salary-benchmark", s.handleGetSalaryBenchmark)
		r.Get("/api/career-intelligence/trending-skills", s.handleGetTrendingSkills)
		r.Get("/api/career/next-actions", s.handleCareerNextActions)
		r.Get("/api/career-intelligence/next-actions", s.handleCareerNextActions)
		r.Post("/api/career/scenario-plan", s.handleCareerScenarioPlan)
		r.Post("/api/jobs/fit-matrix", s.handleJobFitMatrix)
	})
}

// GoCareerIntelligenceRequest represents the incoming JSON request payload.
type GoCareerIntelligenceRequest struct {
	ResumeID           *int    `json:"resume_id"`
	JobDescriptionID   *int    `json:"job_description_id"`
	JobDescriptionText *string `json:"job_description_text"`
	TargetRole         *string `json:"target_role"`
	Location           *string `json:"location"`
}

// pythonRequest represents the payload forwarded to the Python AI service.
type pythonRequest struct {
	ResumeText     string `json:"resume_text"`
	JobDescription string `json:"job_description,omitempty"`
	TargetRole     string `json:"target_role,omitempty"`
	Location       string `json:"location,omitempty"`
}

// helper to format a string slice into a Postgres array literal string safely.
func pgStringArray(arr []string) string {
	if len(arr) == 0 {
		return "{}"
	}
	var buf strings.Builder
	buf.WriteByte('{')
	for i, val := range arr {
		if i > 0 {
			buf.WriteByte(',')
		}
		// Escape backslashes and double quotes
		escaped := strings.ReplaceAll(val, "\\", "\\\\")
		escaped = strings.ReplaceAll(escaped, "\"", "\\\"")
		buf.WriteByte('"')
		buf.WriteString(escaped)
		buf.WriteByte('"')
	}
	buf.WriteByte('}')
	return buf.String()
}

// fetchResumeText retrieves the resume text and its ID.
// If resumeID is nil or <= 0, retrieves the latest resume for the user.
func (s *Server) fetchResumeText(r *http.Request, userID string, resumeID *int) (string, int, error) {
	var originalText string
	var id int

	if resumeID != nil && *resumeID > 0 {
		query := `SELECT id, original_text FROM resumes WHERE id=$1 AND user_id=$2`
		err := s.DB.Conn.QueryRowContext(r.Context(), query, *resumeID, userID).Scan(&id, &originalText)
		if err != nil {
			return "", 0, err
		}
	} else {
		query := `SELECT id, original_text FROM resumes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`
		err := s.DB.Conn.QueryRowContext(r.Context(), query, userID).Scan(&id, &originalText)
		if err != nil {
			return "", 0, err
		}
	}
	return originalText, id, nil
}

// fetchJobDescriptionText retrieves the job description text.
func (s *Server) fetchJobDescriptionText(r *http.Request, userID string, jdID *int) (string, error) {
	if jdID == nil || *jdID <= 0 {
		return "", nil
	}
	var text string
	query := `SELECT text FROM job_descriptions WHERE id=$1 AND user_id=$2`
	err := s.DB.Conn.QueryRowContext(r.Context(), query, *jdID, userID).Scan(&text)
	if err != nil {
		return "", err
	}
	return text, nil
}

func (s *Server) handleGetSkillsGap(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID.String()

	var req GoCareerIntelligenceRequest
	if err := DecodeAndValidate(r, &req); err != nil && err != http.ErrBodyReadAfterClose {
		// Tolerate empty body for defaults
	}

	// Fetch resume
	resumeText, resumeID, err := s.fetchResumeText(r, userID, req.ResumeID)
	if err != nil {
		log.Printf("handleGetSkillsGap: failed to fetch resume: %v", err)
		s.respondError(w, http.StatusBadRequest, "No resume found. Please upload a resume first.")
		return
	}

	// Get Job Description
	var jdText string
	if req.JobDescriptionID != nil && *req.JobDescriptionID > 0 {
		var err error
		jdText, err = s.fetchJobDescriptionText(r, userID, req.JobDescriptionID)
		if err != nil {
			log.Printf("handleGetSkillsGap: failed to fetch job description: %v", err)
			s.respondError(w, http.StatusBadRequest, "Job description not found.")
			return
		}
	} else if req.JobDescriptionText != nil {
		jdText = *req.JobDescriptionText
	}

	targetRole := ""
	if req.TargetRole != nil {
		targetRole = *req.TargetRole
	}
	location := ""
	if req.Location != nil {
		location = *req.Location
	}

	// Forward to Python AI
	payload := pythonRequest{
		ResumeText:     resumeText,
		JobDescription: jdText,
		TargetRole:     targetRole,
		Location:       location,
	}

	result, err := s.AI.PostJSONWithHeaders("/api/v1/career-intelligence/skills-gap", payload, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleGetSkillsGap: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "AI skill gap analysis failed")
		return
	}

	// Extract skills to persist in user_skill_analyses
	var matchedSkills, missingSkills []string
	if ms, ok := result["matched_skills"].([]interface{}); ok {
		for _, s := range ms {
			if str, ok := s.(string); ok {
				matchedSkills = append(matchedSkills, str)
			}
		}
	}
	if mis, ok := result["missing_skills"].([]interface{}); ok {
		for _, s := range mis {
			if str, ok := s.(string); ok {
				missingSkills = append(missingSkills, str)
			}
		}
	}

	persistedTargetRole := targetRole
	if persistedTargetRole == "" {
		persistedTargetRole = "Software Engineer" // Fallback label
	}

	// Save to DB
	insertQuery := `
		INSERT INTO public.user_skill_analyses (user_id, resume_id, target_role, matched_skills, missing_skills, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`
	_, dbErr := s.DB.Conn.ExecContext(
		r.Context(),
		insertQuery,
		userID,
		resumeID,
		persistedTargetRole,
		pgStringArray(matchedSkills),
		pgStringArray(missingSkills),
	)
	if dbErr != nil {
		log.Printf("handleGetSkillsGap: DB insert failed: %v", dbErr)
		// Don't fail the request if DB logging fails, just log it.
	}

	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleGetLearningPath(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID.String()

	var req GoCareerIntelligenceRequest
	if err := DecodeAndValidate(r, &req); err != nil && err != http.ErrBodyReadAfterClose {
		// Tolerate empty body
	}

	// Fetch resume
	resumeText, _, err := s.fetchResumeText(r, userID, req.ResumeID)
	if err != nil {
		log.Printf("handleGetLearningPath: failed to fetch resume: %v", err)
		s.respondError(w, http.StatusBadRequest, "No resume found. Please upload a resume first.")
		return
	}

	// Get Job Description
	var jdText string
	if req.JobDescriptionID != nil && *req.JobDescriptionID > 0 {
		var err error
		jdText, err = s.fetchJobDescriptionText(r, userID, req.JobDescriptionID)
		if err != nil {
			log.Printf("handleGetLearningPath: failed to fetch job description: %v", err)
			s.respondError(w, http.StatusBadRequest, "Job description not found.")
			return
		}
	} else if req.JobDescriptionText != nil {
		jdText = *req.JobDescriptionText
	}

	targetRole := ""
	if req.TargetRole != nil {
		targetRole = *req.TargetRole
	}
	location := ""
	if req.Location != nil {
		location = *req.Location
	}

	// Forward to Python AI
	payload := pythonRequest{
		ResumeText:     resumeText,
		JobDescription: jdText,
		TargetRole:     targetRole,
		Location:       location,
	}

	result, err := s.AI.PostJSONWithHeaders("/api/v1/career-intelligence/learning-path", payload, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleGetLearningPath: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "AI learning path generation failed")
		return
	}

	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleGetSalaryBenchmark(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID.String()

	var req GoCareerIntelligenceRequest
	if err := DecodeAndValidate(r, &req); err != nil && err != http.ErrBodyReadAfterClose {
		// Tolerate empty body
	}

	// Fetch resume (even if Python uses defaults, it expects resume_text in the schema)
	resumeText, _, err := s.fetchResumeText(r, userID, req.ResumeID)
	if err != nil {
		// Default to dummy string if no resume exists, as salary benchmark is less resume-dependent
		resumeText = "No resume text"
	}

	targetRole := "Software Engineer"
	if req.TargetRole != nil && *req.TargetRole != "" {
		targetRole = *req.TargetRole
	}
	location := "US"
	if req.Location != nil && *req.Location != "" {
		location = *req.Location
	}

	payload := pythonRequest{
		ResumeText: resumeText,
		TargetRole: targetRole,
		Location:   location,
	}

	result, err := s.AI.PostJSONWithHeaders("/api/v1/career-intelligence/salary-benchmark", payload, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleGetSalaryBenchmark: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "AI salary benchmarking failed")
		return
	}

	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleGetTrendingSkills(w http.ResponseWriter, r *http.Request) {
	// Python registers this as @router.get (no body param) — POST 405s.
	result, err := s.AI.GetJSON("/api/v1/career-intelligence/trending-skills")
	if err != nil {
		log.Printf("handleGetTrendingSkills: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "ai_service_unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerNextActions(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	headers := s.getXUserHeaders(r)
	if s.AI == nil {
		s.respondJSON(w, http.StatusOK, map[string]interface{}{"actions": []interface{}{}})
		return
	}

	result, err := s.AI.GetJSONWithHeaders("/api/v1/career/next-actions", headers)
	if err != nil {
		log.Printf("handleCareerNextActions: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch career next actions")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerScenarioPlan(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if s.AI == nil {
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	result, err := s.AI.PostJSONWithHeaders("/api/v1/career/scenario-plan", body, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleCareerScenarioPlan: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to generate scenario plan")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleJobFitMatrix(w http.ResponseWriter, r *http.Request) {
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if s.AI == nil {
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	result, err := s.AI.PostJSONWithHeaders("/api/v1/jobs/fit-matrix", body, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleJobFitMatrix: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to calculate job fit matrix")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

