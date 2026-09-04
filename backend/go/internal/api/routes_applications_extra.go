package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"

	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/ai"
	"tayari-backend/internal/models"
)

// routesApplicationsExtra registers archive-ported per-application feature
// routes. This function was defined but never called from anywhere (found
// 2026-08-25 during a sweep of all route-registration functions after the
// same class of bug turned up twice elsewhere the same day) — every route
// below has been a live 404 since it was written.
//
// The Kanban-style applications CRUD this file also defines
// (handleListApplicationsKanban / handleCreateApplicationKanban /
// handleUpdateApplicationKanban / handleDeleteApplicationKanban) is
// deliberately NOT wired here: routes_handlers.go's routesApplications
// (which IS registered) already owns GET/POST /api/v1/applications and
// GET/PUT/DELETE /api/v1/applications/{id} with different handlers —
// registering both would panic chi on a duplicate route. Nothing in the
// frontend calls the bare (non-v1) Kanban paths either (checked), so they
// stay unregistered rather than half-wired without their v1 twin, which
// would violate this repo's route-parity rule for no benefit.
// Every handler here reads the caller's identity from context (contextKeyUser),
// so the whole group must run behind authMiddleware — it never did before
// this fix (the function was entirely unregistered until 2026-08-25).
func (s *Server) routesApplicationsExtra(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		// Custom notes — consumed by src/api/autopilot.ts (addApplicationNote /
		// deleteApplicationNote), used from ApplicationAnalytics/Omnisave.
		r.Post("/api/applications/{id}/notes", s.handleAddNote)
		r.Delete("/api/applications/{id}/notes/{nid}", s.handleDeleteNote)
		r.Post("/api/v1/applications/{id}/notes", s.handleAddNote)
		r.Delete("/api/v1/applications/{id}/notes/{nid}", s.handleDeleteNote)

		// Interview-questions research — consumed by src/api/autopilot.ts.
		r.Post("/api/applications/{id}/interview-questions", s.handleApplicationInterviewQuestions)
		r.Post("/api/v1/applications/{id}/interview-questions", s.handleApplicationInterviewQuestions)

		// AI email-paste → Kanban stage — consumed by src/api/autopilot.ts.
		r.Post("/api/applications/parse-email", s.handleParseEmail)
		r.Post("/api/v1/applications/parse-email", s.handleParseEmail)

		// Voice notes — consumed by src/api/autopilot.ts.
		r.Post("/api/applications/{id}/voice", s.handleAddVoiceNote)
		r.Get("/api/applications/{id}/voice/{nid}", s.handleGetVoiceNote)
		r.Post("/api/v1/applications/{id}/voice", s.handleAddVoiceNote)
		r.Get("/api/v1/applications/{id}/voice/{nid}", s.handleGetVoiceNote)

		// Kanban stage transition — consumed by src/api/autopilot.ts. Does not
		// collide with routesApplications (which has no PATCH route).
		r.Patch("/api/applications/{id}/stage", s.handleUpdateApplicationStage)
		r.Patch("/api/v1/applications/{id}/stage", s.handleUpdateApplicationStage)

		// Canonical Application State Machine (WP-03 / M9-01 / M9-03)
		r.Post("/api/v1/application-runs", s.handleCreateApplicationRun)
		r.Post("/api/application-runs", s.handleCreateApplicationRun)
		r.Get("/api/v1/application-runs/{id}", s.handleGetApplicationRun)
		r.Get("/api/application-runs/{id}", s.handleGetApplicationRun)
		r.Post("/api/v1/application-runs/{id}/transition", s.handleTransitionApplicationRun)
		r.Post("/api/application-runs/{id}/transition", s.handleTransitionApplicationRun)
		r.Post("/api/v1/application-runs/{id}/actions", s.handleLogApplicationRunAction)
		r.Post("/api/application-runs/{id}/actions", s.handleLogApplicationRunAction)
		r.Post("/api/v1/application-runs/{id}/reconcile-receipt", s.handleReconcileApplicationRunReceipt)
		r.Post("/api/application-runs/{id}/reconcile-receipt", s.handleReconcileApplicationRunReceipt)
	})
}

// -------------------------------------------------------------------
// Custom Notes
// -------------------------------------------------------------------

func (s *Server) handleAddNote(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")
	var req struct {
		Text string `json:"text"`
	}
	if err := DecodeAndValidate(r, &req); err != nil || req.Text == "" {
		s.respondError(w, http.StatusUnprocessableEntity, "text is required")
		return
	}

	note := map[string]interface{}{
		"id":   uuid.New().String(),
		"text": req.Text,
		"at":   time.Now().UTC().Format(time.RFC3339),
	}
	noteJSON, _ := json.Marshal(note)

	_, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications
		SET notes_log = COALESCE(notes_log, '[]'::jsonb) || $1::jsonb,
		    updated_at = NOW()
		WHERE (application_id::text=$2 OR id::text=$2) AND user_id=$3`,
		string(noteJSON), appID, user.ID)
	if err != nil {
		log.Printf("handleAddNote: update failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to add note")
		return
	}

	var notesLogRaw []byte
	err = s.DB.Conn.QueryRowContext(r.Context(), "SELECT notes_log FROM applications WHERE (application_id::text=$1 OR id::text=$1) AND user_id=$2", appID, user.ID).Scan(&notesLogRaw)
	var notesLog []interface{}
	if err == nil {
		_ = json.Unmarshal(notesLogRaw, &notesLog)
	}
	if notesLog == nil {
		notesLog = []interface{}{}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "note": note, "notes_log": notesLog})
}

func (s *Server) handleDeleteNote(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")
	nid := chi.URLParam(r, "nid")

	_, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications
		SET notes_log = (
		    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
		    FROM jsonb_array_elements(COALESCE(notes_log, '[]'::jsonb)) AS elem
		    WHERE elem->>'id' != $1
		),
		updated_at = NOW()
		WHERE (application_id::text=$2 OR id::text=$2) AND user_id=$3`,
		nid, appID, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to delete note")
		return
	}

	var notesLogRaw []byte
	err = s.DB.Conn.QueryRowContext(r.Context(), "SELECT notes_log FROM applications WHERE (application_id::text=$1 OR id::text=$1) AND user_id=$2", appID, user.ID).Scan(&notesLogRaw)
	var notesLog []interface{}
	if err == nil {
		_ = json.Unmarshal(notesLogRaw, &notesLog)
	}
	if notesLog == nil {
		notesLog = []interface{}{}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "notes_log": notesLog})
}

// -------------------------------------------------------------------
// Interview Questions Research
// -------------------------------------------------------------------

func (s *Server) handleApplicationInterviewQuestions(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")

	// Load application
	var (
		title    string
		company  string
		notes    string
		location string
		job      models.JSONMap
	)
	err := s.DB.Conn.QueryRowContext(r.Context(), `
		SELECT COALESCE(title,''), COALESCE(company,''), COALESCE(notes,''), COALESCE(location,''), job
		FROM applications WHERE (application_id::text=$1 OR id::text=$1) AND user_id=$2`,
		appID, user.ID,
	).Scan(&title, &company, &notes, &location, &job)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
	}
	// Applications created via handleCreateApplication (the live
	// POST /api/v1/applications path) only populate the `job` JSONB column —
	// the plain title/company/location/notes text columns stay empty. Fall
	// back to extracting from `job` so this endpoint isn't silently useless
	// for every application created that way. Same fallback pattern as
	// handleListApplications above.
	if title == "" && job != nil {
		if t, ok := job["title"].(string); ok {
			title = t
		}
	}
	if company == "" && job != nil {
		if c, ok := job["company"].(string); ok {
			company = c
		}
	}
	if location == "" && job != nil {
		if l, ok := job["location"].(string); ok {
			location = l
		}
	}
	if notes == "" && job != nil {
		if d, ok := job["description"].(string); ok {
			notes = d
		}
	}

	// Load profile for summary
	var headline, skills string
	_ = s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT COALESCE(headline,''), array_to_string(COALESCE(skills,'{}'), ', ') FROM profiles WHERE id=$1`,
		user.ID).Scan(&headline, &skills)
	profileSummary := fmt.Sprintf("%s. Skills: %s", headline, skills)

	aiPayload := map[string]interface{}{
		"profile_summary": profileSummary,
		"application": map[string]interface{}{
			"title":    title,
			"company":  company,
			"location": location,
			"notes":    notes,
		},
		"jd": notes,
	}
	result, err := s.AI.PostJSONWithHeaders("/api/v1/applications/interview-questions", aiPayload, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleApplicationInterviewQuestions: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "AI interview questions failed")
		return
	}

	// Persist interview_research to application
	resultJSON, _ := json.Marshal(result)
	_, _ = s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications SET interview_research=$1::jsonb, updated_at=NOW()
		WHERE (application_id::text=$2 OR id::text=$2) AND user_id=$3`,
		string(resultJSON), appID, user.ID)

	s.respondJSON(w, http.StatusOK, result)
}

// -------------------------------------------------------------------
// AI Email-Paste → Kanban
// -------------------------------------------------------------------

func (s *Server) handleParseEmail(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	_ = user
	var req struct {
		EmailText   string `json:"email_text"`
		Subject     string `json:"subject"`
		FromAddress string `json:"from_address"`
	}
	if err := DecodeAndValidate(r, &req); err != nil || len(req.EmailText) < 10 {
		s.respondError(w, http.StatusUnprocessableEntity, "email_text is required")
		return
	}
	result, err := s.AI.PostJSONWithHeaders("/api/v1/gmail/parse-email", map[string]interface{}{
		"email_text":   req.EmailText,
		"subject":      req.Subject,
		"from_address": req.FromAddress,
	}, s.getXUserHeaders(r))
	if err != nil {
		s.respondError(w, http.StatusBadGateway, "AI email parse failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// -------------------------------------------------------------------
// Voice Notes
// -------------------------------------------------------------------

var voiceUploadDir = filepath.Join(os.TempDir(), "tayari_voice_notes")

func validateAudioSignature(ext string, header []byte) bool {
	if len(header) < 4 {
		return false
	}
	switch ext {
	case ".wav":
		return len(header) >= 12 && string(header[0:4]) == "RIFF" && string(header[8:12]) == "WAVE"
	case ".ogg":
		return len(header) >= 4 && string(header[0:4]) == "OggS"
	case ".webm":
		return len(header) >= 4 && bytes.Equal(header[0:4], []byte{0x1A, 0x45, 0xDF, 0xA3})
	case ".mp3":
		if len(header) >= 3 && string(header[0:3]) == "ID3" {
			return true
		}
		if len(header) >= 2 && header[0] == 0xFF && (header[1]&0xE0) == 0xE0 {
			return true
		}
		return false
	case ".m4a":
		return len(header) >= 8 && string(header[4:8]) == "ftyp"
	default:
		return false
	}
}

func (s *Server) handleAddVoiceNote(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}
	file, header, err := r.FormFile("audio")
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "audio field is required")
		return
	}
	defer file.Close()

	noteID := uuid.New()
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext == "" {
		ext = ".webm"
	}
	allowedExts := map[string]string{
		".webm": "audio/webm",
		".mp3":  "audio/mpeg",
		".wav":  "audio/wav",
		".ogg":  "audio/ogg",
		".m4a":  "audio/mp4",
	}
	contentType, isAllowed := allowedExts[ext]
	if !isAllowed {
		s.respondError(w, http.StatusBadRequest, "Invalid audio format. Allowed: .webm, .mp3, .wav, .ogg, .m4a")
		return
	}

	sigBuf := make([]byte, 512)
	n, err := io.ReadFull(file, sigBuf)
	if err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
		s.respondError(w, http.StatusBadRequest, "Failed to read audio file")
		return
	}
	if n < 4 || !validateAudioSignature(ext, sigBuf[:n]) {
		s.respondError(w, http.StatusBadRequest, "Invalid audio file content does not match declared format")
		return
	}
	fullStream := io.MultiReader(bytes.NewReader(sigBuf[:n]), file)

	fname := noteID.String() + ext
	fpath := filepath.Join(voiceUploadDir, fname)

	dst, err := os.Create(fpath)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to save audio")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, fullStream); err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to write audio")
		return
	}

	transcript := ""
	aiResp, aiErr := s.AI.PostJSONWithHeaders("/api/v1/voice/transcribe", map[string]interface{}{
		"file":         fname,
		"content_type": contentType,
	}, s.getXUserHeaders(r))
	if aiErr == nil {
		if t, ok := aiResp["transcript"].(string); ok {
			transcript = t
		}
	}

	voiceNote := map[string]interface{}{
		"id":           noteID.String(),
		"file":         fname,
		"content_type": contentType,
		"transcript":   transcript,
		"at":           time.Now().UTC().Format(time.RFC3339),
	}
	vnJSON, _ := json.Marshal(voiceNote)

	_, err = s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications
		SET voice_notes = COALESCE(voice_notes, '[]'::jsonb) || $1::jsonb,
		    updated_at = NOW()
		WHERE (application_id::text=$2 OR id::text=$2) AND user_id=$3`,
		string(vnJSON), appID, user.ID)
	if err != nil {
		log.Printf("handleAddVoiceNote: update failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to save voice note")
		return
	}

	transcriptionEnabled := os.Getenv("TRANSCRIBE_PROVIDER") != ""
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"voice_note":            voiceNote,
		"transcription_enabled": transcriptionEnabled,
	})
}

func (s *Server) handleGetVoiceNote(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")
	nid := chi.URLParam(r, "nid")

	var voiceNotes json.RawMessage
	err := s.DB.Conn.QueryRowContext(r.Context(), `
		SELECT COALESCE(voice_notes, '[]'::jsonb)
		FROM applications WHERE (application_id::text=$1 OR id::text=$1) AND user_id=$2`,
		appID, user.ID,
	).Scan(&voiceNotes)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
	}

	var notes []map[string]interface{}
	if err := json.Unmarshal(voiceNotes, &notes); err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to parse voice notes")
		return
	}
	allowedMIMEs := map[string]bool{
		"audio/webm": true,
		"audio/mpeg": true,
		"audio/wav":  true,
		"audio/ogg":  true,
		"audio/mp4":  true,
	}
	for _, note := range notes {
		if note["id"] == nid {
			fname, _ := note["file"].(string)
			// Sanitize filename to prevent path traversal
			cleanFname := filepath.Base(fname)
			contentType, _ := note["content_type"].(string)
			if !allowedMIMEs[contentType] {
				contentType = "audio/webm"
			}
			fpath := filepath.Join(voiceUploadDir, cleanFname)
			if _, err := os.Stat(fpath); os.IsNotExist(err) {
				s.respondError(w, http.StatusNotFound, "Audio file not found")
				return
			}
			w.Header().Set("Content-Type", contentType)
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", cleanFname))
			http.ServeFile(w, r, fpath)
			return
		}
	}
	s.respondError(w, http.StatusNotFound, "Voice note not found")
}

// -------------------------------------------------------------------
// Kanban applications CRUD (archive-compatible)
// -------------------------------------------------------------------

func (s *Server) handleListApplicationsKanban(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	stage := r.URL.Query().Get("stage")

	var rows *sql.Rows
	var err error
	const baseQ = `SELECT application_id, COALESCE(title,''), COALESCE(company,''), COALESCE(location,''),
		COALESCE(job_url,''), COALESCE(status,'saved'), COALESCE(stage,'saved'),
		COALESCE(notes,''), COALESCE(notes_log,'[]'::jsonb)::text,
		COALESCE(voice_notes,'[]'::jsonb)::text,
		COALESCE(interview_research,'{}'::jsonb)::text,
		COALESCE(cover_letter_data,'{}'::jsonb)::text,
		created_at, updated_at
		FROM applications WHERE user_id=$1`
	if stage != "" {
		rows, err = s.DB.Conn.QueryContext(r.Context(), baseQ+" AND stage=$2 ORDER BY updated_at DESC", user.ID, stage)
	} else {
		rows, err = s.DB.Conn.QueryContext(r.Context(), baseQ+" ORDER BY updated_at DESC", user.ID)
	}
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch applications")
		return
	}
	defer rows.Close()

	type AppRow struct {
		ID                uuid.UUID       `json:"id"`
		Title             string          `json:"title"`
		Company           string          `json:"company"`
		Location          string          `json:"location"`
		JobURL            string          `json:"url"`
		Status            string          `json:"status"`
		Stage             string          `json:"stage"`
		Notes             string          `json:"notes"`
		NotesLog          json.RawMessage `json:"notes_log"`
		VoiceNotes        json.RawMessage `json:"voice_notes"`
		InterviewResearch json.RawMessage `json:"interview_research"`
		CoverLetterData   json.RawMessage `json:"cover_letter_data"`
		CreatedAt         time.Time       `json:"created_at"`
		UpdatedAt         time.Time       `json:"updated_at"`
	}

	var apps []AppRow
	for rows.Next() {
		var a AppRow
		var notesLog, voiceNotes, interviewResearch, coverLetterData string
		if err := rows.Scan(&a.ID, &a.Title, &a.Company, &a.Location, &a.JobURL,
			&a.Status, &a.Stage, &a.Notes,
			&notesLog, &voiceNotes, &interviewResearch, &coverLetterData,
			&a.CreatedAt, &a.UpdatedAt); err != nil {
			s.respondError(w, http.StatusInternalServerError, "Failed to scan application row")
			return
		}
		a.NotesLog = json.RawMessage(notesLog)
		a.VoiceNotes = json.RawMessage(voiceNotes)
		a.InterviewResearch = json.RawMessage(interviewResearch)
		a.CoverLetterData = json.RawMessage(coverLetterData)
		apps = append(apps, a)
	}
	if err := rows.Err(); err != nil {
		s.respondError(w, http.StatusInternalServerError, "Database iteration error")
		return
	}
	if apps == nil {
		apps = []AppRow{}
	}
	s.respondJSON(w, http.StatusOK, apps)
}

func (s *Server) handleCreateApplicationKanban(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req struct {
		Title    string `json:"title"`
		Company  string `json:"company"`
		Location string `json:"location"`
		URL      string `json:"url"`
		Stage    string `json:"stage"`
		Notes    string `json:"notes"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Stage == "" {
		req.Stage = "saved"
	}
	normStage, ok := normalizeApplicationStatus(req.Stage)
	if !ok {
		s.respondError(w, http.StatusUnprocessableEntity, "invalid application stage")
		return
	}
	req.Stage = normStage
	id := uuid.New()
	if _, err := s.DB.Conn.ExecContext(r.Context(), "INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", user.ID, user.Email); err != nil {
		log.Printf("handleCreateApplicationKanban: auth.users insert error: %v", err)
	}
	if _, err := s.DB.Conn.ExecContext(r.Context(), "INSERT INTO profiles (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", user.ID, user.Email); err != nil {
		log.Printf("handleCreateApplicationKanban: profiles insert error: %v", err)
	}
	_, err := s.DB.Conn.ExecContext(r.Context(), `
		INSERT INTO applications
		(application_id, user_id, title, company, location, job_url, stage, status, notes, job, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,'{}'::jsonb,NOW(),NOW())`,
		id, user.ID, req.Title, req.Company, req.Location, req.URL, req.Stage, req.Notes)
	if err != nil {
		log.Printf("handleCreateApplicationKanban: insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create application")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"id": id, "title": req.Title, "company": req.Company,
		"stage": req.Stage, "status": req.Stage,
	})
}

func (s *Server) handleUpdateApplicationKanban(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")
	if appID == "" {
		s.respondError(w, http.StatusBadRequest, "Application ID is required")
		return
	}
	_, errInt := strconv.Atoi(appID)
	_, errUUID := uuid.Parse(appID)
	if errInt != nil && errUUID != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid application ID format")
		return
	}

	var req map[string]interface{}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	var stageVal *string
	if rawStage, exists := req["stage"]; exists {
		if rawStage != nil {
			str := strings.TrimSpace(fmt.Sprintf("%v", rawStage))
			if str == "" {
				s.respondError(w, http.StatusUnprocessableEntity, "invalid application stage")
				return
			}
			normStage, ok := normalizeApplicationStatus(str)
			if !ok {
				s.respondError(w, http.StatusUnprocessableEntity, "invalid application stage")
				return
			}
			stageVal = &normStage
		}
	}
	// Simple partial update: title, company, location, job_url, stage, notes
	_, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications SET
		  title    = COALESCE($3, title),
		  company  = COALESCE($4, company),
		  stage    = COALESCE($5, stage),
		  status   = COALESCE($5, status),
		  notes    = COALESCE($6, notes),
		  updated_at = NOW()
		WHERE (application_id::text=$1 OR id::text=$1) AND user_id=$2`,
		appID, user.ID,
		nullStr(req, "title"), nullStr(req, "company"),
		stageVal, nullStr(req, "notes"),
	)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to update application")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

func (s *Server) handleDeleteApplicationKanban(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")
	res, err := s.DB.Conn.ExecContext(r.Context(),
		`DELETE FROM applications WHERE application_id=$1::uuid AND user_id=$2`, appID, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to delete application")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}

func (s *Server) handleUpdateApplicationStage(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")
	var req struct {
		Stage string `json:"stage"`
	}
	if err := DecodeAndValidate(r, &req); err != nil || req.Stage == "" {
		s.respondError(w, http.StatusUnprocessableEntity, "stage is required")
		return
	}
	normStage, ok := normalizeApplicationStatus(req.Stage)
	if !ok {
		s.respondError(w, http.StatusUnprocessableEntity, "invalid application stage")
		return
	}
	req.Stage = normStage
	_, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications SET stage=$1, status=$1, updated_at=NOW()
		WHERE (application_id::text=$2 OR id::text=$2) AND user_id=$3`,
		req.Stage, appID, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to update stage")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "stage": req.Stage})
}

func (s *Server) handleApplicationPrep(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")
	_ = appID
	var req map[string]interface{}
	_ = DecodeAndValidate(r, &req)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/interview/prep", req, s.getXUserHeaders(r))
	if err != nil {
		s.respondError(w, http.StatusBadGateway, "AI prep failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// nullStr extracts a string pointer from a map (nil if key absent).
func nullStr(m map[string]interface{}, key string) *string {
	v, ok := m[key]
	if !ok || v == nil {
		return nil
	}
	str := fmt.Sprintf("%v", v)
	return &str
}

// -------------------------------------------------------------------
// Canonical Application State Machine Handlers (WP-03)
// -------------------------------------------------------------------

func (s *Server) handleGetApplicationRun(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		s.respondError(w, http.StatusBadRequest, "Run ID is required")
		return
	}
	if _, err := uuid.Parse(id); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid run ID format")
		return
	}
	if s.AI == nil {
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	endpoint := fmt.Sprintf("/api/v1/application-runs/%s", url.PathEscape(id))
	result, err := s.AI.GetJSONWithHeaders(endpoint, s.getXUserHeaders(r))
	if err != nil {
		var apiErr *ai.APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode >= 400 && apiErr.StatusCode < 500 {
			s.respondError(w, apiErr.StatusCode, apiErr.Body)
			return
		}
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleTransitionApplicationRun(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		s.respondError(w, http.StatusBadRequest, "Run ID is required")
		return
	}
	if _, err := uuid.Parse(id); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid run ID format")
		return
	}
	if s.AI == nil {
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 256*1024))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	endpoint := fmt.Sprintf("/api/v1/application-runs/%s/transition", url.PathEscape(id))
	result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), s.getXUserHeaders(r))
	if err != nil {
		var apiErr *ai.APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode >= 400 && apiErr.StatusCode < 500 {
			s.respondError(w, apiErr.StatusCode, apiErr.Body)
			return
		}
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCreateApplicationRun(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if s.AI == nil {
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 256*1024))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	result, err := s.AI.PostJSONWithHeaders("/api/v1/application-runs", json.RawMessage(body), s.getXUserHeaders(r))
	if err != nil {
		var apiErr *ai.APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode >= 400 && apiErr.StatusCode < 500 {
			s.respondError(w, apiErr.StatusCode, apiErr.Body)
			return
		}
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	s.respondJSON(w, http.StatusCreated, result)
}

func (s *Server) handleLogApplicationRunAction(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		s.respondError(w, http.StatusBadRequest, "Run ID is required")
		return
	}
	if _, err := uuid.Parse(id); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid run ID format")
		return
	}
	if s.AI == nil {
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 256*1024))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	endpoint := fmt.Sprintf("/api/v1/application-runs/%s/actions", url.PathEscape(id))
	result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), s.getXUserHeaders(r))
	if err != nil {
		var apiErr *ai.APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode >= 400 && apiErr.StatusCode < 500 {
			s.respondError(w, apiErr.StatusCode, apiErr.Body)
			return
		}
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleReconcileApplicationRunReceipt(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if id == "" {
		s.respondError(w, http.StatusBadRequest, "Run ID is required")
		return
	}
	if _, err := uuid.Parse(id); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid run ID format")
		return
	}
	if s.AI == nil {
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 256*1024))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	endpoint := fmt.Sprintf("/api/v1/application-runs/%s/reconcile-receipt", url.PathEscape(id))
	result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), s.getXUserHeaders(r))
	if err != nil {
		var apiErr *ai.APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode >= 400 && apiErr.StatusCode < 500 {
			s.respondError(w, apiErr.StatusCode, apiErr.Body)
			return
		}
		s.respondError(w, http.StatusBadGateway, "AI service unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

