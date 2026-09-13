package api

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func moderateInterviewContent(company, role, question, answer string) (string, string) {
	content := strings.ToLower(strings.Join([]string{company, role, question, answer}, " "))
	blocked := []string{"password", "passcode", "api key", "access token", "secret key", "social security", "ssn", "confidential", "non-disclosure", "nda", "recruiter@", "interviewer@"}
	for _, token := range blocked {
		if strings.Contains(content, token) {
			return "rejected", "Potential private or confidential information detected. Remove it before sharing."
		}
	}
	if strings.TrimSpace(question) == "" {
		return "rejected", "An interview question is required."
	}
	return "pending", "Awaiting community moderation review."
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
