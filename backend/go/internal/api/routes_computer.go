package api

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"time"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// RegisterComputerRoutes keeps both isolated-computer and local-browser bridge
// control behind the verified Go gateway identity boundary.
func (s *Server) RegisterComputerRoutes(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Post("/api/v1/computer/runs", s.handleComputerPOST("/api/v1/computer/runs"))
		r.Post("/api/computer/runs", s.handleComputerPOST("/api/v1/computer/runs"))
		r.Get("/api/v1/computer/runs/{runId}", s.handleComputerGETPath("/api/v1/computer/runs/"))
		r.Get("/api/computer/runs/{runId}", s.handleComputerGETPath("/api/v1/computer/runs/"))
		r.Delete("/api/v1/computer/run/{runId}", s.handleComputerDELETEPath("/api/v1/computer/run/"))
		r.Delete("/api/computer/run/{runId}", s.handleComputerDELETEPath("/api/v1/computer/run/"))
		r.Delete("/api/v1/computer/runs/{runId}", s.handleComputerDELETEPath("/api/v1/computer/runs/"))
		r.Delete("/api/computer/runs/{runId}", s.handleComputerDELETEPath("/api/v1/computer/runs/"))
		r.Get("/api/v1/computer/run/{runId}/stream", s.handleComputerGETStream("/api/v1/computer/run/"))
		r.Get("/api/computer/run/{runId}/stream", s.handleComputerGETStream("/api/v1/computer/run/"))
		r.Get("/api/v1/computer/runs/{runId}/stream", s.handleComputerGETStream("/api/v1/computer/runs/"))
		r.Get("/api/computer/runs/{runId}/stream", s.handleComputerGETStream("/api/v1/computer/runs/"))
		// ponytail: GET-with-suffix mirrors handleComputerPOSTPath; Go only forwards identity+query, Python owns replay
		r.Get("/api/v1/computer/runs/{runId}/events", s.handleComputerGETPathSuffix("/api/v1/computer/runs/", "/events"))
		r.Get("/api/computer/runs/{runId}/events", s.handleComputerGETPathSuffix("/api/v1/computer/runs/", "/events"))
		r.Get("/api/v1/computer/run/{runId}/events", s.handleComputerGETPathSuffix("/api/v1/computer/run/", "/events"))
		r.Get("/api/computer/run/{runId}/events", s.handleComputerGETPathSuffix("/api/v1/computer/run/", "/events"))
		r.Post("/api/v1/computer/run/{runId}/stream", s.handleComputerPOSTStream("/api/v1/computer/run/"))
		r.Post("/api/computer/run/{runId}/stream", s.handleComputerPOSTStream("/api/v1/computer/run/"))
		r.Post("/api/v1/computer/runs/{runId}/stream", s.handleComputerPOSTStream("/api/v1/computer/runs/"))
		r.Post("/api/computer/runs/{runId}/stream", s.handleComputerPOSTStream("/api/v1/computer/runs/"))
		r.Post("/api/v1/computer/run/{runId}/start", s.handleComputerPOSTBodyPath("/api/v1/computer/run/", "/start"))
		r.Post("/api/computer/run/{runId}/start", s.handleComputerPOSTBodyPath("/api/v1/computer/run/", "/start"))
		r.Post("/api/v1/computer/runs/{runId}/start", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/start"))
		r.Post("/api/computer/runs/{runId}/start", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/start"))
		r.Post("/api/v1/computer/runs/{runId}/bridge/attach", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/attach"))
		r.Post("/api/v1/computer/runs/{runId}/bridge/action/authorize", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/action/authorize"))
		r.Post("/api/v1/computer/runs/{runId}/bridge/observation", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/observation"))
		r.Post("/api/computer/runs/{runId}/bridge/attach", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/attach"))
		r.Post("/api/computer/runs/{runId}/bridge/action/authorize", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/action/authorize"))
		r.Post("/api/computer/runs/{runId}/bridge/observation", s.handleComputerPOSTBodyPath("/api/v1/computer/runs/", "/bridge/observation"))
		r.Post("/api/v1/computer/runs/{runId}/revoke", s.handleComputerPOSTPath("/api/v1/computer/runs/", "/revoke"))
		r.Post("/api/computer/runs/{runId}/revoke", s.handleComputerPOSTPath("/api/v1/computer/runs/", "/revoke"))
	})
}

func (s *Server) verifiedComputerHeaders(r *http.Request) (map[string]string, bool) {
	authorization, ok := auth.AuthorizationContextFromContext(r.Context())
	if !ok || authorization.Subject == uuid.Nil || authorization.TenantID == uuid.Nil {
		return nil, false
	}
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil || user.ID != authorization.Subject {
		return nil, false
	}
	headers := s.getXUserHeaders(r)
	headers["X-Tenant-Id"] = authorization.TenantID.String()
	return headers, true
}

func (s *Server) handleComputerPOST(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 32*1024))
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read computer request")
			return
		}
		result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), headers)
		if err != nil {
			log.Printf("computer POST %s: AI call failed: %v", endpoint, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusCreated, result)
	}
}

func (s *Server) handleComputerGETPath(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		if _, err := uuid.Parse(runID); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid computer run id")
			return
		}
		result, err := s.AI.GetJSONWithHeaders(prefix+runID, headers)
		if err != nil {
			log.Printf("computer GET %s: AI call failed: %v", prefix+runID, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

// ponytail: GET twin of handleComputerPOSTPath; forwards RawQuery so ?after= cursor reaches Python
// ponytail: events accept opaque worker ids like stream handlers; verified context is the gate, not UUID shape
func (s *Server) handleComputerGETPathSuffix(prefix, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		target := prefix + runID + suffix
		if q := r.URL.RawQuery; q != "" {
			target += "?" + q
		}
		result, err := s.AI.GetJSONWithHeaders(target, headers)
		if err != nil {
			log.Printf("computer GET %s: AI call failed: %v", target, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleComputerPOSTBodyPath(prefix, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		if _, err := uuid.Parse(runID); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid computer run id")
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 32*1024))
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read computer bridge request")
			return
		}
		result, err := s.AI.PostJSONWithHeaders(prefix+runID+suffix, json.RawMessage(body), headers)
		if err != nil {
			log.Printf("computer POST %s: AI call failed: %v", prefix+runID+suffix, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleComputerPOSTPath(prefix, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		if _, err := uuid.Parse(runID); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid computer run id")
			return
		}
		result, err := s.AI.PostJSONWithHeaders(prefix+runID+suffix, json.RawMessage(`{}`), headers)
		if err != nil {
			log.Printf("computer POST %s: AI call failed: %v", prefix+runID+suffix, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleComputerDELETEPath(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		result, err := s.AI.DeleteJSONWithHeaders(prefix+runID, headers)
		if err != nil {
			log.Printf("computer DELETE %s: AI call failed: %v", prefix+runID, err)
			s.respondError(w, http.StatusBadGateway, "Computer service unavailable")
			return
		}
		s.respondJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleComputerGETStream(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		upstream, err := s.AI.GetBlob(prefix+runID+"/stream", headers)
		if err != nil {
			log.Printf("computer GET stream %s: AI call failed: %v", prefix+runID, err)
			s.respondError(w, http.StatusBadGateway, "Computer stream unavailable")
			return
		}
		defer upstream.Body.Close()

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)

		proxyComputerStream(r, w, upstream.Body)
	}
}

// ponytail: single copy loop — ctx select frees goroutine + upstream conn on client disconnect
func proxyComputerStream(r *http.Request, w http.ResponseWriter, src io.Reader) {
	// ponytail: closing the upstream body unblocks a stuck src.Read so the
	// reader goroutine can observe ctx-done and exit — no leaked goroutine
	// or upstream conn after client disconnect. Callers also defer Close;
	// Response.Body.Close is idempotent so the double close is safe.
	if closer, ok := src.(io.Closer); ok {
		defer closer.Close()
	}
	flusher, _ := w.(http.Flusher)
	type chunk struct {
		n   int
		err error
		buf []byte
	}
	ctx := r.Context()
	ch := make(chan chunk, 1)
	go func() {
		defer close(ch)
		tmp := make([]byte, 4096)
		for {
			n, err := src.Read(tmp)
			cp := make([]byte, n)
			copy(cp, tmp[:n])
			select {
			case <-ctx.Done():
				return
			case ch <- chunk{n: n, err: err, buf: cp}:
			}
			if err != nil {
				return
			}
		}
	}()
	for {
		select {
		case <-r.Context().Done():
			return
		case c, ok := <-ch:
			if !ok {
				return
			}
			if c.n > 0 {
				if _, werr := w.Write(c.buf[:c.n]); werr != nil {
					return
				}
				if flusher != nil {
					flusher.Flush()
				}
			}
			if c.err != nil {
				return
			}
		}
	}
}

func (s *Server) handleComputerPOSTStream(prefix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		headers, ok := s.verifiedComputerHeaders(r)
		if !ok {
			s.respondError(w, http.StatusForbidden, "Verified tenant context required")
			return
		}
		runID := url.PathEscape(chi.URLParam(r, "runId"))
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 32*1024))
		if err != nil {
			s.respondError(w, http.StatusBadRequest, "Failed to read request")
			return
		}
		var payload interface{}
		if len(body) > 0 {
			if err := json.Unmarshal(body, &payload); err != nil {
				s.respondError(w, http.StatusBadRequest, "Malformed JSON body")
				return
			}
		}

		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Minute)
		defer cancel()

		upstream, err := s.AI.PostStream(ctx, prefix+runID+"/stream", payload, headers)
		if err != nil {
			log.Printf("computer POST stream %s: AI call failed: %v", prefix+runID, err)
			s.respondError(w, http.StatusBadGateway, "Computer stream unavailable")
			return
		}
		defer upstream.Body.Close()

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)

		proxyComputerStream(r, w, upstream.Body)
	}
}
