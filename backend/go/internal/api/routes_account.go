package api

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"tayari-backend/internal/models"
)

// exportJSONRows runs a query expected to return a single JSON array column
// (typically `SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (...) t`)
// and returns it as raw JSON. Failures are logged and degrade to an empty
// array so one missing/renamed table can't fail the whole export.
func (s *Server) exportJSONRows(ctx context.Context, query string, args ...interface{}) json.RawMessage {
	var raw []byte
	if err := s.DB.Conn.QueryRowContext(ctx, query, args...).Scan(&raw); err != nil {
		log.Printf("handleExportAccount: query failed (%s): %v", query, err)
		return json.RawMessage("[]")
	}
	return json.RawMessage(raw)
}

// handleDeleteAccount performs a hard cascade delete of all user data (GDPR B3).
// DELETE /api/v1/account  |  DELETE /api/account
func (s *Server) handleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	uid := user.ID.String()

	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("handleDeleteAccount: begin tx failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to start deletion")
		return
	}
	defer tx.Rollback()

	cascadeQueries := []string{
		`DELETE FROM autopilot_runs WHERE user_id=$1`,
		`DELETE FROM autopilot_schedules WHERE user_id=$1`,
		`DELETE FROM application_outcomes WHERE user_id=$1`,
		`DELETE FROM applications WHERE user_id=$1`,
		`DELETE FROM resume_versions rv USING resumes res WHERE rv.resume_id=res.id AND res.user_id=$1`,
		`DELETE FROM resumes WHERE user_id=$1`,
		`DELETE FROM job_descriptions WHERE user_id=$1`,
		`DELETE FROM saved_jobs WHERE user_id=$1`,
		`DELETE FROM user_skill_analyses WHERE user_id=$1`,
		`DELETE FROM conversations WHERE user_id=$1`,
		// "user_preferences" doesn't exist — the real table backing the
		// /api/v1/preferences proxy (routes_memory.go) and preference_learning.py
		// is user_job_feedback (user_preference_summary is a matview over it,
		// nothing to delete there directly).
		`DELETE FROM user_job_feedback WHERE user_id=$1`,
		`DELETE FROM communications WHERE user_id=$1`,
		`DELETE FROM connections WHERE requester_id=$1 OR addressee_id=$1`,
		`DELETE FROM question_upvotes WHERE user_id=$1`,
		`DELETE FROM shared_interview_questions WHERE user_id=$1`,
		`DELETE FROM memberships WHERE user_id=$1`,
		`DELETE FROM push_subscriptions WHERE user_id=$1`,
		`DELETE FROM user_subscriptions WHERE user_id=$1`,
		`DELETE FROM public.profiles WHERE id=$1`,
		`DELETE FROM auth.users WHERE id=$1`,
	}

	for _, q := range cascadeQueries {
		if _, err := tx.ExecContext(r.Context(), q, uid); err != nil {
			log.Printf("handleDeleteAccount: cascade delete failed (%s): %v", q, err)
			s.respondError(w, http.StatusInternalServerError, "Deletion failed")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("handleDeleteAccount: commit failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Deletion failed")
		return
	}

	log.Printf("[GDPR] Account hard-deleted: user_id=%s at %s", uid, time.Now().UTC().Format(time.RFC3339))
	s.respondJSON(w, http.StatusOK, map[string]string{
		"status":  "deleted",
		"user_id": uid,
	})
}

// handleExportAccount gathers all user data and returns a ZIP export (GDPR B3).
// GET /api/v1/account/export  |  GET /api/account/export
func (s *Server) handleExportAccount(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	uid := user.ID.String()
	ctx := r.Context()

	export := map[string]interface{}{
		"exported_at": time.Now().UTC().Format(time.RFC3339),
		"user_id":     uid,
	}

	// Profile
	var profileJSON []byte
	if err := s.DB.Conn.QueryRowContext(ctx,
		`SELECT row_to_json(p) FROM public.profiles p WHERE id=$1`, uid,
	).Scan(&profileJSON); err == nil {
		export["profile"] = json.RawMessage(profileJSON)
	}

	// Resumes
	rows, err := s.DB.Conn.QueryContext(ctx,
		`SELECT id, title, original_text, created_at FROM resumes WHERE user_id=$1 ORDER BY created_at DESC`, uid)
	if err == nil {
		defer rows.Close()
		resumes := []map[string]interface{}{}
		for rows.Next() {
			var id int
			var title, text string
			var createdAt time.Time
			if err := rows.Scan(&id, &title, &text, &createdAt); err == nil {
				resumes = append(resumes, map[string]interface{}{
					"id": id, "title": title, "original_text": text,
					"created_at": createdAt.Format(time.RFC3339),
				})
			}
		}
		export["resumes"] = resumes
	}

	// Applications
	appRows, err := s.DB.Conn.QueryContext(ctx,
		`SELECT application_id, title, company, stage, status, created_at FROM applications WHERE user_id=$1 ORDER BY created_at DESC`, uid)
	if err == nil {
		defer appRows.Close()
		apps := []map[string]interface{}{}
		for appRows.Next() {
			var appID, title, company, stage, status string
			var createdAt time.Time
			if err := appRows.Scan(&appID, &title, &company, &stage, &status, &createdAt); err == nil {
				apps = append(apps, map[string]interface{}{
					"id": appID, "title": title, "company": company,
					"stage": stage, "status": status,
					"created_at": createdAt.Format(time.RFC3339),
				})
			}
		}
		export["applications"] = apps
	}

	export["autopilot_runs"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT run_id, config, status, progress, current_step, logs, applications_created, error, created_at, updated_at
			FROM autopilot_runs WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	export["autopilot_schedules"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT schedule_id, frequency, config, active, next_run_at, last_run_at, created_at
			FROM autopilot_schedules WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	export["job_descriptions"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, title, company, text, created_at
			FROM job_descriptions WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	export["saved_jobs"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, dedupe_key, job, status, saved_at, updated_at
			FROM saved_jobs WHERE user_id=$1 ORDER BY saved_at DESC) t`, uid)

	export["user_skill_analyses"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, resume_id, target_role, matched_skills, missing_skills, created_at
			FROM user_skill_analyses WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	export["conversations"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, title, messages, summary, context_type, related_job_id, is_archived, created_at, updated_at
			FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC) t`, uid)

	export["user_job_feedback"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, job_id, job_title, company_name, feedback_type, feedback_source, metadata, created_at
			FROM user_job_feedback WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	export["communications"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, application_id, comm_type, job_title, company_name, subject, body, response_status, created_at, responded_at
			FROM communications WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	export["connections"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, requester_id, addressee_id, status, created_at, updated_at
			FROM connections WHERE requester_id=$1 OR addressee_id=$1 ORDER BY created_at DESC) t`, uid)

	export["shared_interview_questions"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT q.id, q.company, q.role, q.question_text, q.answer_text, q.category, q.visibility,
			       (SELECT COUNT(*) FROM question_upvotes qu WHERE qu.question_id = q.id) AS upvotes,
			       q.created_at, q.updated_at
			FROM shared_interview_questions q WHERE q.user_id=$1 ORDER BY q.created_at DESC) t`, uid)

	export["application_outcomes"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, application_id, recruiter_reply, phone_screen, technical_interview, final_interview,
			       offer_received, offer_accepted, salary_offered, outcome_date, notes, created_at, updated_at
			FROM application_outcomes WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	export["memberships"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, tenant_id, role, created_at
			FROM memberships WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	export["push_subscriptions"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, endpoint, created_at
			FROM push_subscriptions WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	export["user_subscriptions"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT plan, status, stripe_customer_id, stripe_subscription_id, metered_limit, requests_used, current_period_end, created_at, updated_at
			FROM user_subscriptions WHERE user_id=$1) t`, uid)

	export["privacy_audit_log"] = s.exportJSONRows(ctx,
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, action, resource, detail, created_at
			FROM privacy_audit_log WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	exportJSON, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Export generation failed")
		return
	}

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, err := zw.Create("tayari_data_export.json")
	if err != nil {
		log.Printf("handleExportAccount: zip create failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Export generation failed")
		return
	}
	if _, err := f.Write(exportJSON); err != nil {
		log.Printf("handleExportAccount: zip write failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Export generation failed")
		return
	}
	if err := zw.Close(); err != nil {
		log.Printf("handleExportAccount: zip close failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Export generation failed")
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="tayari_export.zip"`)
	w.WriteHeader(http.StatusOK)
	w.Write(buf.Bytes())
}
