package api

import (
	"context"
	"net/http"
	"runtime"
	"time"

	"github.com/go-chi/chi/v5"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "ok",
		"service":   "go-backend",
		"timestamp": time.Now().Format(time.RFC3339),
		"uptime":    time.Since(s.startTime).String(),
	})
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if s.DB == nil || s.DB.Conn == nil || s.AI == nil {
		s.respondJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "go-backend"})
		return
	}
	if err := s.DB.Conn.PingContext(ctx); err != nil {
		s.respondJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "service": "go-backend"})
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "go-backend"})
}

func (s *Server) handleHealthDetailed(w http.ResponseWriter, r *http.Request) {
	_, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	overallStatus := "ok"
	dbStatus := "ok"
	if s.DB == nil {
		dbStatus = "disabled"
	}

	aiStatus := "ok"
	if s.AI == nil {
		aiStatus = "disabled"
	}

	httpCode := http.StatusOK
	if overallStatus == "degraded" {
		httpCode = http.StatusServiceUnavailable
	}

	s.respondJSON(w, httpCode, map[string]interface{}{
		"status":  overallStatus,
		"service": "go-backend",
		"uptime":  time.Since(s.startTime).String(),
		"memory": map[string]interface{}{
			"alloc_mb":       m.Alloc / 1024 / 1024,
			"total_alloc_mb": m.TotalAlloc / 1024 / 1024,
			"sys_mb":         m.Sys / 1024 / 1024,
			"num_gc":         m.NumGC,
		},
		"dependencies": map[string]string{
			"postgres":  dbStatus,
			"python_ai": aiStatus,
		},
	})
}

func (s *Server) routesApplications(r chi.Router) {
	r.Get("/api/v1/applications", s.handleListApplications)
	r.Post("/api/v1/applications", s.handleCreateApplication)
	r.Get("/api/v1/applications/{id}", s.handleGetApplication)
	r.Put("/api/v1/applications/{id}", s.handleUpdateApplication)
	r.Delete("/api/v1/applications/{id}", s.handleDeleteApplication)
}
