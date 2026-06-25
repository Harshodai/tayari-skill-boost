package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/models"
)

// routesApplicationsExtra registers archive-ported per-application feature routes.
func (s *Server) routesApplicationsExtra(r chi.Router) {
	// Custom notes
	r.Post("/api/applications/{id}/notes", s.handleAddNote)
	r.Delete("/api/applications/{id}/notes/{nid}", s.handleDeleteNote)
	r.Post("/api/v1/applications/{id}/notes", s.handleAddNote)
	r.Delete("/api/v1/applications/{id}/notes/{nid}", s.handleDeleteNote)

	// Interview-questions research
	r.Post("/api/applications/{id}/interview-questions", s.handleApplicationInterviewQuestions)
	r.Post("/api/v1/applications/{id}/interview-questions", s.handleApplicationInterviewQuestions)

	// AI email-paste → Kanban stage
	r.Post("/api/applications/parse-email", s.handleParseEmail)
	r.Post("/api/v1/applications/parse-email", s.handleParseEmail)

	// Voice notes
	r.Post("/api/applications/{id}/voice", s.handleAddVoiceNote)
	r.Get("/api/applications/{id}/voice/{nid}", s.handleGetVoiceNote)
	r.Post("/api/v1/applications/{id}/voice", s.handleAddVoiceNote)
	r.Get("/api/v1/applications/{id}/voice/{nid}", s.handleGetVoiceNote)

	// Kanban applications CRUD (archive compatible)
	r.Get("/api/applications", s.handleListApplicationsKanban)
	r.Post("/api/applications", s.handleCreateApplicationKanban)
	r.Put("/api/applications/{id}", s.handleUpdateApplicationKanban)
	r.Delete("/api/applications/{id}", s.handleDeleteApplicationKanban)
	r.Patch("/api/applications/{id}/stage", s.handleUpdateApplicationStage)
	r.Post("/api/applications/{id}/prep", s.handleApplicationPrep)
	// v1
	r.Get("/api/v1/applications", s.handleListApplicationsKanban)
	r.Post("/api/v1/applications", s.handleCreateApplicationKanban)
	r.Put("/api/v1/applications/{id}", s.handleUpdateApplicationKanban)
	r.Delete("/api/v1/applications/{id}", s.handleDeleteApplicationKanban)
	r.Patch("/api/v1/applications/{id}/stage", s.handleUpdateApplicationStage)
	r.Post("/api/v1/applications/{id}/prep", s.handleApplicationPrep)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Text == "" {
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
		WHERE application_id=$2::uuid AND user_id=$3`,
		string(noteJSON), appID, user.ID)
	if err != nil {
		log.Printf("handleAddNote: update failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to add note")
		return
	}

	var notesLogRaw []byte
	err = s.DB.Conn.QueryRowContext(r.Context(), "SELECT notes_log FROM applications WHERE application_id=$1::uuid AND user_id=$2", appID, user.ID).Scan(&notesLogRaw)
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
		WHERE application_id=$2::uuid AND user_id=$3`,
		nid, appID, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to delete note")
		return
	}

	var notesLogRaw []byte
	err = s.DB.Conn.QueryRowContext(r.Context(), "SELECT notes_log FROM applications WHERE application_id=$1::uuid AND user_id=$2", appID, user.ID).Scan(&notesLogRaw)
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
	)
	err := s.DB.Conn.QueryRowContext(r.Context(), `
		SELECT COALESCE(title,''), COALESCE(company,''), COALESCE(notes,''), COALESCE(location,'')
		FROM applications WHERE application_id=$1::uuid AND user_id=$2`,
		appID, user.ID,
	).Scan(&title, &company, &notes, &location)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
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
	result, err := s.AI.PostJSON("/api/v1/applications/interview-questions", aiPayload)
	if err != nil {
		log.Printf("handleApplicationInterviewQuestions: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "AI interview questions failed")
		return
	}

	// Persist interview_research to application
	resultJSON, _ := json.Marshal(result)
	_, _ = s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications SET interview_research=$1::jsonb, updated_at=NOW()
		WHERE application_id=$2::uuid AND user_id=$3`,
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.EmailText) < 10 {
		s.respondError(w, http.StatusUnprocessableEntity, "email_text is required")
		return
	}
	result, err := s.AI.PostJSON("/api/v1/gmail/parse-email", map[string]interface{}{
		"email_text":   req.EmailText,
		"subject":      req.Subject,
		"from_address": req.FromAddress,
	})
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

func init() {
	_ = os.MkdirAll(voiceUploadDir, 0o755)
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
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".webm"
	}
	fname := noteID.String() + ext
	fpath := filepath.Join(voiceUploadDir, fname)

	dst, err := os.Create(fpath)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to save audio")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to write audio")
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "audio/webm"
	}
	transcript := ""
	aiResp, aiErr := s.AI.PostJSON("/api/v1/voice/transcribe", map[string]interface{}{
		"file":         fname,
		"content_type": contentType,
	})
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
		WHERE application_id=$2::uuid AND user_id=$3`,
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
		FROM applications WHERE application_id=$1::uuid AND user_id=$2`,
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
	for _, note := range notes {
		if note["id"] == nid {
			fname, _ := note["file"].(string)
			contentType, _ := note["content_type"].(string)
			if contentType == "" {
				contentType = "audio/webm"
			}
			fpath := filepath.Join(voiceUploadDir, fname)
			if _, err := os.Stat(fpath); os.IsNotExist(err) {
				s.respondError(w, http.StatusNotFound, "Audio file not found")
				return
			}
			w.Header().Set("Content-Type", contentType)
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

	var rows interface{ Close() error; Next() bool; Scan(...interface{}) error }
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
			continue
		}
		a.NotesLog = json.RawMessage(notesLog)
		a.VoiceNotes = json.RawMessage(voiceNotes)
		a.InterviewResearch = json.RawMessage(interviewResearch)
		a.CoverLetterData = json.RawMessage(coverLetterData)
		apps = append(apps, a)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Stage == "" {
		req.Stage = "saved"
	}
	id := uuid.New()
	_, err := s.DB.Conn.ExecContext(r.Context(), `
		INSERT INTO applications
		(application_id, user_id, title, company, location, job_url, stage, status, notes, job, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,'{}',NOW(),NOW())`,
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
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
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
		WHERE application_id=$1::uuid AND user_id=$2`,
		appID, user.ID,
		nullStr(req, "title"), nullStr(req, "company"),
		nullStr(req, "stage"), nullStr(req, "notes"),
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Stage == "" {
		s.respondError(w, http.StatusUnprocessableEntity, "stage is required")
		return
	}
	_, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE applications SET stage=$1, status=$1, updated_at=NOW()
		WHERE application_id=$2::uuid AND user_id=$3`,
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
	_ = json.NewDecoder(r.Body).Decode(&req)
	result, err := s.AI.PostJSON("/api/v1/interview/prep", req)
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
