package api

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func moderateInterviewContent(company, role, question, answer string) (string, string) {
	if strings.TrimSpace(question) == "" {
		return "rejected", "An interview question is required."
	}
	content := strings.ToLower(strings.Join([]string{company, role, question, answer}, " "))
	flagged := []string{
		"password", "passcode", "api key", "access token", "secret key",
		"social security", "ssn", "confidential", "non-disclosure", "nda",
		"recruiter@", "interviewer@", "127.0.0.1", "localhost", ".internal", ".corp",
	}
	for _, token := range flagged {
		if strings.Contains(content, token) {
			return "rejected", "Potential private or confidential information detected."
		}
	}
	return "pending", ""
}

func (s *Server) handleReportInterviewQuestion(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Reason  string `json:"reason"`
		Details string `json:"details"`
	}
	allowed := map[string]bool{"privacy": true, "confidential": true, "harassment": true, "spam": true, "other": true}
	if err := DecodeAndValidate(r, &req); err != nil || !allowed[req.Reason] {
		s.respondError(w, http.StatusBadRequest, "invalid report reason")
		return
	}
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to open report")
		return
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(r.Context(), `INSERT INTO interview_question_reports (question_id, reporter_id, reason, details) VALUES ($1,$2,$3,$4) ON CONFLICT (question_id, reporter_id) DO NOTHING`, id, user.ID, req.Reason, strings.TrimSpace(req.Details))
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to report experience")
		return
	}
	_, err = tx.ExecContext(r.Context(), `UPDATE shared_interview_questions SET report_count = report_count + 1, moderation_status = CASE WHEN report_count + 1 >= 3 THEN 'pending' ELSE moderation_status END, updated_at = NOW() WHERE id=$1`, id)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to update report count")
		return
	}
	if err := tx.Commit(); err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to save report")
		return
	}
	s.respondJSON(w, http.StatusCreated, map[string]bool{"reported": true})
}

func (s *Server) handleListPendingInterviewQuestions(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	if user.Role != "admin" {
		s.respondError(w, http.StatusForbidden, "Forbidden: admin role required")
		return
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}

	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT id, user_id, COALESCE(company, ''), COALESCE(role, ''), question_text,
		        COALESCE(answer_text, ''), COALESCE(category, 'behavioral'), visibility,
		        moderation_status, COALESCE(moderation_reason, ''), created_at
		 FROM shared_interview_questions
		 WHERE moderation_status = 'pending'
		 ORDER BY created_at DESC
		 LIMIT 50`,
	)
	if err != nil {
		slog.Error("handleListPendingInterviewQuestions: query failed", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load moderation queue")
		return
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, uid, co, role, qt, at, cat, vis, modStatus, modReason string
		var createdAt time.Time
		if err := rows.Scan(&id, &uid, &co, &role, &qt, &at, &cat, &vis, &modStatus, &modReason, &createdAt); err != nil {
			slog.Error("handleListPendingInterviewQuestions: scan failed", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to scan pending question")
			return
		}
		list = append(list, map[string]interface{}{
			"id":                id,
			"user_id":           uid,
			"company":           co,
			"role":              role,
			"question_text":     qt,
			"answer_text":       at,
			"category":          cat,
			"visibility":        vis,
			"moderation_status": modStatus,
			"moderation_reason": modReason,
			"created_at":        createdAt.Format(time.RFC3339),
		})
	}
	if err := rows.Err(); err != nil {
		slog.Error("handleListPendingInterviewQuestions: rows iteration failed", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load moderation queue")
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *Server) handleModerateInterviewQuestion(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	if user.Role != "admin" {
		s.respondError(w, http.StatusForbidden, "Forbidden: admin role required")
		return
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}

	rawID := chi.URLParam(r, "id")
	questionID, err := uuid.Parse(rawID)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid question id")
		return
	}

	var req struct {
		Action string `json:"action"` // "approve" or "reject"
		Reason string `json:"reason"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid moderation payload")
		return
	}

	targetStatus := "approved"
	if req.Action == "reject" {
		targetStatus = "rejected"
	} else if req.Action != "approve" {
		s.respondError(w, http.StatusBadRequest, "action must be approve or reject")
		return
	}

	res, err := s.DB.Conn.ExecContext(r.Context(),
		`UPDATE shared_interview_questions
		 SET moderation_status = $1, moderation_reason = $2, moderated_at = NOW(), moderated_by = $3
		 WHERE id = $4`,
		targetStatus, strings.TrimSpace(req.Reason), user.ID, questionID,
	)
	if err != nil {
		slog.Error("handleModerateInterviewQuestion: update failed", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to update moderation status")
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		s.respondError(w, http.StatusNotFound, "Question not found")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":                rawID,
		"moderation_status": targetStatus,
		"moderation_reason": req.Reason,
	})
}

