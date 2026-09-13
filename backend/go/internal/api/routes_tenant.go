package api

import (
	"log"
	"net/http"
	"strings"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (s *Server) routesTenant(r chi.Router) {
	// Note: public branding routes (/api/v1/tenants/branding) are registered in the
	// public route group in routes() to avoid CORS preflight auth failures.

	// Advisor routes — require authentication AND advisor/admin role
	// (role verified inside checkAdvisorRole; auth middleware enforces token presence)
	r.Group(func(sub chi.Router) {
		sub.Use(s.authMiddleware)
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
	authorization, ok := auth.AuthorizationContextFromContext(r.Context())
	if !ok || authorization.Subject == uuid.Nil || authorization.TenantID == uuid.Nil {
		s.respondError(w, http.StatusUnauthorized, "Authorization context missing")
		return nil, nil, false
	}

	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil || user.ID != authorization.Subject {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return nil, nil, false
	}

	tenant, _ := r.Context().Value(contextKeyTenant).(*models.Tenant)
	if tenant == nil || tenant.ID != authorization.TenantID {
		s.respondError(w, http.StatusForbidden, "Forbidden: tenant context mismatch")
		return nil, nil, false
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "Tenant authorization unavailable")
		return nil, nil, false
	}

	// Verify current membership and role against the immutable subject/tenant
	// pair. A host/header-selected tenant can never authorize a different pair.
	var role string
	err := s.DB.Conn.QueryRowContext(r.Context(),
		"SELECT role FROM memberships WHERE tenant_id = $1 AND user_id = $2",
		authorization.TenantID, authorization.Subject).Scan(&role)
	if err != nil {
		log.Printf("[TENANT] Membership not found for user:%s in tenant:%s: %v", authorization.Subject, authorization.TenantID, err)
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
			s.respondError(w, http.StatusInternalServerError, "Failed to scan cohort")
			return
		}
		cohorts = append(cohorts, c)
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleListAdvisorCohorts: rows iteration error: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Database iteration error")
		return
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
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		s.respondError(w, http.StatusBadRequest, "Cohort name is required")
		return
	}

	cohortID := uuid.New()
	_, err := s.DB.Conn.ExecContext(r.Context(),
		`INSERT INTO cohorts (id, tenant_id, name, created_at)
		 VALUES ($1, $2, $3, NOW())`,
		cohortID, tenant.ID, name,
	)
	if err != nil {
		log.Printf("handleCreateAdvisorCohort: failed to create cohort: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create cohort")
		return
	}

	s.respondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":        cohortID.String(),
		"tenant_id": tenant.ID.String(),
		"name":      name,
	})
}

type StudentProgress struct {
	ID                string  `json:"id"`
	FullName          string  `json:"full_name"`
	Email             string  `json:"email"`
	Headline          string  `json:"headline"`
	CohortID          *uuid.UUID `json:"cohort_id"`
	CohortName        string  `json:"cohort_name"`
	ResumeCount       int     `json:"resume_count"`
	AvgInterviewScore float64 `json:"avg_interview_score"`
}

func (s *Server) handleListAdvisorStudents(w http.ResponseWriter, r *http.Request) {
	_, tenant, ok := s.checkAdvisorRole(w, r)
	if !ok {
		return
	}

	cohortIDFilter := r.URL.Query().Get("cohort_id")

	query := `
		SELECT
			u.id,
			COALESCE(p.full_name, '') as full_name,
			u.email,
			COALESCE(p.headline, '') as headline,
			m.cohort_id,
			COALESCE(c.name, 'Unassigned') as cohort_name,
			(SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) as resume_count,
			(SELECT COALESCE(AVG(score), 0) FROM interview_scores iscore WHERE iscore.user_id = u.id) as avg_interview_score
		FROM auth.users u
		JOIN memberships m ON m.user_id = u.id
		LEFT JOIN profiles p ON p.id = u.id
		LEFT JOIN cohorts c ON c.id = m.cohort_id
		WHERE m.tenant_id = $1 AND m.role = 'student'
	`
	args := []interface{}{tenant.ID}

	if cohortIDFilter != "" {
		cohortUUID, err := uuid.Parse(cohortIDFilter)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Invalid cohort_id format")
			return
		}
		query += ` AND m.cohort_id = $2`
		args = append(args, cohortUUID)
	}

	query += ` ORDER BY COALESCE(p.full_name, '') ASC`

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
			s.respondError(w, http.StatusInternalServerError, "Failed to scan student progress")
			return
		}
		sp.ID = userID.String()
		students = append(students, sp)
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleListAdvisorStudents: rows iteration error: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Database iteration error")
		return
	}

	s.respondJSON(w, http.StatusOK, students)
}
