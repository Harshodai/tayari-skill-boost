package api

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"tayari-backend/internal/models"
)

func (s *Server) routesRoadmapInterviewSessions(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/api/v1/roadmap", s.handleListRoadmapProgress)
		r.Get("/api/roadmap", s.handleListRoadmapProgress)
		r.Get("/api/v1/interview/sessions", s.handleListInterviewSessions)
		r.Get("/api/interview/sessions", s.handleListInterviewSessions)
	})
}

// handleListRoadmapProgress returns the authenticated user's roadmap_progress
// rows, most recently updated first. Backs the Dashboard's roadmap widget
// (src/hooks/useDashboardData.ts).
func (s *Server) handleListRoadmapProgress(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}

	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT id, roadmap_slug, step_key, status, completed_at, created_at, updated_at
		 FROM roadmap_progress
		 WHERE user_id = $1
		 ORDER BY updated_at DESC
		 LIMIT 200`,
		user.ID,
	)
	if err != nil {
		slog.Error("handleListRoadmapProgress: query failed", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load roadmap progress")
		return
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, slugVal, stepKey, status string
		var completedAt *time.Time
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &slugVal, &stepKey, &status, &completedAt, &createdAt, &updatedAt); err != nil {
			slog.Error("handleListRoadmapProgress: scan failed", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to scan roadmap progress")
			return
		}
		item := map[string]interface{}{
			"id":           id,
			"roadmap_slug": slugVal,
			"step_key":     stepKey,
			"status":       status,
			"created_at":   createdAt.Format(time.RFC3339),
			"updated_at":   updatedAt.Format(time.RFC3339),
		}
		if completedAt != nil {
			item["completed_at"] = completedAt.Format(time.RFC3339)
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		slog.Error("handleListRoadmapProgress: rows iteration failed", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load roadmap progress")
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

// handleListInterviewSessions returns the authenticated user's interview
// practice sessions, most recent first. Backs the Dashboard's interview
// activity widget (src/hooks/useDashboardData.ts).
func (s *Server) handleListInterviewSessions(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}

	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT id, role_title, COALESCE(company, ''), started_at, completed_at
		 FROM interview_sessions
		 WHERE user_id = $1
		 ORDER BY started_at DESC
		 LIMIT 100`,
		user.ID,
	)
	if err != nil {
		slog.Error("handleListInterviewSessions: query failed", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load interview sessions")
		return
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, roleTitle, company string
		var startedAt time.Time
		var completedAt *time.Time
		if err := rows.Scan(&id, &roleTitle, &company, &startedAt, &completedAt); err != nil {
			slog.Error("handleListInterviewSessions: scan failed", "error", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to scan interview session")
			return
		}
		item := map[string]interface{}{
			"id":         id,
			"role_title": roleTitle,
			"company":    company,
			"started_at": startedAt.Format(time.RFC3339),
		}
		if completedAt != nil {
			item["completed_at"] = completedAt.Format(time.RFC3339)
		}
		list = append(list, item)
	}
	if err := rows.Err(); err != nil {
		slog.Error("handleListInterviewSessions: rows iteration failed", "error", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load interview sessions")
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}
