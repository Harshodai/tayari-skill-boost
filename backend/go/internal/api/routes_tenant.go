package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (s *Server) routesTenant(r chi.Router) {
	// Note: public branding routes (/api/v1/tenants/branding) are registered in the
	// public route group in routes() to avoid CORS preflight auth failures.

	// Advisor routes (require auth and advisor/admin role)
	r.Group(func(sub chi.Router) {
		sub.Get("/api/v1/advisor/cohorts", s.handleListAdvisorCohorts)
		sub.Post("/api/v1/advisor/cohorts", s.handleCreateAdvisorCohort)
		sub.Get("/api/v1/advisor/students", s.handleListAdvisorStudents)
	})
}

func (s *Server) handleGetTenantBranding(w http.ResponseWriter, r *http.Request) {
	tenant, ok := r.Context().Value(contextKeyTenant).(*models.Tenant)
	if !ok || tenant == nil {
		// Return default Tayari branding
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"id":              nil,
			"name":            "Tayari",
			"domain":          "localhost",
			"logo_url":        nil,
			"primary_color":   "#6366f1",
			"secondary_color": "#4f46e5",
		})
		return
	}
	s.respondJSON(w, http.StatusOK, tenant)
}

func (s *Server) checkAdvisorRole(w http.ResponseWriter, r *http.Request) (*models.User, *models.Tenant, bool) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return nil, nil, false
	}

	tenant, _ := r.Context().Value(contextKeyTenant).(*models.Tenant)
	if tenant == nil {
		s.respondError(w, http.StatusBadRequest, "Tenant context missing")
		return nil, nil, false
	}

	// Verify membership and role
	var role string
	err := s.DB.Conn.QueryRowContext(r.Context(),
		"SELECT role FROM memberships WHERE tenant_id = $1 AND user_id = $2",
		tenant.ID, user.ID).Scan(&role)
	if err != nil {
		log.Printf("[TENANT] Membership not found for user:%s in tenant:%s: %v", user.ID, tenant.ID, err)
		s.respondError(w, http.StatusForbidden, "Forbidden: not a member of this tenant")
		return nil, nil, false
	}

	if role != "advisor" && role != "admin" {
		s.respondError(w, http.StatusForbidden, "Forbidden: advisor or admin role required")
		return nil, nil, false
	}

	return user, tenant, true
}

func (s *Server) handleListAdvisorCohorts(w http.ResponseWriter, r *http.Request) {
	_, tenant, ok := s.checkAdvisorRole(w, r)
	if !ok {
		return
	}

	rows, err := s.DB.Conn.QueryContext(r.Context(),
		"SELECT id, tenant_id, name, created_at FROM cohorts WHERE tenant_id = $1 ORDER BY name ASC",
		tenant.ID)
	if err != nil {
		log.Printf("handleListAdvisorCohorts: failed to query cohorts: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to query cohorts")
		return
	}
	defer rows.Close()

	var cohorts []models.Cohort
	for rows.Next() {
		var c models.Cohort
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.CreatedAt); err != nil {
			log.Printf("handleListAdvisorCohorts: scan error: %v", err)
			continue
		}
		cohorts = append(cohorts, c)
	}

	s.respondJSON(w, http.StatusOK, cohorts)
}

func (s *Server) handleCreateAdvisorCohort(w http.ResponseWriter, r *http.Request) {
	_, tenant, ok := s.checkAdvisorRole(w, r)
	if !ok {
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		s.respondError(w, http.StatusBadRequest, "Cohort name is required")
		return
	}

	var c models.Cohort
	err := s.DB.Conn.QueryRowContext(r.Context(),
		"INSERT INTO cohorts (tenant_id, name) VALUES ($1, $2) RETURNING id, tenant_id, name, created_at",
		tenant.ID, req.Name).Scan(&c.ID, &c.TenantID, &c.Name, &c.CreatedAt)
	if err != nil {
		log.Printf("handleCreateAdvisorCohort: insert error: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create cohort")
		return
	}

	s.respondJSON(w, http.StatusCreated, c)
}

type StudentProgress struct {
	ID                string  `json:"id"`
	FullName          string  `json:"full_name"`
	Email             string  `json:"email"`
	Headline          string  `json:"headline"`
	CohortID          *int    `json:"cohort_id"`
	CohortName        string  `json:"cohort_name"`
	ResumeCount       int     `json:"resume_count"`
	AvgInterviewScore float64 `json:"avg_interview_score"`
}

func (s *Server) handleListAdvisorStudents(w http.ResponseWriter, r *http.Request) {
	_, tenant, ok := s.checkAdvisorRole(w, r)
	if !ok {
		return
	}

	cohortIDStr := r.URL.Query().Get("cohort_id")

	var query string
	var args []interface{}
	args = append(args, tenant.ID)

	if cohortIDStr != "" {
		cohortID, err := strconv.Atoi(cohortIDStr)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Invalid cohort_id")
			return
		}
		query = `
			SELECT p.id, COALESCE(p.full_name, ''), p.email, COALESCE(p.headline, ''), p.cohort_id, COALESCE(c.name, ''),
				(SELECT COUNT(*) FROM resumes r WHERE r.user_id = p.id) as resume_count,
				COALESCE((SELECT AVG(iscore.overall_score) FROM public.interview_scores iscore JOIN public.interview_sessions sess ON iscore.session_id = sess.id WHERE sess.user_id = p.id), 0) as avg_interview_score
			FROM profiles p
			LEFT JOIN cohorts c ON p.cohort_id = c.id
			WHERE p.tenant_id = $1 AND p.cohort_id = $2
			ORDER BY p.full_name ASC`
		args = append(args, cohortID)
	} else {
		query = `
			SELECT p.id, COALESCE(p.full_name, ''), p.email, COALESCE(p.headline, ''), p.cohort_id, COALESCE(c.name, ''),
				(SELECT COUNT(*) FROM resumes r WHERE r.user_id = p.id) as resume_count,
				COALESCE((SELECT AVG(iscore.overall_score) FROM public.interview_scores iscore JOIN public.interview_sessions sess ON iscore.session_id = sess.id WHERE sess.user_id = p.id), 0) as avg_interview_score
			FROM profiles p
			LEFT JOIN cohorts c ON p.cohort_id = c.id
			WHERE p.tenant_id = $1
			ORDER BY p.full_name ASC`
	}

	rows, err := s.DB.Conn.QueryContext(r.Context(), query, args...)
	if err != nil {
		log.Printf("handleListAdvisorStudents: failed to query students: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to query students")
		return
	}
	defer rows.Close()

	var students []StudentProgress
	for rows.Next() {
		var sp StudentProgress
		var userID uuid.UUID
		if err := rows.Scan(&userID, &sp.FullName, &sp.Email, &sp.Headline, &sp.CohortID, &sp.CohortName, &sp.ResumeCount, &sp.AvgInterviewScore); err != nil {
			log.Printf("handleListAdvisorStudents: scan error: %v", err)
			continue
		}
		sp.ID = userID.String()
		students = append(students, sp)
	}

	s.respondJSON(w, http.StatusOK, students)
}
