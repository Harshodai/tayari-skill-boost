package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"tayari-backend/internal/auth"
)

type JobWatch struct {
	ID           int     `json:"id"`
	WatchID      string  `json:"watch_id"`
	UserID       string  `json:"user_id"`
	QueryTitle   string  `json:"query_title"`
	Location     string  `json:"location"`
	SalaryFloor  float64 `json:"salary_floor"`
	ScheduleTier string  `json:"schedule_tier"`
	IsActive     bool    `json:"is_active"`
	LastRunAt    *string `json:"last_run_at,omitempty"`
	CreatedAt    string  `json:"created_at"`
}

func (s *Server) routesJobWatches(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Use(s.authRateLimiter.Middleware)

		r.Get("/api/v1/watches", s.handleListJobWatches)
		r.Post("/api/v1/watches", s.handleCreateJobWatch)
		r.Delete("/api/v1/watches/{id}", s.handleDeleteJobWatch)

		// Legacy aliases
		r.Get("/api/watches", s.handleListJobWatches)
		r.Post("/api/watches", s.handleCreateJobWatch)
		r.Delete("/api/watches/{id}", s.handleDeleteJobWatch)
	})
}

func (s *Server) handleListJobWatches(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == [16]byte{} {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondJSON(w, http.StatusOK, []JobWatch{})
		return
	}

	rows, err := s.DB.Conn.Query(`
		SELECT id, watch_id, user_id, query_title, location, salary_floor, schedule_tier, is_active, last_run_at, created_at
		FROM public.job_watches
		WHERE user_id = $1::uuid
		ORDER BY created_at DESC
	`, user.ID.String())
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to query watches")
		return
	}
	defer rows.Close()

	watches := []JobWatch{}
	for rows.Next() {
		var wItem JobWatch
		var lastRun sql.NullTime
		var createdAt sql.NullTime
		if err := rows.Scan(
			&wItem.ID,
			&wItem.WatchID,
			&wItem.UserID,
			&wItem.QueryTitle,
			&wItem.Location,
			&wItem.SalaryFloor,
			&wItem.ScheduleTier,
			&wItem.IsActive,
			&lastRun,
			&createdAt,
		); err == nil {
			if lastRun.Valid {
				t := lastRun.Time.Format("2006-01-02T15:04:05Z07:00")
				wItem.LastRunAt = &t
			}
			if createdAt.Valid {
				wItem.CreatedAt = createdAt.Time.Format("2006-01-02T15:04:05Z07:00")
			}
			watches = append(watches, wItem)
		}
	}

	s.respondJSON(w, http.StatusOK, watches)
}

func (s *Server) handleCreateJobWatch(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == [16]byte{} {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req struct {
		QueryTitle   string  `json:"query_title"`
		Location     string  `json:"location"`
		SalaryFloor  float64 `json:"salary_floor"`
		ScheduleTier string  `json:"schedule_tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.QueryTitle == "" {
		s.respondError(w, http.StatusBadRequest, "query_title is required")
		return
	}
	if req.Location == "" {
		req.Location = "Remote"
	}
	if req.ScheduleTier == "" {
		req.ScheduleTier = "daily"
	}
	if req.SalaryFloor <= 0 {
		req.SalaryFloor = 100000
	}

	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}

	var created JobWatch
	var createdAt sql.NullTime
	err := s.DB.Conn.QueryRow(`
		INSERT INTO public.job_watches (user_id, query_title, location, salary_floor, schedule_tier, is_active)
		VALUES ($1::uuid, $2, $3, $4, $5, true)
		RETURNING id, watch_id, user_id, query_title, location, salary_floor, schedule_tier, is_active, created_at
	`, user.ID.String(), req.QueryTitle, req.Location, req.SalaryFloor, req.ScheduleTier).Scan(
		&created.ID,
		&created.WatchID,
		&created.UserID,
		&created.QueryTitle,
		&created.Location,
		&created.SalaryFloor,
		&created.ScheduleTier,
		&created.IsActive,
		&createdAt,
	)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to create watch")
		return
	}
	if createdAt.Valid {
		created.CreatedAt = createdAt.Time.Format("2006-01-02T15:04:05Z07:00")
	}

	s.respondJSON(w, http.StatusCreated, created)
}

func (s *Server) handleDeleteJobWatch(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == [16]byte{} {
		s.respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	watchID := chi.URLParam(r, "id")
	if watchID == "" {
		s.respondError(w, http.StatusBadRequest, "watch id required")
		return
	}

	if s.DB != nil && s.DB.Conn != nil {
		_, err := s.DB.Conn.Exec(`
			DELETE FROM public.job_watches
			WHERE user_id = $1::uuid AND (watch_id = $2 OR id::text = $2)
		`, user.ID.String(), watchID)
		if err != nil {
			s.respondError(w, http.StatusInternalServerError, "failed to delete watch")
			return
		}
	}

	s.respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
