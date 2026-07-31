package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"tayari-backend/internal/models"
)

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
		`DELETE FROM applications WHERE user_id=$1`,
		`DELETE FROM resume_versions rv USING resumes res WHERE rv.resume_id=res.id AND res.user_id=$1`,
		`DELETE FROM resumes WHERE user_id=$1`,
		`DELETE FROM job_descriptions WHERE user_id=$1`,
		`DELETE FROM saved_jobs WHERE user_id=$1`,
		`DELETE FROM user_skill_analyses WHERE user_id=$1`,
		`DELETE FROM conversations WHERE user_id=$1`,
		`DELETE FROM user_preferences WHERE user_id=$1`,
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
		var resumes []map[string]interface{}
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
		var apps []map[string]interface{}
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

	exportJSON, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Export generation failed")
		return
	}

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, _ := zw.Create("tayari_data_export.json")
	f.Write(exportJSON)
	zw.Close()

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="tayari_export.zip"`)
	w.WriteHeader(http.StatusOK)
	w.Write(buf.Bytes())
}
