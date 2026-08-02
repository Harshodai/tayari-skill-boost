package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"tayari-backend/internal/auth"
)

// RegisterSSERoutes registers the /api/v1/autopilot/stream/{runId} endpoint.
func (s *Server) RegisterSSERoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Get("/api/autopilot/stream/{runId}", s.handleAutopilotStream())
		r.Get("/api/v1/autopilot/stream/{runId}", s.handleAutopilotStream())
	})
}

func (s *Server) handleAutopilotStream() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := auth.UserFromContext(r.Context())
		if !ok || user == nil {
			s.respondError(w, http.StatusUnauthorized, "unauthorized - valid authentication required")
			return
		}

		runID := chi.URLParam(r, "runId")
		if runID == "" {
			s.respondError(w, http.StatusBadRequest, "runId URL parameter is required")
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			s.respondError(w, http.StatusInternalServerError, "Streaming unsupported")
			return
		}

		// Initial connection event
		fmt.Fprintf(w, "event: autopilot_update\ndata: {\"runId\": \"%s\", \"stage\": \"INITIATED\", \"status\": \"connected\", \"timestamp\": \"%s\"}\n\n", runID, time.Now().Format(time.RFC3339))
		flusher.Flush()

		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		ctx := r.Context()
		steps := []string{
			"RESUME_TAILORED",
			"COVER_LETTER_GENERATED",
			"AUTO_APPLY_PAYLOAD_READY",
			"RECRUITER_INTEL_GATHERED",
			"INTERVIEW_KIT_COMPILED",
			"COMPLETED",
		}
		stepIdx := 0

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if stepIdx < len(steps) {
					stage := steps[stepIdx]
					fmt.Fprintf(w, "event: autopilot_update\ndata: {\"runId\": \"%s\", \"stage\": \"%s\", \"status\": \"in_progress\", \"timestamp\": \"%s\"}\n\n", runID, stage, time.Now().Format(time.RFC3339))
					flusher.Flush()
					stepIdx++
				} else {
					fmt.Fprintf(w, "event: autopilot_update\ndata: {\"runId\": \"%s\", \"stage\": \"COMPLETED\", \"status\": \"finished\", \"timestamp\": \"%s\"}\n\n", runID, time.Now().Format(time.RFC3339))
					flusher.Flush()
					return
				}
			}
		}
	}
}
