package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/repository"
)

type CoverLetter struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	JobTitle    string    `json:"job_title"`
	CompanyName string    `json:"company_name"`
	Content     string    `json:"content"`
	JobURL      string    `json:"job_url"`
	ResumeID    *string   `json:"resume_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateCoverLetterRequest struct {
	JobTitle    string  `json:"job_title"`
	CompanyName string  `json:"company_name"`
	Content     string  `json:"content"`
	JobURL      string  `json:"job_url"`
	ResumeID    *string `json:"resume_id,omitempty"`
}

func (s *Server) routesCoverLetters(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.requireAuth)
		r.Use(s.authRateLimiter.Middleware)

		r.Post("/api/v1/cover-letters", s.handleCreateCoverLetter)
		r.Get("/api/v1/cover-letters", s.handleListCoverLetters)
		r.Get("/api/v1/cover-letters/{id}", s.handleGetCoverLetter)
		r.Delete("/api/v1/cover-letters/{id}", s.handleDeleteCoverLetter)

		// Legacy aliases for parity
		r.Post("/api/cover-letters", s.handleCreateCoverLetter)
		r.Get("/api/cover-letters", s.handleListCoverLetters)
		r.Get("/api/cover-letters/{id}", s.handleGetCoverLetter)
		r.Delete("/api/cover-letters/{id}", s.handleDeleteCoverLetter)
	})
}

func (s *Server) handleCreateCoverLetter(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == uuid.Nil {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req CreateCoverLetterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if strings.TrimSpace(req.Content) == "" {
		s.respondError(w, http.StatusBadRequest, "Content is required")
		return
	}

	var resumeIDVal *string
	if req.ResumeID != nil && strings.TrimSpace(*req.ResumeID) != "" {
		trimmed := strings.TrimSpace(*req.ResumeID)
		if _, err := uuid.Parse(trimmed); err != nil {
			s.respondError(w, http.StatusBadRequest, "Invalid resume_id UUID format")
			return
		}
		resumeIDVal = &trimmed
	}

	if s.Repos != nil && s.Repos.CoverLetters != nil {
		clRepo := &repository.CoverLetter{
			UserID:   user.ID.String(),
			JobTitle: req.JobTitle,
			Company:  req.CompanyName,
			Body:     req.Content,
		}
		id, err := s.Repos.CoverLetters.Create(r.Context(), clRepo)
		if err != nil {
			slog.Error("handleCreateCoverLetter: failed to create cover letter via repository", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to create cover letter")
			return
		}
		cl := CoverLetter{
			ID:          id,
			UserID:      user.ID.String(),
			JobTitle:    req.JobTitle,
			CompanyName: req.CompanyName,
			Content:     req.Content,
			JobURL:      req.JobURL,
			ResumeID:    resumeIDVal,
			CreatedAt:   clRepo.CreatedAt,
			UpdatedAt:   clRepo.CreatedAt,
		}
		s.respondJSON(w, http.StatusCreated, cl)
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "database unavailable")
		return
	}

	var cl CoverLetter
	err := s.DB.WithTenantTx(r.Context(), user.ID.String(), func(tx *sql.Tx) error {
		var scannedResumeID sql.NullString
		query := `
			INSERT INTO cover_letters (user_id, job_title, company_name, content, job_url, resume_id)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, user_id, COALESCE(job_title, ''), COALESCE(company_name, ''), content, COALESCE(job_url, ''), resume_id, created_at, updated_at
		`
		return tx.QueryRowContext(
			r.Context(),
			query,
			user.ID,
			req.JobTitle,
			req.CompanyName,
			req.Content,
			req.JobURL,
			resumeIDVal,
		).Scan(
			&cl.ID,
			&cl.UserID,
			&cl.JobTitle,
			&cl.CompanyName,
			&cl.Content,
			&cl.JobURL,
			&scannedResumeID,
			&cl.CreatedAt,
			&cl.UpdatedAt,
		)
	})

	if err != nil {
		slog.Error("handleCreateCoverLetter: failed to create cover letter", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create cover letter")
		return
	}

	s.respondJSON(w, http.StatusCreated, cl)
}

func (s *Server) handleListCoverLetters(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == uuid.Nil {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if s.Repos != nil && s.Repos.CoverLetters != nil {
		repoLetters, err := s.Repos.CoverLetters.ListByUser(r.Context(), user.ID.String())
		if err != nil {
			slog.Error("handleListCoverLetters: failed to query cover letters via repository", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to fetch cover letters")
			return
		}
		letters := make([]CoverLetter, len(repoLetters))
		for i, l := range repoLetters {
			letters[i] = CoverLetter{
				ID:          l.ID,
				UserID:      l.UserID,
				JobTitle:    l.JobTitle,
				CompanyName: l.Company,
				Content:     l.Body,
				CreatedAt:   l.CreatedAt,
				UpdatedAt:   l.CreatedAt,
			}
		}
		s.respondJSON(w, http.StatusOK, letters)
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondJSON(w, http.StatusOK, []CoverLetter{})
		return
	}

	letters := make([]CoverLetter, 0)
	err := s.DB.WithTenantTx(r.Context(), user.ID.String(), func(tx *sql.Tx) error {
		query := `
			SELECT id, user_id, COALESCE(job_title, ''), COALESCE(company_name, ''), content, COALESCE(job_url, ''), resume_id, created_at, updated_at
			FROM cover_letters
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT 200
		`
		rows, err := tx.QueryContext(r.Context(), query, user.ID)
		if err != nil {
			return err
		}
		defer rows.Close()

		for rows.Next() {
			var cl CoverLetter
			var scannedResumeID sql.NullString
			if err := rows.Scan(
				&cl.ID,
				&cl.UserID,
				&cl.JobTitle,
				&cl.CompanyName,
				&cl.Content,
				&cl.JobURL,
				&scannedResumeID,
				&cl.CreatedAt,
				&cl.UpdatedAt,
			); err != nil {
				return err
			}
			if scannedResumeID.Valid {
				str := scannedResumeID.String
				cl.ResumeID = &str
			}
			letters = append(letters, cl)
		}
		return rows.Err()
	})

	if err != nil {
		slog.Error("handleListCoverLetters: failed to query cover letters", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch cover letters")
		return
	}

	s.respondJSON(w, http.StatusOK, letters)
}

func (s *Server) handleGetCoverLetter(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == uuid.Nil {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid cover letter ID")
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "database unavailable")
		return
	}

	var cl CoverLetter
	var notFound bool
	err := s.DB.WithTenantTx(r.Context(), user.ID.String(), func(tx *sql.Tx) error {
		var scannedResumeID sql.NullString
		query := `
			SELECT id, user_id, COALESCE(job_title, ''), COALESCE(company_name, ''), content, COALESCE(job_url, ''), resume_id, created_at, updated_at
			FROM cover_letters
			WHERE id = $1 AND user_id = $2
		`
		err := tx.QueryRowContext(r.Context(), query, id, user.ID).Scan(
			&cl.ID,
			&cl.UserID,
			&cl.JobTitle,
			&cl.CompanyName,
			&cl.Content,
			&cl.JobURL,
			&scannedResumeID,
			&cl.CreatedAt,
			&cl.UpdatedAt,
		)
		if errors.Is(err, sql.ErrNoRows) {
			notFound = true
			return nil
		}
		if err != nil {
			return err
		}
		if scannedResumeID.Valid {
			str := scannedResumeID.String
			cl.ResumeID = &str
		}
		return nil
	})

	if notFound {
		s.respondError(w, http.StatusNotFound, "Cover letter not found")
		return
	}
	if err != nil {
		slog.Error("handleGetCoverLetter: failed to query cover letter", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch cover letter")
		return
	}

	s.respondJSON(w, http.StatusOK, cl)
}

func (s *Server) handleDeleteCoverLetter(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == uuid.Nil {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := uuid.Parse(id); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid cover letter ID")
		return
	}

	if s.Repos != nil && s.Repos.CoverLetters != nil {
		err := s.Repos.CoverLetters.Delete(r.Context(), user.ID.String(), id)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				s.respondError(w, http.StatusNotFound, "Cover letter not found")
				return
			}
			slog.Error("handleDeleteCoverLetter: failed to delete cover letter via repository", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to delete cover letter")
			return
		}
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"status": "deleted",
			"id":     id,
		})
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusInternalServerError, "database unavailable")
		return
	}

	var notFound bool
	err := s.DB.WithTenantTx(r.Context(), user.ID.String(), func(tx *sql.Tx) error {
		query := `DELETE FROM cover_letters WHERE id = $1 AND user_id = $2`
		res, err := tx.ExecContext(r.Context(), query, id, user.ID)
		if err != nil {
			return err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if rows == 0 {
			notFound = true
		}
		return nil
	})

	if notFound {
		s.respondError(w, http.StatusNotFound, "Cover letter not found")
		return
	}
	if err != nil {
		slog.Error("handleDeleteCoverLetter: failed to delete cover letter", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to delete cover letter")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"status": "deleted",
		"id":     id,
	})
}
