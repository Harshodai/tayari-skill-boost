package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/models"
)

// routesKnowledgeHub registers Knowledge Hub (Omni-Save) routes with both
// archive-compatible and versioned aliases.
func (s *Server) routesKnowledgeHub(r chi.Router) {
	r.Post("/api/saves", s.handleCreateSave)
	r.Get("/api/saves", s.handleListSaves)
	r.Delete("/api/saves/{id}", s.handleDeleteSave)
	// v1 aliases
	r.Post("/api/v1/saves", s.handleCreateSave)
	r.Get("/api/v1/saves", s.handleListSaves)
	r.Delete("/api/v1/saves/{id}", s.handleDeleteSave)
}

// -------------------------------------------------------------------
// Knowledge Hub handlers
// -------------------------------------------------------------------

func (s *Server) handleCreateSave(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	var req struct {
		URL    string `json:"url"`
		Note   string `json:"note"`
		Source string `json:"source"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.URL == "" || len(req.URL) < 5 {
		s.respondError(w, http.StatusUnprocessableEntity, "url is required")
		return
	}
	if req.Source == "" {
		req.Source = "other"
	}

	// Call Python AI for enrichment (title, summary, tags, category, is_interview_related)
	aiResult := map[string]interface{}{
		"title":                "",
		"summary":              "",
		"tags":                 []string{},
		"category":             "other",
		"is_interview_related": false,
	}
	aiPayload := map[string]interface{}{
		"url":    req.URL,
		"note":   req.Note,
		"source": req.Source,
	}
	enriched, err := s.AI.PostJSON("/api/v1/saves/analyze", aiPayload)
	if err != nil {
		log.Printf("handleCreateSave: AI enrichment failed (continuing): %v", err)
	} else {
		aiResult = enriched
	}

	// Persist to Postgres
	id := uuid.New()
	title, _ := aiResult["title"].(string)
	summary, _ := aiResult["summary"].(string)
	tagsRaw, _ := json.Marshal(aiResult["tags"])
	category, _ := aiResult["category"].(string)
	if category == "" {
		category = "other"
	}
	isInterviewRelated, _ := aiResult["is_interview_related"].(bool)

	query := `INSERT INTO saved_posts
		(id, user_id, url, note, source, title, summary, tags, category, is_interview_related, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,NOW(),NOW())
		RETURNING id, created_at`
	var retID uuid.UUID
	var createdAt time.Time
	err = s.DB.Conn.QueryRowContext(r.Context(), query,
		id, user.ID, req.URL, req.Note, req.Source, title, summary,
		string(tagsRaw), category, isInterviewRelated,
	).Scan(&retID, &createdAt)
	if err != nil {
		log.Printf("handleCreateSave: db insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to save post")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":                   retID,
		"url":                  req.URL,
		"note":                 req.Note,
		"source":               req.Source,
		"title":                title,
		"summary":              summary,
		"tags":                 aiResult["tags"],
		"category":             category,
		"is_interview_related": isInterviewRelated,
		"created_at":           createdAt,
	})
}

func (s *Server) handleListSaves(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	category := r.URL.Query().Get("category")
	var rows interface{}

	type SaveRow struct {
		ID                 uuid.UUID       `json:"id"`
		URL                string          `json:"url"`
		Note               string          `json:"note"`
		Source             string          `json:"source"`
		Title              string          `json:"title"`
		Summary            string          `json:"summary"`
		Tags               json.RawMessage `json:"tags"`
		Category           string          `json:"category"`
		IsInterviewRelated bool            `json:"is_interview_related"`
		CreatedAt          time.Time       `json:"created_at"`
	}

	var (
		dbRows sqlRows
		err    error
	)
	if category != "" {
		dbRows, err = s.DB.Conn.QueryContext(r.Context(),
			`SELECT id, url, note, source, title, summary, tags, category, is_interview_related, created_at
			 FROM saved_posts WHERE user_id=$1 AND category=$2 ORDER BY created_at DESC`,
			user.ID, category)
	} else {
		dbRows, err = s.DB.Conn.QueryContext(r.Context(),
			`SELECT id, url, note, source, title, summary, tags, category, is_interview_related, created_at
			 FROM saved_posts WHERE user_id=$1 ORDER BY created_at DESC`,
			user.ID)
	}
	if err != nil {
		log.Printf("handleListSaves: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch saves")
		return
	}
	defer dbRows.Close()

	var saves []SaveRow
	for dbRows.Next() {
		var sv SaveRow
		if err := dbRows.Scan(&sv.ID, &sv.URL, &sv.Note, &sv.Source, &sv.Title,
			&sv.Summary, &sv.Tags, &sv.Category, &sv.IsInterviewRelated, &sv.CreatedAt); err != nil {
			continue
		}
		saves = append(saves, sv)
	}
	if saves == nil {
		saves = []SaveRow{}
	}
	_ = rows
	s.respondJSON(w, http.StatusOK, saves)
}

func (s *Server) handleDeleteSave(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	id := chi.URLParam(r, "id")
	res, err := s.DB.Conn.ExecContext(r.Context(),
		`DELETE FROM saved_posts WHERE id=$1 AND user_id=$2`, id, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to delete save")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		s.respondError(w, http.StatusNotFound, "Save not found")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"deleted": true})
}

// sqlRows is an alias to avoid import collision — database/sql.Rows
type sqlRows = interface {
	Close() error
	Next() bool
	Scan(dest ...interface{}) error
}
