package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// -------------------------------------------------------------------
// Hermes agent layer (WS-E) — proxy routes to the Python AI service.
//
// All four handlers forward to the Python ``/api/v1/hermes/*`` endpoints via
// ``s.AI.PostJSON``/``s.AI.GetJSON``. The scrape endpoint is async-first on
// the Python side (enqueues a Celery task and returns a run_id immediately),
// so the 30s ``ai.Client`` timeout is never the bottleneck. ``GetJSON``
// surfaces non-2xx as an error, so 404s from Python are translated into a
// matching 404 to the Go caller.
// -------------------------------------------------------------------

// routesHermes wires the Hermes proxy routes (both /api/v1 and /api aliases).
func (s *Server) routesHermes(r chi.Router) {
	// v1 routes
	r.Post("/api/v1/hermes/scrape", s.handleHermesScrape)
	r.Get("/api/v1/hermes/jobs/{board}", s.handleHermesJobsBoard)
	r.Get("/api/v1/hermes/runs", s.handleHermesRunsList)
	r.Get("/api/v1/hermes/runs/{id}", s.handleHermesRunDetail)
	// archive-compatible aliases (subset the frontend actually calls)
	r.Post("/api/hermes/scrape", s.handleHermesScrape)
	r.Get("/api/hermes/jobs/{board}", s.handleHermesJobsBoard)
	r.Get("/api/hermes/runs", s.handleHermesRunsList)
	r.Get("/api/hermes/runs/{id}", s.handleHermesRunDetail)
}

// handleHermesScrape forwards the scrape request body to Python.
//
// The Python endpoint enqueues a Celery task by default (sync=false) and
// returns {run_id, status:"queued", task_id} immediately, so the 30s client
// timeout is never hit. When the caller passes sync=true the Python side
// runs the scrape inline; that path may exceed 30s for large boards, so we
// log a warning and forward as-is (the caller accepts the risk).
func (s *Server) handleHermesScrape(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	if len(body) == 0 {
		s.respondError(w, http.StatusBadRequest, "Request body is required")
		return
	}
	var probe struct {
		Sync bool `json:"sync"`
	}
	_ = json.Unmarshal(body, &probe) // tolerate non-JSON / extra fields
	if probe.Sync {
		log.Printf("handleHermesScrape: sync=true requested; this may exceed the 30s AI client timeout — recommend async")
	}

	result, err := s.AI.PostJSON("/api/v1/hermes/scrape", json.RawMessage(body))
	if err != nil {
		log.Printf("handleHermesScrape: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Hermes scrape failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// handleHermesJobsBoard proxies GET /api/v1/hermes/jobs/{board}?limit=N.
func (s *Server) handleHermesJobsBoard(w http.ResponseWriter, r *http.Request) {
	board := chi.URLParam(r, "board")
	if board == "" {
		s.respondError(w, http.StatusBadRequest, "board is required")
		return
	}
	limit := r.URL.Query().Get("limit")
	if limit == "" {
		limit = "40"
	}
	result, err := s.AI.GetJSON("/api/v1/hermes/jobs/" + board + "?limit=" + limit)
	if err != nil {
		log.Printf("handleHermesJobsBoard: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch cached jobs")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// handleHermesRunsList proxies GET /api/v1/hermes/runs?run_type=...&status=...&limit=...
// forwarding every query parameter the caller sent.
func (s *Server) handleHermesRunsList(w http.ResponseWriter, r *http.Request) {
	q := r.URL.RawQuery
	target := "/api/v1/hermes/runs"
	if q != "" {
		target += "?" + q
	}
	result, err := s.AI.GetJSON(target)
	if err != nil {
		log.Printf("handleHermesRunsList: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to list Hermes runs")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// handleHermesRunDetail proxies GET /api/v1/hermes/runs/{id}. Python returns
// 404 for unknown runs; GetJSON surfaces that as an error which we translate
// back into a 404 for the Go caller. Any other non-2xx becomes a 502.
func (s *Server) handleHermesRunDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		s.respondError(w, http.StatusBadRequest, "run id is required")
		return
	}
	result, err := s.AI.GetJSON("/api/v1/hermes/runs/" + id)
	if err != nil {
		if isPythonNotFound(err) {
			s.respondError(w, http.StatusNotFound, "Hermes run not found")
			return
		}
		log.Printf("handleHermesRunDetail: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch Hermes run")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// isPythonNotFound returns true when the error from ai.Client.GetJSON indicates
// the Python service returned 404. The client formats non-2xx as
// "AI service returned %d: %s", so we detect the 404 status code substring.
// This avoids exposing the raw error body to the caller while still surfacing
// the not-found semantic.
func isPythonNotFound(err error) bool {
	if err == nil {
		return false
	}
	// ai.Client.GetJSON error: "AI service returned 404: <body>"
	return strings.Contains(err.Error(), " 404:")
}