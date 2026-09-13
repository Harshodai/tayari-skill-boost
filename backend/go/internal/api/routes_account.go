package api

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"tayari-backend/internal/models"
)

const (
	maxExportRows  = 1000
	maxExportBytes = 10 << 20
)

// deleteSupabaseUser deletes the user through GoTrue's admin API, which also
// revokes the user's sessions and refresh tokens. A 404 is fine (user already
// gone); anything else is returned so the caller can fall back to SQL.
func (s *Server) deleteSupabaseUser(ctx context.Context, userID string) error {
	url := strings.TrimRight(s.Config.SupabaseURL, "/") + "/auth/v1/admin/users/" + userID
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.Config.SupabaseServiceRoleKey)
	req.Header.Set("Authorization", "Bearer "+s.Config.SupabaseServiceRoleKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotFound {
		return nil
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	return fmt.Errorf("GoTrue admin delete: status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
}

// exportCategoryResult records the outcome of a single export category so the
// manifest.json can surface per-category success/failure to the caller.
type exportCategoryResult struct {
	Name     string `json:"name"`
	Status   string `json:"status"`             // "ok" | "error"
	RowCount int    `json:"row_count"`
	Error    string `json:"error,omitempty"`    // non-empty when Status == "error"
}

// exportJSONRows runs a query expected to return a single JSON array column
// (typically `SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (...) t`)
// and returns it as raw JSON plus any error. The caller decides how to handle
// the failure — unlike the old implementation, this function does NOT silently
// substitute [] and must not be used to mask DB errors from the export manifest.
func (s *Server) exportJSONRows(ctx context.Context, query string, args ...interface{}) (json.RawMessage, error) {
	var raw []byte
	if err := s.DB.Conn.QueryRowContext(ctx, query, args...).Scan(&raw); err != nil {
		log.Printf("handleExportAccount: query failed: %v", err)
		return json.RawMessage("[]"), err
	}
	return json.RawMessage(raw), nil
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

	if s.AI != nil {
		purgeCtx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		err := s.AI.PurgeUserRuntime(purgeCtx, uid)
		cancel()
		if err != nil {
			log.Printf("handleDeleteAccount: runtime purge failed: %v", err)
			s.respondError(w, http.StatusBadGateway, "Runtime cleanup failed; account was not deleted")
			return
		}
	}

	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("handleDeleteAccount: begin tx failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to start deletion")
		return
	}
	defer tx.Rollback()

	cascadeQueries := []string{
		// Revoke durable worker-visible runs before deleting their parent
		// records; queued workers then see no owned run and cannot continue.
		`UPDATE agent_runs SET status='cancelled', completed_at=NOW(), updated_at=NOW() WHERE user_id=$1 AND status NOT IN ('completed','failed','cancelled')`,
		`DELETE FROM run_events WHERE user_id=$1`,
		`DELETE FROM run_controls WHERE user_id=$1`,
		`DELETE FROM delivery_ledger WHERE user_id=$1`,
		`DELETE FROM application_attempts WHERE user_id=$1`,
		`DELETE FROM user_sessions WHERE user_id=$1`,
		`DELETE FROM tailored_resumes WHERE user_id=$1`,
		`DELETE FROM platform_configs WHERE user_id=$1`,
		`DELETE FROM runtime_approvals WHERE user_id=$1`,
		`DELETE FROM agent_router_events WHERE user_id=$1`,
		`DELETE FROM agent_task_attempts WHERE user_id=$1`,
		`DELETE FROM agent_tasks WHERE user_id=$1`,
		`DELETE FROM digital_employees WHERE user_id=$1`,

		`DELETE FROM application_approvals WHERE user_id=$1`,
		`DELETE FROM submission_receipts WHERE user_id=$1`,
		`DELETE FROM agent_questions WHERE user_id=$1`,
		`DELETE FROM privacy_audit_log WHERE user_id=$1`,

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
		`DELETE FROM agent_runs WHERE user_id=$1`,

		`DELETE FROM user_subscriptions WHERE user_id=$1`,
		`DELETE FROM public.profiles WHERE id=$1`,
		// auth.users is deliberately NOT in this list: when a GoTrue service
		// role key is configured, the user row is deleted through GoTrue's
		// admin API (DELETE /auth/v1/admin/users/{id}) after the commit — the
		// sanctioned path, which also revokes the user's sessions/refresh
		// tokens. Without a key, the direct delete below is appended instead.
	}
	// The privacy ledger is user-scoped and is deleted with the account. Any
	// aggregate compliance metrics must be stored without a user identifier.

	// Without a GoTrue service role key the auth.users row must still die for
	// deletion to be complete (auth.users is the FK parent of most tables
	// above) — the token-revocation consequence is enforced by
	// SupabaseAuth.VerifyToken's existence check.
	if s.Config.SupabaseServiceRoleKey == "" {
		cascadeQueries = append(cascadeQueries, `DELETE FROM auth.users WHERE id=$1`)
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

	// Post-commit session revocation: delete the user through GoTrue's admin
	// API (deletes auth.users + cascades its FK children + revokes sessions
	// and refresh tokens). If it fails, fall back to the direct SQL delete so
	// the account is still fully removed — revocation then relies on
	// VerifyToken's existence check, which the deleted row already triggers.
	if s.Config.SupabaseServiceRoleKey != "" {
		if err := s.deleteSupabaseUser(r.Context(), uid); err != nil {
			log.Printf("handleDeleteAccount: GoTrue admin delete failed, falling back to direct SQL: %v", err)
			if _, derr := s.DB.Conn.ExecContext(r.Context(), `DELETE FROM auth.users WHERE id=$1`, uid); derr != nil {
				log.Printf("handleDeleteAccount: fallback auth.users delete failed: %v", derr)
				// ponytail: this used to fall through to the 200 "deleted"
				// response below even when BOTH the GoTrue admin delete and
				// the direct-SQL fallback failed — a user could be told
				// their account was deleted while their auth identity row
				// (and therefore sign-in access) still existed. All of the
				// user's application data above is genuinely gone (the
				// cascade transaction already committed), but the identity
				// revocation itself did not complete, so the response must
				// say so rather than claim full success.
				// A 2xx status here would satisfy fetch's response.ok check
				// and the frontend would treat this as a clean success
				// (apiFetch/checkResponse only throws on non-2xx) --
				// deliberately non-2xx so the caller's error path fires.
				log.Printf("[GDPR] Account data deleted but auth identity revocation FAILED: user_id=%s at %s", uid, time.Now().UTC().Format(time.RFC3339))
				s.respondJSON(w, http.StatusInternalServerError, map[string]string{
					"error":   "Your account data was deleted, but we could not fully revoke your sign-in access. Contact support with this reference so we can complete it manually.",
					"status":  "deletion_incomplete_auth_revocation_failed",
					"user_id": uid,
				})
				return
			}
		}
	}

	log.Printf("[GDPR] Account hard-deleted: user_id=%s at %s", uid, time.Now().UTC().Format(time.RFC3339))
	s.respondJSON(w, http.StatusOK, map[string]string{
		"status":  "deleted",
		"user_id": uid,
	})
}

// handleDeleteUserData performs a DATA-ONLY wipe: deletes user-owned app rows
// (mirroring handleDeleteAccount's cascade) but NEVER touches the auth identity
// (no GoTrue admin delete, no DELETE FROM auth.users). The user can still sign
// in afterwards; only their application data is gone.
// DELETE /api/v1/user/data | DELETE /api/user/data
func (s *Server) handleDeleteUserData(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	uid := user.ID.String()

	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("handleDeleteUserData: begin tx failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to start deletion")
		return
	}
	defer tx.Rollback()

	dataOnlyQueries := []string{
		`UPDATE agent_runs SET status='cancelled', completed_at=NOW(), updated_at=NOW() WHERE user_id=$1 AND status NOT IN ('completed','failed','cancelled')`,
		`DELETE FROM run_events WHERE user_id=$1`,
		`DELETE FROM run_controls WHERE user_id=$1`,
		`DELETE FROM delivery_ledger WHERE user_id=$1`,
		`DELETE FROM application_attempts WHERE user_id=$1`,
		`DELETE FROM user_sessions WHERE user_id=$1`,
		`DELETE FROM tailored_resumes WHERE user_id=$1`,
		`DELETE FROM platform_configs WHERE user_id=$1`,
		`DELETE FROM runtime_approvals WHERE user_id=$1`,
		`DELETE FROM agent_router_events WHERE user_id=$1`,
		`DELETE FROM agent_task_attempts WHERE user_id=$1`,
		`DELETE FROM agent_tasks WHERE user_id=$1`,
		`DELETE FROM digital_employees WHERE user_id=$1`,
		`DELETE FROM application_approvals WHERE user_id=$1`,
		`DELETE FROM submission_receipts WHERE user_id=$1`,
		`DELETE FROM agent_questions WHERE user_id=$1`,
		`DELETE FROM privacy_audit_log WHERE user_id=$1`,
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
		`DELETE FROM user_job_feedback WHERE user_id=$1`,
		`DELETE FROM communications WHERE user_id=$1`,
		`DELETE FROM connections WHERE requester_id=$1 OR addressee_id=$1`,
		`DELETE FROM question_upvotes WHERE user_id=$1`,
		`DELETE FROM shared_interview_questions WHERE user_id=$1`,
		`DELETE FROM memberships WHERE user_id=$1`,
		`DELETE FROM push_subscriptions WHERE user_id=$1`,
		`DELETE FROM agent_runs WHERE user_id=$1`,
		`DELETE FROM user_subscriptions WHERE user_id=$1`,
		`DELETE FROM public.profiles WHERE id=$1`,
	}

	for _, q := range dataOnlyQueries {
		if _, err := tx.ExecContext(r.Context(), q, uid); err != nil {
			log.Printf("handleDeleteUserData: data wipe failed (%s): %v", q, err)
			s.respondError(w, http.StatusInternalServerError, "Deletion failed")
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("handleDeleteUserData: commit failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Deletion failed")
		return
	}

	log.Printf("[GDPR] User data wiped (account kept): user_id=%s at %s", uid, time.Now().UTC().Format(time.RFC3339))
	s.respondJSON(w, http.StatusOK, map[string]string{
		"status":  "data_deleted",
		"user_id": uid,
	})
}

// handleExportAccount gathers all user data and returns a ZIP export (GDPR B3).
// GET /api/v1/account/export  |  GET /api/account/export
//
// Export format: the ZIP contains two files:
//   - tayari_data_export.json — the user data (all successfully queried categories)
//   - manifest.json           — per-category status list; overall_status is
//                               "complete" when every category succeeded, or
//                               "partial" when one or more queries failed.
//
// On a partial export the response header X-Export-Status is set to "partial"
// (HTTP 200 is still returned so clients can download the partial ZIP + manifest).
// Callers MUST inspect X-Export-Status and manifest.json before treating the
// export as a complete GDPR export.
func (s *Server) handleExportAccount(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	uid := user.ID.String()
	ctx := r.Context()

	export := map[string]interface{}{
		"schema_version": "2026-08-14",
		"exported_at":    time.Now().UTC().Format(time.RFC3339),
		"user_id":        uid,
	}

	// categoryResults collects per-category outcomes for manifest.json.
	var categoryResults []exportCategoryResult

	// addCategory runs exportJSONRows for the given name+query, records the
	// outcome in categoryResults, and sets export[name] only on success.
	addCategory := func(name, query string, args ...interface{}) {
		raw, err := s.exportJSONRows(ctx, query, args...)
		if err != nil {
			categoryResults = append(categoryResults, exportCategoryResult{
				Name:   name,
				Status: "error",
				Error:  err.Error(),
			})
			return
		}
		// Count rows by attempting to unmarshal into a generic slice.
		var rows []json.RawMessage
		rowCount := 0
		if jerr := json.Unmarshal(raw, &rows); jerr == nil {
			rowCount = len(rows)
		}
		categoryResults = append(categoryResults, exportCategoryResult{
			Name:     name,
			Status:   "ok",
			RowCount: rowCount,
		})
		export[name] = raw
	}

	// Profile — separate query (single object, not an array).
	var profileJSON []byte
	if err := s.DB.Conn.QueryRowContext(ctx,
		`SELECT row_to_json(p) FROM public.profiles p WHERE id=$1`, uid,
	).Scan(&profileJSON); err == nil {
		export["profile"] = json.RawMessage(profileJSON)
		categoryResults = append(categoryResults, exportCategoryResult{
			Name: "profile", Status: "ok", RowCount: 1,
		})
	} else {
		categoryResults = append(categoryResults, exportCategoryResult{
			Name: "profile", Status: "error", Error: err.Error(),
		})
	}

	// Resumes — multi-column query with explicit row scanning.
	resumeResult := exportCategoryResult{Name: "resumes", Status: "ok"}
	resumeRows, err := s.DB.Conn.QueryContext(ctx,
		`SELECT id, title, original_text, created_at FROM resumes WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, uid, maxExportRows)
	if err != nil {
		resumeResult.Status = "error"
		resumeResult.Error = err.Error()
	} else {
		defer resumeRows.Close()
		resumes := []map[string]interface{}{}
		for resumeRows.Next() {
			var id int
			var title, text string
			var createdAt time.Time
			if err := resumeRows.Scan(&id, &title, &text, &createdAt); err == nil {
				resumes = append(resumes, map[string]interface{}{
					"id": id, "title": title, "original_text": text,
					"created_at": createdAt.Format(time.RFC3339),
				})
			}
		}
		if err := resumeRows.Err(); err != nil {
			log.Printf("handleExportAccount: resumes rows iteration failed: %v", err)
			resumeResult.Status = "error"
			resumeResult.Error = err.Error()
		} else {
			resumeResult.RowCount = len(resumes)
			export["resumes"] = resumes
		}
	}
	categoryResults = append(categoryResults, resumeResult)

	// Applications — multi-column query with explicit row scanning.
	appResult := exportCategoryResult{Name: "applications", Status: "ok"}
	appRows, err := s.DB.Conn.QueryContext(ctx,
		`SELECT application_id, title, company, stage, status, created_at FROM applications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`, uid, maxExportRows)
	if err != nil {
		appResult.Status = "error"
		appResult.Error = err.Error()
	} else {
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
		if err := appRows.Err(); err != nil {
			log.Printf("handleExportAccount: applications rows iteration failed: %v", err)
			appResult.Status = "error"
			appResult.Error = err.Error()
		} else {
			appResult.RowCount = len(apps)
			export["applications"] = apps
		}
	}
	categoryResults = append(categoryResults, appResult)

	// json_agg categories — all use exportJSONRows.
	addCategory("autopilot_runs",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT run_id, config, status, progress, current_step, logs, applications_created, error, created_at, updated_at
			FROM autopilot_runs WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("autopilot_schedules",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT schedule_id, frequency, config, active, next_run_at, last_run_at, created_at
			FROM autopilot_schedules WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("job_descriptions",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, title, company, text, created_at
			FROM job_descriptions WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("saved_jobs",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, dedupe_key, job, status, saved_at, updated_at
			FROM saved_jobs WHERE user_id=$1 ORDER BY saved_at DESC) t`, uid)

	addCategory("user_skill_analyses",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, resume_id, target_role, matched_skills, missing_skills, created_at
			FROM user_skill_analyses WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("conversations",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, title, messages, summary, context_type, related_job_id, is_archived, created_at, updated_at
			FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC) t`, uid)

	addCategory("user_job_feedback",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, job_id, job_title, company_name, feedback_type, feedback_source, metadata, created_at
			FROM user_job_feedback WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("communications",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, application_id, comm_type, job_title, company_name, subject, body, response_status, created_at, responded_at
			FROM communications WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("connections",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, requester_id, addressee_id, status, created_at, updated_at
			FROM connections WHERE requester_id=$1 OR addressee_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("shared_interview_questions",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT q.id, q.company, q.role, q.question_text, q.answer_text, q.category, q.visibility,
			       (SELECT COUNT(*) FROM question_upvotes qu WHERE qu.question_id = q.id) AS upvotes,
			       q.created_at, q.updated_at
			FROM shared_interview_questions q WHERE q.user_id=$1 ORDER BY q.created_at DESC) t`, uid)

	addCategory("application_outcomes",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, application_id, recruiter_reply, phone_screen, technical_interview, final_interview,
			       offer_received, offer_accepted, salary_offered, outcome_date, notes, created_at, updated_at
			FROM application_outcomes WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("memberships",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, tenant_id, role, created_at
			FROM memberships WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("push_subscriptions",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, endpoint, created_at
			FROM push_subscriptions WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	addCategory("user_subscriptions",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT plan, status, stripe_customer_id, stripe_subscription_id, metered_limit, requests_used, current_period_end, created_at, updated_at
			FROM user_subscriptions WHERE user_id=$1) t`, uid)

	addCategory("privacy_audit_log",
		`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (
			SELECT id, action, resource, detail, created_at
			FROM privacy_audit_log WHERE user_id=$1 ORDER BY created_at DESC) t`, uid)

	// Build overall export status from per-category results.
	overallStatus := "complete"
	for _, cat := range categoryResults {
		if cat.Status != "ok" {
			overallStatus = "partial"
			break
		}
	}

	// Build manifest.
	type manifest struct {
		SchemaVersion string                 `json:"schema_version"`
		ExportedAt    string                 `json:"exported_at"`
		UserID        string                 `json:"user_id"`
		OverallStatus string                 `json:"overall_status"`
		Categories    []exportCategoryResult `json:"categories"`
	}
	exportedAt, _ := export["exported_at"].(string)
	m := manifest{
		SchemaVersion: "2026-08-14",
		ExportedAt:    exportedAt,
		UserID:        uid,
		OverallStatus: overallStatus,
		Categories:    categoryResults,
	}
	manifestJSON, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		log.Printf("handleExportAccount: manifest marshal failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Export generation failed")
		return
	}

	exportJSON, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Export generation failed")
		return
	}
	if len(exportJSON)+len(manifestJSON) > maxExportBytes {
		log.Printf("handleExportAccount: export for %s exceeded %d bytes", uid, maxExportBytes)
		s.respondError(w, http.StatusRequestEntityTooLarge, "Export exceeds the maximum supported size")
		return
	}

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	writeZipFile := func(name string, data []byte) error {
		f, err := zw.Create(name)
		if err != nil {
			return fmt.Errorf("zip create %s: %w", name, err)
		}
		if _, err := f.Write(data); err != nil {
			return fmt.Errorf("zip write %s: %w", name, err)
		}
		return nil
	}

	if err := writeZipFile("tayari_data_export.json", exportJSON); err != nil {
		log.Printf("handleExportAccount: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Export generation failed")
		return
	}
	if err := writeZipFile("manifest.json", manifestJSON); err != nil {
		log.Printf("handleExportAccount: %v", err)
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
	w.Header().Set("Content-Length", fmt.Sprintf("%d", buf.Len()))
	// X-Export-Status signals whether every category was successfully queried.
	// "partial" means at least one category failed; inspect manifest.json for
	// details. Callers MUST NOT treat a "partial" export as a complete GDPR
	// export without re-requesting the failed categories.
	w.Header().Set("X-Export-Status", overallStatus)
	w.WriteHeader(http.StatusOK)
	w.Write(buf.Bytes()) //nolint:errcheck
}

