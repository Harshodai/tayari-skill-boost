package api

import (
    "encoding/json"
    "log"
    "net/http"
    "time"

    "github.com/go-chi/chi/v5"
    "tayari-backend/internal/models"
)

// handleCreateResume creates a new resume entry.
func (s *Server) handleCreateResume(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Title        string `json:"title"`
        OriginalText string `json:"original_text"`
        SourceText   string `json:"source_text"` // Archive compatibility
        FileType     string `json:"file_type"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        s.respondError(w, http.StatusBadRequest, "Invalid request body")
        return
    }
    if req.Title == "" {
        s.respondError(w, http.StatusBadRequest, "Title is required")
        return
    }

    text := req.OriginalText
    if text == "" {
        text = req.SourceText
    }

    user, _ := r.Context().Value(contextKeyUser).(*models.User)
    userID := user.ID

    query := `INSERT INTO resumes (user_id, title, original_text, file_type, status, created_at) VALUES ($1, $2, $3, $4, 'uploaded', NOW()) RETURNING id, created_at`
    var id int
    var createdAt time.Time
    err := s.DB.Conn.QueryRowContext(r.Context(), query, userID, req.Title, text, req.FileType).Scan(&id, &createdAt)
    if err != nil {
        s.respondError(w, http.StatusInternalServerError, "Failed to create resume")
        return
    }

    s.respondJSON(w, http.StatusOK, map[string]interface{}{
        "id":         id,
        "user_id":    userID,
        "title":      req.Title,
        "file_type":  req.FileType,
        "status":     "uploaded",
        "created_at": createdAt,
    })
}

// handleListResumes lists resumes for the authenticated user.
func (s *Server) handleListResumes(w http.ResponseWriter, r *http.Request) {
    user, _ := r.Context().Value(contextKeyUser).(*models.User)
    userID := user.ID

    rows, err := s.DB.Conn.QueryContext(r.Context(), "SELECT id, title, file_type, status, created_at, updated_at FROM resumes WHERE user_id=$1 ORDER BY created_at DESC", userID)
    if err != nil {
        s.respondError(w, http.StatusInternalServerError, "Failed to fetch resumes")
        return
    }
    defer rows.Close()

    resumes := []map[string]interface{}{}
    for rows.Next() {
        var id int
        var title, fileType, status string
        var createdAt, updatedAt time.Time
        if err := rows.Scan(&id, &title, &fileType, &status, &createdAt, &updatedAt); err != nil {
            log.Printf("handleListResumes: scan error: %v", err)
            continue
        }
        resumes = append(resumes, map[string]interface{}{
            "id":         id,
            "title":      title,
            "file_type":  fileType,
            "status":     status,
            "created_at": createdAt,
            "updated_at": updatedAt,
        })
    }
    if err := rows.Err(); err != nil {
        log.Printf("handleListResumes: rows iteration error: %v", err)
    }
    s.respondJSON(w, http.StatusOK, resumes)
}

// handleGetResume retrieves a specific resume.
func (s *Server) handleGetResume(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    user, ok := r.Context().Value(contextKeyUser).(*models.User)
    if !ok || user == nil {
        s.respondError(w, http.StatusUnauthorized, "User not found in context")
        return
    }
    userID := user.ID

    var resume models.Resume
    query := `SELECT id, user_id, title, COALESCE(original_text, ''), COALESCE(parsed_json::text, ''), COALESCE(file_url, ''), file_type, status, created_at, updated_at FROM resumes WHERE id=$1 AND user_id=$2`
    err := s.DB.Conn.QueryRowContext(r.Context(), query, idStr, userID).Scan(&resume.ID, &resume.UserID, &resume.Title, &resume.OriginalText, &resume.ParsedJSON, &resume.FileURL, &resume.FileType, &resume.Status, &resume.CreatedAt, &resume.UpdatedAt)
    if err != nil {
        s.respondError(w, http.StatusNotFound, "Resume not found")
        return
    }
    s.respondJSON(w, http.StatusOK, resume)
}

// handleUpdateResume updates an existing resume.
func (s *Server) handleUpdateResume(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    user, _ := r.Context().Value(contextKeyUser).(*models.User)
    userID := user.ID

    var req struct {
        Title        string `json:"title"`
        OriginalText string `json:"original_text"`
        FileType     string `json:"file_type"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        s.respondError(w, http.StatusBadRequest, "Invalid request body")
        return
    }
    if req.Title == "" {
        s.respondError(w, http.StatusBadRequest, "Title is required")
        return
    }

    query := `UPDATE resumes SET title=$1, original_text=$2, file_type=$3, updated_at=NOW() WHERE id=$4 AND user_id=$5`
    res, err := s.DB.Conn.ExecContext(r.Context(), query, req.Title, req.OriginalText, req.FileType, idStr, userID)
    if err != nil {
        s.respondError(w, http.StatusInternalServerError, "Failed to update resume")
        return
    }
    if rows, _ := res.RowsAffected(); rows == 0 {
        s.respondError(w, http.StatusNotFound, "Resume not found")
        return
    }

    s.respondJSON(w, http.StatusOK, map[string]interface{}{
        "id":      idStr,
        "message": "Resume updated successfully",
    })
}

// handleDeleteResume deletes a resume.
func (s *Server) handleDeleteResume(w http.ResponseWriter, r *http.Request) {
    idStr := chi.URLParam(r, "id")
    user, _ := r.Context().Value(contextKeyUser).(*models.User)
    userID := user.ID

    res, err := s.DB.Conn.ExecContext(r.Context(), "DELETE FROM resumes WHERE id=$1 AND user_id=$2", idStr, userID)
    if err != nil {
        s.respondError(w, http.StatusInternalServerError, "Failed to delete resume")
        return
    }
    if rows, _ := res.RowsAffected(); rows == 0 {
        s.respondError(w, http.StatusNotFound, "Resume not found")
        return
    }
    w.WriteHeader(http.StatusNoContent)
}
