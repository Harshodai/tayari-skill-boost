package api

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"tayari-backend/internal/models"
	"tayari-backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

// handleCreateResume creates a new resume entry.
func (s *Server) handleCreateResume(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title        string `json:"title"`
		OriginalText string `json:"original_text"`
		SourceText   string `json:"source_text"` // Archive compatibility
		FileType     string `json:"file_type"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
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

	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	userID := user.ID

	if s.Repos != nil && s.Repos.Resumes != nil {
		id, err := s.Repos.Resumes.Create(r.Context(), userID.String(), req.Title, text, req.FileType)
		if err != nil {
			slog.Error("handleCreateResume: failed to create resume via repository", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to create resume")
			return
		}
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"id":         id,
			"user_id":    userID,
			"title":      req.Title,
			"file_type":  req.FileType,
			"status":     "uploaded",
			"created_at": time.Now(),
		})
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "database unavailable")
		return
	}

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
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID

	if s.Repos != nil && s.Repos.Resumes != nil {
		items, err := s.Repos.Resumes.ListByUser(r.Context(), userID.String(), 100)
		if err != nil {
			slog.Error("handleListResumes: repository list error", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to fetch resumes")
			return
		}
		resumes := make([]map[string]interface{}, len(items))
		for i, res := range items {
			resumes[i] = map[string]interface{}{
				"id":         res.ID,
				"title":      res.Title,
				"file_type":  res.FileType,
				"status":     res.Status,
				"created_at": res.CreatedAt,
				"updated_at": res.CreatedAt,
			}
		}
		s.respondJSON(w, http.StatusOK, resumes)
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondJSON(w, http.StatusOK, []map[string]interface{}{})
		return
	}

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
			slog.Error("handleListResumes: scan error", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to scan resume record")
			return
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
		slog.Error("handleListResumes: rows iteration error", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Database iteration error")
		return
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

	if s.Repos != nil && s.Repos.Resumes != nil {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Invalid resume ID")
			return
		}
		res, err := s.Repos.Resumes.GetByID(r.Context(), userID.String(), id)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				s.respondError(w, http.StatusNotFound, "Resume not found")
				return
			}
			slog.Error("handleGetResume: repository error", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to fetch resume")
			return
		}
		s.respondJSON(w, http.StatusOK, models.Resume{
			ID:           int(res.ID),
			UserID:       res.UserID,
			Title:        res.Title,
			OriginalText: res.OriginalText,
			FileType:     res.FileType,
			Status:       res.Status,
			CreatedAt:    res.CreatedAt,
			UpdatedAt:    res.CreatedAt,
		})
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "database unavailable")
		return
	}

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
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID

	var req struct {
		Title        string `json:"title"`
		OriginalText string `json:"original_text"`
		FileType     string `json:"file_type"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Title == "" {
		s.respondError(w, http.StatusBadRequest, "Title is required")
		return
	}

	if s.Repos != nil && s.Repos.Resumes != nil {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Invalid resume ID")
			return
		}
		err = s.Repos.Resumes.Update(r.Context(), userID.String(), id, req.Title, req.OriginalText, req.FileType)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				s.respondError(w, http.StatusNotFound, "Resume not found")
				return
			}
			slog.Error("handleUpdateResume: repository error", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to update resume")
			return
		}
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"id":      idStr,
			"message": "Resume updated successfully",
		})
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "database unavailable")
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
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	userID := user.ID

	if s.Repos != nil && s.Repos.Resumes != nil {
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Invalid resume ID")
			return
		}
		err = s.Repos.Resumes.Delete(r.Context(), userID.String(), id)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				s.respondError(w, http.StatusNotFound, "Resume not found")
				return
			}
			slog.Error("handleDeleteResume: repository error", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to delete resume")
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "database unavailable")
		return
	}

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
