package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
)

func (s *Server) handleAnalyzeText(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ResumeID           interface{} `json:"resume_id"`
		JDID               interface{} `json:"jd_id"`
		ResumeText         string      `json:"resume_text"`
		JobDescription     string      `json:"job_description"`
		CustomInstructions string      `json:"custom_instructions"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.ResumeText = strings.TrimSpace(req.ResumeText)
	req.JobDescription = strings.TrimSpace(req.JobDescription)
	user, authenticated := r.Context().Value(contextKeyUser).(*models.User)

	// Resolve source records only for authenticated callers and only from records
	// owned by that caller. Public text analysis must provide text directly.
	if req.ResumeText == "" && req.ResumeID != nil {
		if !authenticated || user == nil {
			s.respondError(w, http.StatusBadRequest, "resume_text is required for unauthenticated requests")
			return
		}
		resID := parsePositiveID(req.ResumeID)
		if resID == 0 || s.DB == nil || s.DB.Conn == nil || s.DB.Conn.QueryRowContext(r.Context(), "SELECT original_text FROM resumes WHERE id=$1 AND user_id=$2", resID, user.ID).Scan(&req.ResumeText) != nil {
			s.respondError(w, http.StatusBadRequest, "resume text is missing or the selected resume was not found")
			return
		}
		req.ResumeText = strings.TrimSpace(req.ResumeText)
	}

	if req.JobDescription == "" && req.JDID != nil {
		if !authenticated || user == nil {
			s.respondError(w, http.StatusBadRequest, "job_description is required for unauthenticated requests")
			return
		}
		jdID := parsePositiveID(req.JDID)
		if jdID == 0 || s.DB == nil || s.DB.Conn == nil || s.DB.Conn.QueryRowContext(r.Context(), "SELECT text FROM job_descriptions WHERE id=$1 AND user_id=$2", jdID, user.ID.String()).Scan(&req.JobDescription) != nil {
			s.respondError(w, http.StatusBadRequest, "job description is missing or the selected job description was not found")
			return
		}
		req.JobDescription = strings.TrimSpace(req.JobDescription)
	}

	if req.ResumeText == "" {
		s.respondError(w, http.StatusBadRequest, "resume_text is required or a valid owned resume_id must be provided")
		return
	}
	if req.JobDescription == "" {
		s.respondError(w, http.StatusBadRequest, "job_description is required or a valid owned jd_id must be provided")
		return
	}

	result, err := s.AI.PostJSONWithHeaders("/api/v1/resumes/analyze-text", req, s.getXUserHeaders(r))
	if err != nil || result == nil {
		log.Printf("handleAnalyzeText: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "ai_service_unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

const maxSafeFloat64ID = 9007199254740991.0 // 2^53 - 1

func parsePositiveID(value interface{}) int {
	switch v := value.(type) {
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return 0
		}
		if v != math.Trunc(v) {
			return 0
		}
		// ponytail: 2^53-1 is the largest integer float64 represents exactly;
		// beyond this int(v) can silently round/overflow. Use json.Number +
		// strconv.ParseInt if IDs must exceed float64 exact precision.
		if v < -maxSafeFloat64ID || v > maxSafeFloat64ID {
			return 0
		}
		id := int(v)
		if id < 1 {
			return 0
		}
		return id
	case string:
		v = strings.TrimSpace(v)
		id, err := strconv.Atoi(v)
		if err != nil || id < 1 {
			return 0
		}
		return id
	}
	return 0
}

// handleImportJobDescription forwards a public job-post URL to the Python
// service, which performs the security-sensitive validation and retrieval.
func (s *Server) handleImportJobDescription(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL string `json:"url"`
	}
	if err := DecodeAndValidate(r, &req); err != nil || strings.TrimSpace(req.URL) == "" {
		s.respondError(w, http.StatusBadRequest, "url is required")
		return
	}

	result, err := s.AI.PostJSONWithHeaders("/api/v1/job-descriptions/import", map[string]string{"url": strings.TrimSpace(req.URL)}, s.getXUserHeaders(r))
	if err != nil {
		errMsg := err.Error()
		status := http.StatusBadGateway
		if strings.HasPrefix(errMsg, "AI service returned ") {
			var upstreamStatus int
			_, _ = fmt.Sscanf(errMsg, "AI service returned %d:", &upstreamStatus)
			if upstreamStatus >= 400 && upstreamStatus < 500 {
				status = upstreamStatus
			}
		}
		log.Printf("handleImportJobDescription: AI call failed: %v", err)
		s.respondError(w, status, "job description import failed")
		return
	}
	if result == nil {
		log.Printf("handleImportJobDescription: AI call returned nil result")
		s.respondError(w, http.StatusBadGateway, "job description import failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleAnalyzeResume(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid resume id")
		return
	}
	var resumeText string
	if s.DB == nil || s.DB.Conn == nil {
		log.Printf("handleAnalyzeResume: DB unavailable for resume lookup")
		s.respondError(w, http.StatusServiceUnavailable, "resume lookup unavailable")
		return
	}
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT original_text FROM resumes WHERE id=$1 AND user_id=$2", id, user.ID).Scan(&resumeText); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			s.respondError(w, http.StatusNotFound, "Resume not found")
			return
		}
		// ponytail: runtime connection failures (the driver's connection is done,
		// the pool is exhausted, the server is unreachable) and request-context
		// timeouts are service-unavailable conditions, not server bugs — the
		// upstream database or network is temporarily down. Keep unexpected
		// lookup errors on 500.
		if errors.Is(err, sql.ErrConnDone) || errors.Is(err, context.DeadlineExceeded) {
			log.Printf("handleAnalyzeResume: resume lookup unavailable: %v", err)
			s.respondError(w, http.StatusServiceUnavailable, "resume lookup unavailable")
			return
		}
		log.Printf("handleAnalyzeResume: resume lookup failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "resume lookup failed")
		return
	}
	var req struct {
		JobDescription     string `json:"job_description"`
		CustomInstructions string `json:"custom_instructions"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		// job description optional
	}

	aiReq := map[string]interface{}{
		"resume_text":         resumeText,
		"job_description":     req.JobDescription,
		"custom_instructions": req.CustomInstructions,
	}

	result, err := s.AI.PostJSONWithHeaders("/api/v1/resumes/analyze-text", aiReq, s.getXUserHeaders(r))
	if err != nil || result == nil {
		log.Printf("handleAnalyzeResume: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "ai_service_unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCreateJD(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var req struct {
		Title   string `json:"title"`
		Company string `json:"company"`
		Text    string `json:"text"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Title == "" {
		req.Title = "Untitled Job Description"
	}

	var jd models.JobDescription
	jd.UserID = user.ID.String()
	jd.Title = req.Title
	jd.Company = req.Company
	jd.Text = req.Text

	err := s.DB.Conn.QueryRowContext(
		r.Context(),
		"INSERT INTO job_descriptions (user_id, title, company, text) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
		user.ID.String(), req.Title, req.Company, req.Text,
	).Scan(&jd.ID, &jd.CreatedAt)

	if err != nil {
		log.Printf("handleCreateJD insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create job description")
		return
	}

	s.respondJSON(w, http.StatusCreated, jd)
}

func (s *Server) handleListJDs(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	rows, err := s.DB.Conn.QueryContext(
		r.Context(),
		"SELECT id, user_id, title, company, text, created_at FROM job_descriptions WHERE user_id=$1 ORDER BY created_at DESC",
		user.ID.String(),
	)
	if err != nil {
		s.respondJSON(w, http.StatusOK, []models.JobDescription{})
		return
	}
	defer rows.Close()

	list := []models.JobDescription{}
	for rows.Next() {
		var jd models.JobDescription
		if err := rows.Scan(&jd.ID, &jd.UserID, &jd.Title, &jd.Company, &jd.Text, &jd.CreatedAt); err == nil {
			list = append(list, jd)
		}
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *Server) handleGetJD(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid job description id")
		return
	}

	var jd models.JobDescription
	err = s.DB.Conn.QueryRowContext(
		r.Context(),
		"SELECT id, user_id, title, company, text, created_at FROM job_descriptions WHERE id=$1 AND user_id=$2",
		id, user.ID.String(),
	).Scan(&jd.ID, &jd.UserID, &jd.Title, &jd.Company, &jd.Text, &jd.CreatedAt)

	if err != nil {
		s.respondError(w, http.StatusNotFound, "Job description not found")
		return
	}

	s.respondJSON(w, http.StatusOK, jd)
}
