package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"tayari-backend/internal/auth"
)

const (
	verificationTruthThreshold  = 70.0
	verificationScreenThreshold = 60.0
)

type verificationRow struct {
	Status          string     `json:"status"`
	TruthfulScore   *float64   `json:"truthful_score"`
	RedFlags        []string   `json:"red_flags"`
	ScreeningScore  *float64   `json:"screening_score"`
	Strengths       []string   `json:"strengths"`
	Gaps            []string   `json:"gaps"`
	SampleQuestions []string   `json:"sample_questions"`
	VerifiedAt      *time.Time `json:"verified_at"`
}

func toFloat(v interface{}) *float64 {
	switch n := v.(type) {
	case float64:
		return &n
	case int:
		f := float64(n)
		return &f
	default:
		return nil
	}
}

func toStringSlice(v interface{}) []string {
	items, ok := v.([]interface{})
	if !ok {
		return []string{}
	}
	out := make([]string, 0, len(items))
	for _, it := range items {
		if s, ok := it.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

// computeVerification derives the verdict row from the Python AI result.
// Pure: no I/O — unit-testable without a database.
//
// Verified is determined solely by the LLM scores: truthful_score >= 70 and
// screening_score >= 60. The historical evidence != "resume_only" rejection
// is removed — the verification flow always emits "resume_only", which
// prevented every submission from ever reaching verified status.
func computeVerification(ai map[string]interface{}) verificationRow {
	truthful := toFloat(ai["truthful_score"])
	screening := toFloat(ai["screening_score"])
	row := verificationRow{
		Status:          "unverified",
		TruthfulScore:   truthful,
		RedFlags:        toStringSlice(ai["red_flags"]),
		ScreeningScore:  screening,
		Strengths:       toStringSlice(ai["strengths"]),
		Gaps:            toStringSlice(ai["gaps"]),
		SampleQuestions: toStringSlice(ai["sample_questions"]),
	}
	if truthful != nil && screening != nil &&
		*truthful >= verificationTruthThreshold && *screening >= verificationScreenThreshold {
		row.Status = "verified"
		now := time.Now().UTC()
		row.VerifiedAt = &now
	}
	return row
}

// extractAIErrorCode returns the upstream JSON error code from an ai.Client
// error of the form "AI service returned %d: %s" (the %s is the upstream body,
// e.g. {"error":"ai_service_unavailable"}). Empty string when not parseable.
func extractAIErrorCode(err error) string {
	msg := err.Error()
	const prefix = "AI service returned "
	if !strings.HasPrefix(msg, prefix) {
		return ""
	}
	rest := strings.TrimPrefix(msg, prefix)
	colon := strings.Index(rest, ": ")
	if colon < 0 {
		return ""
	}
	body := rest[colon+2:]
	var payload struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil || payload.Error == "" {
		return ""
	}
	return payload.Error
}

// handleVerificationSubmit proxies resume text to the Python scorers and
// persists the verdict. Go is authoritative for the DB (ADR-0003); Python
// stays stateless.
func (s *Server) handleVerificationSubmit(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	var req struct {
		ResumeText string `json:"resume_text"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	resumeText := strings.TrimSpace(req.ResumeText)
	if resumeText == "" {
		s.respondError(w, http.StatusUnprocessableEntity, "resume_text is required")
		return
	}
	if utf8.RuneCountInString(resumeText) > 65536 {
		s.respondError(w, http.StatusBadRequest, "resume_text too large (max 65536 chars)")
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "Database unavailable")
		return
	}

	aiResult, err := s.AI.PostJSONWithHeaders("/api/v1/verification/submit", map[string]interface{}{
		"resume_text": resumeText,
	}, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleVerificationSubmit: AI scoring failed: %v", err)
		if s.respondAICircuitOpen(w, err) {
			return
		}
		if status, ok := extractAIStatus(err); ok {
			code := extractAIErrorCode(err)
			if code == "" {
				code = "Upstream AI service error"
			}
			s.respondError(w, status, code)
			return
		}
		s.respondError(w, http.StatusServiceUnavailable, "ai_service_unavailable")
		return
	}

	row := computeVerification(aiResult)

	redFlagsJSON, _ := json.Marshal(row.RedFlags)
	strengthsJSON, _ := json.Marshal(row.Strengths)
	gapsJSON, _ := json.Marshal(row.Gaps)
	questionsJSON, _ := json.Marshal(row.SampleQuestions)

	query := `INSERT INTO candidate_verification
		(user_id, status, truthful_score, red_flags, screening_score, strengths, gaps, sample_questions, verified_at, updated_at)
		VALUES ($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			status = EXCLUDED.status,
			truthful_score = EXCLUDED.truthful_score,
			red_flags = EXCLUDED.red_flags,
			screening_score = EXCLUDED.screening_score,
			strengths = EXCLUDED.strengths,
			gaps = EXCLUDED.gaps,
			sample_questions = EXCLUDED.sample_questions,
			verified_at = EXCLUDED.verified_at,
			updated_at = NOW()`
	if _, err := s.DB.Conn.ExecContext(r.Context(), query,
		user.ID, row.Status, row.TruthfulScore, string(redFlagsJSON), row.ScreeningScore,
		string(strengthsJSON), string(gapsJSON), string(questionsJSON), row.VerifiedAt,
	); err != nil {
		log.Printf("handleVerificationSubmit: persist failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to persist verification")
		return
	}

	s.respondJSON(w, http.StatusOK, row)
}

// handleVerificationStatus returns the stored verification row, or an
// unverified shape when none exists yet (one happy-path response for the UI).
func (s *Server) handleVerificationStatus(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	row := verificationRow{
		Status:          "unverified",
		RedFlags:        []string{},
		Strengths:       []string{},
		Gaps:            []string{},
		SampleQuestions: []string{},
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database_unavailable")
		return
	}

	query := `SELECT status, truthful_score, red_flags, screening_score, strengths, gaps, sample_questions, verified_at
		FROM candidate_verification WHERE user_id = $1`
	var redFlagsJSON, strengthsJSON, gapsJSON, questionsJSON string
	err := s.DB.Conn.QueryRowContext(r.Context(), query, user.ID).Scan(
		&row.Status, &row.TruthfulScore, &redFlagsJSON, &row.ScreeningScore,
		&strengthsJSON, &gapsJSON, &questionsJSON, &row.VerifiedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			s.respondJSON(w, http.StatusOK, row)
			return
		}
		log.Printf("handleVerificationStatus: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load verification status")
		return
	}

	var redFlags, strengths, gaps, questions []string
	_ = json.Unmarshal([]byte(redFlagsJSON), &redFlags)
	_ = json.Unmarshal([]byte(strengthsJSON), &strengths)
	_ = json.Unmarshal([]byte(gapsJSON), &gaps)
	_ = json.Unmarshal([]byte(questionsJSON), &questions)
	row.RedFlags = redFlags
	row.Strengths = strengths
	row.Gaps = gaps
	row.SampleQuestions = questions

	s.respondJSON(w, http.StatusOK, row)
}
