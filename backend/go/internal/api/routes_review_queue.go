package api

import (
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// -------------------------------------------------------------------
// Review Queue Routes
// -------------------------------------------------------------------

func (s *Server) routesReviewQueue(r chi.Router) {
	// Review Queue CRUD
	r.Get("/api/v1/review-queue", s.handleListReviewQueue)
	r.Get("/api/v1/review-queue/{id}", s.handleGetReviewQueueItem)
	r.Put("/api/v1/review-queue/{id}/approve", s.handleApproveReviewQueueItem)
	r.Put("/api/v1/review-queue/{id}/reject", s.handleRejectReviewQueueItem)
	r.Put("/api/v1/review-queue/{id}/modify", s.handleModifyReviewQueueItem)
	r.Put("/api/v1/review-queue/{id}/submit", s.handleSubmitApplication)
	r.Post("/api/v1/review-queue/bulk-action", s.handleBulkReviewQueueAction)
	r.Get("/api/v1/review-queue/stats", s.handleReviewQueueStats)
	r.Get("/api/v1/review-queue/history/{id}", s.handleReviewQueueHistory)
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
}

// -------------------------------------------------------------------
// Review Queue Handlers
// -------------------------------------------------------------------

func (s *Server) handleListReviewQueue(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	// Query parameters
	statusFilter := r.URL.Query().Get("status")
	if statusFilter == "" {
		statusFilter = "review"
	}
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	query := `
		SELECT id, application_id, run_id, job, tailored_resume_text, cover_letter, 
		       changes, keywords_added, ats_score_before, ats_score_after, 
		       is_dream_company, dream_score, status, submission_mode, apply_url, 
		       ai_suggestion, ai_confidence, review_notes, queued_at, reviewed_at, created_at, updated_at
		FROM applications 
		WHERE user_id=$1 AND status=$2 
		ORDER BY dream_score DESC, queued_at DESC 
		LIMIT $3
	`
	rows, err := s.DB.Conn.QueryContext(r.Context(), query, user.ID, statusFilter, limit)
	if err != nil {
		log.Printf("handleListReviewQueue: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch review queue")
		return
	}
	defer rows.Close()

	apps := []map[string]interface{}{}
	for rows.Next() {
		var a models.Application
		var runID, reviewedAt, queuedAt, aiSuggestion, reviewNotes interface{}
		var dreamScore, aiConfidence interface{}
		if err := rows.Scan(
			&a.ID, &a.ApplicationID, &runID, &a.Job, &a.TailoredResumeText, &a.CoverLetter,
			&a.Changes, &a.KeywordsAdded, &a.ATSScoreBefore, &a.ATSScoreAfter,
			&a.IsDreamCompany, &dreamScore, &a.Status, &a.SubmissionMode, &a.ApplyURL,
			&aiSuggestion, &aiConfidence, &reviewNotes, &queuedAt, &reviewedAt,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			continue
		}
		appMap := map[string]interface{}{
			"id":                   a.ID,
			"application_id":       a.ApplicationID,
			"job":                  a.Job,
			"tailored_resume_text": a.TailoredResumeText,
			"cover_letter":         a.CoverLetter,
			"changes":              a.Changes,
			"keywords_added":       a.KeywordsAdded,
			"ats_score_before":     a.ATSScoreBefore,
			"ats_score_after":      a.ATSScoreAfter,
			"is_dream_company":     a.IsDreamCompany,
			"status":               a.Status,
			"submission_mode":      a.SubmissionMode,
			"apply_url":            a.ApplyURL,
			"created_at":           a.CreatedAt,
			"updated_at":           a.UpdatedAt,
		}
		if runID != nil {
			appMap["run_id"] = runID
		}
		if dreamScore != nil {
			appMap["dream_score"] = dreamScore
		}
		if aiSuggestion != nil {
			appMap["ai_suggestion"] = aiSuggestion
		}
		if aiConfidence != nil {
			appMap["ai_confidence"] = aiConfidence
		}
		if reviewNotes != nil {
			appMap["review_notes"] = reviewNotes
		}
		if queuedAt != nil {
			appMap["queued_at"] = queuedAt
		}
		if reviewedAt != nil {
			appMap["reviewed_at"] = reviewedAt
		}
		apps = append(apps, appMap)
	}

	if err := rows.Err(); err != nil {
		log.Printf("handleListReviewQueue: rows iteration error: %v", err)
	}

	s.respondJSON(w, http.StatusOK, apps)
}

func (s *Server) handleGetReviewQueueItem(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")

	query := `
		SELECT id, application_id, run_id, job, tailored_resume_text, cover_letter,
		       changes, keywords_added, ats_score_before, ats_score_after,
		       is_dream_company, dream_score, status, submission_mode, apply_url,
		       ai_suggestion, ai_confidence, review_notes, queued_at, reviewed_at, created_at, updated_at
		FROM applications 
		WHERE application_id=$1 AND user_id=$2
	`
	var a models.Application
	var runID, reviewedAt, queuedAt, aiSuggestion, reviewNotes interface{}
	var dreamScore, aiConfidence interface{}
	err := s.DB.Conn.QueryRowContext(r.Context(), query, appIDStr, user.ID).Scan(
		&a.ID, &a.ApplicationID, &runID, &a.Job, &a.TailoredResumeText, &a.CoverLetter,
		&a.Changes, &a.KeywordsAdded, &a.ATSScoreBefore, &a.ATSScoreAfter,
		&a.IsDreamCompany, &dreamScore, &a.Status, &a.SubmissionMode, &a.ApplyURL,
		&aiSuggestion, &aiConfidence, &reviewNotes, &queuedAt, &reviewedAt,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Review queue item not found")
		return
	}

	appMap := map[string]interface{}{
		"id":                   a.ID,
		"application_id":       a.ApplicationID,
		"job":                  a.Job,
		"tailored_resume_text": a.TailoredResumeText,
		"cover_letter":         a.CoverLetter,
		"changes":              a.Changes,
		"keywords_added":       a.KeywordsAdded,
		"ats_score_before":     a.ATSScoreBefore,
		"ats_score_after":      a.ATSScoreAfter,
		"is_dream_company":     a.IsDreamCompany,
		"status":               a.Status,
		"submission_mode":      a.SubmissionMode,
		"apply_url":            a.ApplyURL,
		"created_at":           a.CreatedAt,
		"updated_at":           a.UpdatedAt,
	}
	if runID != nil {
		appMap["run_id"] = runID
	}
	if dreamScore != nil {
		appMap["dream_score"] = dreamScore
	}
	if aiSuggestion != nil {
		appMap["ai_suggestion"] = aiSuggestion
	}
	if aiConfidence != nil {
		appMap["ai_confidence"] = aiConfidence
	}
	if reviewNotes != nil {
		appMap["review_notes"] = reviewNotes
	}
	if queuedAt != nil {
		appMap["queued_at"] = queuedAt
	}
	if reviewedAt != nil {
		appMap["reviewed_at"] = reviewedAt
	}

	s.respondJSON(w, http.StatusOK, appMap)
}

func (s *Server) handleApproveReviewQueueItem(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")

	var req struct {
		Notes string `json:"notes,omitempty"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		req.Notes = ""
	}

	res, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications 
		SET status='saved', review_notes=$1, reviewed_at=NOW(), reviewed_by='user', updated_at=NOW()
		WHERE application_id=$2 AND user_id=$3 AND status='review'
	`, req.Notes, appIDStr, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to approve application")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Review queue item not found or already processed")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"application_id": appIDStr,
		"status":         "saved",
		"action":         "approved",
		"message":        "Application approved and moved to saved jobs",
	})
}

func (s *Server) handleRejectReviewQueueItem(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")

	var req struct {
		Reason string `json:"reason,omitempty"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		req.Reason = ""
	}

	res, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications 
		SET status='rejected', review_notes=$1, reviewed_at=NOW(), reviewed_by='user', updated_at=NOW()
		WHERE application_id=$2 AND user_id=$3 AND status='review'
	`, req.Reason, appIDStr, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to reject application")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Review queue item not found or already processed")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"application_id": appIDStr,
		"status":         "rejected",
		"action":         "rejected",
		"message":        "Application rejected",
	})
}

func (s *Server) handleModifyReviewQueueItem(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")

	var req struct {
		TailoredResumeText string                 `json:"tailored_resume_text,omitempty"`
		CoverLetter        string                 `json:"cover_letter,omitempty"`
		Notes              string                 `json:"notes,omitempty"`
		Status             string                 `json:"status,omitempty"`
		Changes            map[string]interface{} `json:"changes,omitempty"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Status == "" {
		req.Status = "review"
	}

	changesJSON := models.JSONMap(req.Changes)
	res, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications 
		SET tailored_resume_text=COALESCE(NULLIF($1, ''), tailored_resume_text),
		    cover_letter=COALESCE(NULLIF($2, ''), cover_letter),
		    review_notes=COALESCE(NULLIF($3, ''), review_notes),
		    status=$4,
		    changes=COALESCE($5, changes),
		    reviewed_at=NOW(),
		    reviewed_by='user',
		    updated_at=NOW()
		WHERE application_id=$6 AND user_id=$7
	`, req.TailoredResumeText, req.CoverLetter, req.Notes, req.Status, changesJSON, appIDStr, user.ID)
	if err != nil {
		log.Printf("handleModifyReviewQueueItem: update failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to modify application")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Review queue item not found")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"application_id": appIDStr,
		"status":         req.Status,
		"action":         "modified",
		"message":        "Application modified and kept in review queue",
	})
}

func (s *Server) handleBulkReviewQueueAction(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	var req struct {
		Action         string   `json:"action"`
		ApplicationIDs []string `json:"application_ids"`
		Notes          string   `json:"notes,omitempty"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Action == "" || len(req.ApplicationIDs) == 0 {
		s.respondError(w, http.StatusBadRequest, "action and application_ids are required")
		return
	}

	var newStatus string
	switch req.Action {
	case "approve":
		newStatus = "saved"
	case "reject":
		newStatus = "rejected"
	case "submit":
		newStatus = "applied"
	default:
		s.respondError(w, http.StatusBadRequest, "Invalid action. Must be 'approve', 'reject', or 'submit'")
		return
	}

	processed := 0
	failed := 0
	for _, appID := range req.ApplicationIDs {
		res, err := s.DB.Conn.ExecContext(r.Context(), `
			UPDATE applications 
			SET status=$1, review_notes=$2, reviewed_at=NOW(), reviewed_by='user', updated_at=NOW()
			WHERE application_id=$3 AND user_id=$4 AND status='review'
		`, newStatus, req.Notes, appID, user.ID)
		if err != nil {
			failed++
			continue
		}
		if rows, _ := res.RowsAffected(); rows > 0 {
			processed++
		} else {
			failed++
		}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"action":     req.Action,
		"processed":  processed,
		"failed":     failed,
		"total":      len(req.ApplicationIDs),
		"new_status": newStatus,
		"message":    fmt.Sprintf("Processed %d of %d applications", processed, len(req.ApplicationIDs)),
	})
}

func (s *Server) handleReviewQueueStats(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	var totalCount, dreamCount, highScoreCount, avgScore int
	_ = s.DB.Conn.QueryRowContext(r.Context(), `
		SELECT COUNT(*), COUNT(CASE WHEN is_dream_company=true THEN 1 END),
		       COUNT(CASE WHEN dream_score >= 70 THEN 1 END),
		       COALESCE(AVG(dream_score), 0)
		FROM applications WHERE user_id=$1 AND status='review'
	`, user.ID).Scan(&totalCount, &dreamCount, &highScoreCount, &avgScore)

	var approvedCount, rejectedCount, submittedCount int
	_ = s.DB.Conn.QueryRowContext(r.Context(), `
		SELECT 
		    COUNT(CASE WHEN status='saved' THEN 1 END),
		    COUNT(CASE WHEN status='rejected' THEN 1 END),
		    COUNT(CASE WHEN status='applied' THEN 1 END)
		FROM applications WHERE user_id=$1 AND reviewed_at IS NOT NULL
	`, user.ID).Scan(&approvedCount, &rejectedCount, &submittedCount)

	var oldestReview interface{}
	_ = s.DB.Conn.QueryRowContext(r.Context(), `
		SELECT MIN(queued_at) FROM applications WHERE user_id=$1 AND status='review'
	`, user.ID).Scan(&oldestReview)

	stats := map[string]interface{}{
		"pending_review":      totalCount,
		"dream_companies":     dreamCount,
		"high_score_count":    highScoreCount,
		"average_dream_score": avgScore,
		"lifetime_approved":   approvedCount,
		"lifetime_rejected":   rejectedCount,
		"lifetime_submitted":  submittedCount,
		"requires_action":     totalCount > 0,
	}
	if oldestReview != nil {
		stats["oldest_pending"] = oldestReview
	}

	s.respondJSON(w, http.StatusOK, stats)
}

func (s *Server) handleReviewQueueHistory(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")

	rows, err := s.DB.Conn.QueryContext(r.Context(), `
		SELECT action, previous_status, new_status, notes, metadata, created_at
		FROM review_queue_history
		WHERE application_id=$1 AND user_id=$2
		ORDER BY created_at DESC
	`, appIDStr, user.ID)
	if err != nil {
		log.Printf("handleReviewQueueHistory: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch review history")
		return
	}
	defer rows.Close()

	history := []map[string]interface{}{}
	for rows.Next() {
		var action, prevStatus, newStatus, notes string
		var metadata models.JSONMap
		var createdAt time.Time
		if err := rows.Scan(&action, &prevStatus, &newStatus, &notes, &metadata, &createdAt); err != nil {
			continue
		}
		history = append(history, map[string]interface{}{
			"action":          action,
			"previous_status": prevStatus,
			"new_status":      newStatus,
			"notes":           notes,
			"metadata":        metadata,
			"created_at":      createdAt,
		})
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"application_id": appIDStr,
		"history":        history,
	})
}

// -------------------------------------------------------------------
// Extension Integration: Queue Job for Review
// -------------------------------------------------------------------

func (s *Server) handleQueueApplicationForReview(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	var req struct {
		Job                map[string]interface{} `json:"job"`
		TailoredResumeText string                 `json:"tailored_resume_text,omitempty"`
		CoverLetter        string                 `json:"cover_letter,omitempty"`
		DreamScore         int                    `json:"dream_score,omitempty"`
		AISuggestion       string                 `json:"ai_suggestion,omitempty"`
		AIConfidence       float64                `json:"ai_confidence,omitempty"`
		ApplyURL           string                 `json:"apply_url,omitempty"`
		Notes              string                 `json:"notes,omitempty"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Job == nil {
		s.respondError(w, http.StatusBadRequest, "job is required")
		return
	}

	appID := uuid.New().String()
	query := `
		INSERT INTO applications (
			application_id, user_id, job, tailored_resume_text, cover_letter,
			status, dream_score, ai_suggestion, ai_confidence, apply_url, review_notes, queued_at, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, 'review', $6, $7, $8, $9, $10, NOW(), NOW(), NOW())
		RETURNING id
	`
	var id int
	err := s.DB.Conn.QueryRowContext(r.Context(), query,
		appID, user.ID, models.JSONMap(req.Job), req.TailoredResumeText, req.CoverLetter,
		req.DreamScore, req.AISuggestion, req.AIConfidence, req.ApplyURL, req.Notes,
	).Scan(&id)
	if err != nil {
		log.Printf("handleQueueApplicationForReview: insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to queue application for review")
		return
	}

	s.respondJSON(w, http.StatusCreated, map[string]interface{}{
		"id":             id,
		"application_id": appID,
		"status":         "review",
		"message":        "Application queued for review. Visit the Review Queue to approve or modify.",
	})
}

// -------------------------------------------------------------------
// Submit Application (from review queue to applied)
// -------------------------------------------------------------------

func (s *Server) handleSubmitApplication(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")

	var req struct {
		SubmissionMode string `json:"submission_mode,omitempty"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		req.SubmissionMode = "manual"
	}
	if req.SubmissionMode == "" {
		req.SubmissionMode = "manual"
	}
	if req.SubmissionMode != "manual" && req.SubmissionMode != "assisted" {
		s.respondError(w, http.StatusBadRequest, "submission_mode must be 'manual' or 'assisted'")
		return
	}

	res, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications 
		SET status='applied', submission_mode=$1, submission_verification_status='unverified', reviewed_at=NOW(), reviewed_by='user', updated_at=NOW()
		WHERE application_id=$2 AND user_id=$3 AND status IN ('review', 'saved')
	`, req.SubmissionMode, appIDStr, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to submit application")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Application not found or not in review queue")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"application_id":                 appIDStr,
		"status":                         "applied",
		"submission_mode":                req.SubmissionMode,
		"submission_verification_status": "unverified",
		"message":                        "Application recorded as candidate-confirmed. This is not an externally verified ATS submission receipt.",
	})
}
