package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"tayari-backend/internal/models"
)

func (s *Server) handleAnalyzeText(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ResumeText         string `json:"resume_text"`
		JobDescription     string `json:"job_description"`
		CustomInstructions string `json:"custom_instructions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ResumeText == "" {
		s.respondError(w, http.StatusBadRequest, "resume_text is required")
		return
	}
	if req.JobDescription == "" {
		s.respondError(w, http.StatusBadRequest, "job_description is required")
		return
	}

	result, err := s.AI.PostJSON("/api/v1/resumes/analyze-text", req)
	if err != nil {
		log.Printf("handleAnalyzeText: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "AI analysis failed")
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
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT original_text FROM resumes WHERE id=$1 AND user_id=$2", id, user.ID).Scan(&resumeText); err != nil {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}
	var req struct {
		JobDescription     string `json:"job_description"`
		CustomInstructions string `json:"custom_instructions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// job description might be empty / optional in some contexts, but should be handled
	}

	aiReq := map[string]interface{}{
		"resume_text":         resumeText,
		"job_description":     req.JobDescription,
		"custom_instructions": req.CustomInstructions,
	}

	result, err := s.AI.PostJSON("/api/v1/resumes/analyze-text", aiReq)
	if err != nil {
		log.Printf("handleAnalyzeResume: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "AI analysis failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}
