package api

import (
	"context"
	"log"
	"net/http"
	"strconv"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
)

// routesAnalytics wires the predictive funnel analytics routes.
func (s *Server) routesAnalytics(r chi.Router) {
	r.Post("/api/v1/resumes/{id}/variants", s.handleCreateResumeVariant)
	r.Get("/api/v1/resumes/{id}/variants", s.handleListResumeVariants)
	r.Get("/api/v1/analytics/funnel", s.handleGetFunnel)
	r.Get("/api/v1/analytics/bandit-stats", s.handleGetBanditStats)
}

type CreateVariantRequest struct {
	Name         string `json:"name"`
	OriginalText string `json:"original_text"`
}

type VariantResponse struct {
	ID           int                    `json:"id"`
	ResumeID     int                    `json:"resume_id"`
	Name         string                 `json:"name"`
	OriginalText string                 `json:"original_text"`
	Scores       map[string]interface{} `json:"scores"`
	Pulls        int                    `json:"pulls"`
	Conversions  int                    `json:"conversions"`
	CreatedAt    string                 `json:"created_at"`
}

func (s *Server) handleCreateResumeVariant(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID.String()
	resumeIDStr := chi.URLParam(r, "id")
	resumeID, err := strconv.Atoi(resumeIDStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid resume_id")
		return
	}

	var req CreateVariantRequest
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" || req.OriginalText == "" {
		s.respondError(w, http.StatusBadRequest, "name and original_text are required")
		return
	}

	// 1. Verify resume belongs to user
	var exists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM resumes WHERE id=$1 AND user_id=$2)`
	err = s.DB.Conn.QueryRowContext(r.Context(), checkQuery, resumeID, userID).Scan(&exists)
	if err != nil || !exists {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}

	// 2. Call Python AI to generate scores
	pythonPayload := map[string]string{
		"resume_text":     req.OriginalText,
		"job_description": "", // no JD for general scoring on creation
	}
	scores, err := s.AI.PostJSON("/api/v1/predictive/score", pythonPayload)
	if err != nil {
		log.Printf("handleCreateResumeVariant: AI score failed: %v", err)
		// Fallback mock scores
		scores = map[string]interface{}{
			"formatting_score":  75,
			"metrics_score":     60,
			"readability_score": 80,
			"keyword_score":     70,
			"overall_score":     71,
		}
	}

	// 3. Save variant to DB
	var id int
	var createdAt string
	insertQuery := `INSERT INTO public.resume_variants (resume_id, name, original_text, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, created_at`
	err = s.DB.Conn.QueryRowContext(r.Context(), insertQuery, resumeID, req.Name, req.OriginalText).Scan(&id, &createdAt)
	if err != nil {
		log.Printf("handleCreateResumeVariant: DB insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to save variant")
		return
	}

	// 4. Initialize A/B testing bandit stats for this variant
	_, _ = s.DB.Conn.ExecContext(r.Context(), `INSERT INTO public.ab_testing_bandit (variant_id, pulls, conversions) VALUES ($1, 0, 0)`, id)

	s.respondJSON(w, http.StatusCreated, VariantResponse{
		ID:           id,
		ResumeID:     resumeID,
		Name:         req.Name,
		OriginalText: req.OriginalText,
		Scores:       scores,
		Pulls:        0,
		Conversions:  0,
		CreatedAt:    createdAt,
	})
}

func (s *Server) handleListResumeVariants(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID.String()
	resumeIDStr := chi.URLParam(r, "id")
	resumeID, err := strconv.Atoi(resumeIDStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid resume_id")
		return
	}

	// Verify resume belongs to user
	var exists bool
	checkQuery := `SELECT EXISTS(SELECT 1 FROM resumes WHERE id=$1 AND user_id=$2)`
	err = s.DB.Conn.QueryRowContext(r.Context(), checkQuery, resumeID, userID).Scan(&exists)
	if err != nil || !exists {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}

	query := `
		SELECT v.id, v.resume_id, v.name, v.original_text, v.created_at, COALESCE(b.pulls, 0), COALESCE(b.conversions, 0)
		FROM public.resume_variants v
		LEFT JOIN public.ab_testing_bandit b ON v.id = b.variant_id
		WHERE v.resume_id = $1
		ORDER BY v.created_at DESC
	`
	rows, err := s.DB.Conn.QueryContext(r.Context(), query, resumeID)
	if err != nil {
		log.Printf("handleListResumeVariants: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to query variants")
		return
	}
	defer rows.Close()

	variants := []VariantResponse{}
	for rows.Next() {
		var v VariantResponse
		var createdAtTime interface{}
		err := rows.Scan(&v.ID, &v.ResumeID, &v.Name, &v.OriginalText, &createdAtTime, &v.Pulls, &v.Conversions)
		if err != nil {
			log.Printf("handleListResumeVariants: scan failed: %v", err)
			continue
		}

		// Parse mock scores for list display
		pythonPayload := map[string]string{
			"resume_text":     v.OriginalText,
			"job_description": "",
		}
		scores, err := s.AI.PostJSON("/api/v1/predictive/score", pythonPayload)
		if err != nil {
			scores = map[string]interface{}{
				"formatting_score":  70,
				"metrics_score":     50,
				"readability_score": 75,
				"keyword_score":     65,
				"overall_score":     65,
			}
		}
		v.Scores = scores
		variants = append(variants, v)
	}

	s.respondJSON(w, http.StatusOK, variants)
}

func (s *Server) handleGetFunnel(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID.String()

	query := `
		SELECT status, count(*) 
		FROM public.applications 
		WHERE user_id = $1 
		GROUP BY status
	`
	rows, err := s.DB.Conn.QueryContext(r.Context(), query, userID)
	if err != nil {
		log.Printf("handleGetFunnel: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to query funnel data")
		return
	}
	defer rows.Close()

	stages := map[string]int{
		"saved":     0,
		"applied":   0,
		"interview": 0,
		"offer":     0,
	}

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err == nil {
			stages[status] = count
		}
	}

	s.respondJSON(w, http.StatusOK, stages)
}

func (s *Server) handleGetBanditStats(w http.ResponseWriter, r *http.Request) {
	user, _ := r.Context().Value(contextKeyUser).(*models.User)
	if user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID.String()

	// Query variant stats across user's resumes
	query := `
		SELECT v.id, v.name, r.title, COALESCE(b.pulls, 0), COALESCE(b.conversions, 0)
		FROM public.resume_variants v
		JOIN public.resumes r ON v.resume_id = r.id
		LEFT JOIN public.ab_testing_bandit b ON v.id = b.variant_id
		WHERE r.user_id = $1
		ORDER BY r.title, v.name
	`
	rows, err := s.DB.Conn.QueryContext(r.Context(), query, userID)
	if err != nil {
		log.Printf("handleGetBanditStats: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to query bandit stats")
		return
	}
	defer rows.Close()

	type BanditStat struct {
		VariantID   int    `json:"variant_id"`
		Name        string `json:"name"`
		ResumeTitle string `json:"resume_title"`
		Pulls       int    `json:"pulls"`
		Conversions int    `json:"conversions"`
	}

	stats := []BanditStat{}
	for rows.Next() {
		var s BanditStat
		if err := rows.Scan(&s.VariantID, &s.Name, &s.ResumeTitle, &s.Pulls, &s.Conversions); err == nil {
			stats = append(stats, s)
		}
	}

	s.respondJSON(w, http.StatusOK, stats)
}

// Helpers to increment pulls/conversions
func (s *Server) incrementBanditPull(ctx context.Context, variantID int) {
	if variantID <= 0 {
		return
	}
	_, err := s.DB.Conn.ExecContext(ctx, `UPDATE public.ab_testing_bandit SET pulls = pulls + 1 WHERE variant_id = $1`, variantID)
	if err != nil {
		log.Printf("incrementBanditPull failed: %v", err)
	}
}

func (s *Server) incrementBanditConversion(ctx context.Context, variantID int) {
	if variantID <= 0 {
		return
	}
	_, err := s.DB.Conn.ExecContext(ctx, `UPDATE public.ab_testing_bandit SET conversions = conversions + 1 WHERE variant_id = $1`, variantID)
	if err != nil {
		log.Printf("incrementBanditConversion failed: %v", err)
	}
}
