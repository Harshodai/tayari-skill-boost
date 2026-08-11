package api

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
)

// -------------------------------------------------------------------
// Browser Automation Agent proxy routes — user-based browser actions.
//
// Forwards requests to the Python AI service endpoint
// `/api/v1/browser/automation`.
//
// Hardening (WS-06):
//   - every handler requires an authenticated caller and forwards the
//     caller identity so the AI engine can enforce run ownership;
//   - request bodies are size-capped;
//   - upstream calls carry explicit deadlines (the kill switch must never
//     hang behind the 240s default AI client timeout);
//   - every attempt/outcome is audit-logged with actor + run id.
// -------------------------------------------------------------------

const (
	// browserMaxBodyBytes caps proxied browser payloads (instructions are text).
	browserMaxBodyBytes = 256 << 10 // 256 KiB
	// browserCancelTimeout bounds the kill switch: it must fail fast, not hang.
	browserCancelTimeout = 15 * time.Second
	// browserRunTimeout bounds a single blocking automation run.
	browserRunTimeout = 5 * time.Minute
	// browserStreamTimeout bounds an SSE run so a wedged agent cannot pin a
	// connection (and its remote browser) open forever.
	browserStreamTimeout = 20 * time.Minute
)

// RegisterBrowserRoutes wires the browser automation proxy routes.
// NOTE: these must stay inside the authenticated route group.
func (s *Server) RegisterBrowserRoutes(r chi.Router) {
	r.Post("/api/v1/browser/automation", s.handleBrowserAutomation)
	r.Post("/api/browser/automation", s.handleBrowserAutomation)
	r.Post("/api/v1/browser/automation/stream", s.handleBrowserAutomationStream)
	r.Post("/api/browser/automation/stream", s.handleBrowserAutomationStream)
	r.Post("/api/v1/browser/automation/cancel", s.handleBrowserAutomationCancel)
	r.Post("/api/browser/automation/cancel", s.handleBrowserAutomationCancel)
}

// auditBrowser emits a single-line audit record for browser-agent actions.
// Keep the shape stable — log shippers parse it.
func auditBrowser(action, userID, runID, outcome string, detail interface{}) {
	log.Printf("[Audit] component=browser-agent action=%s actor=%s run=%s outcome=%s detail=%v",
		action, orDash(userID), orDash(runID), outcome, detail)
}

func orDash(v string) string {
	if v == "" {
		return "-"
	}
	return v
}

// requireBrowserUser resolves the authenticated caller. The route group already
// runs authMiddleware; this is the defence-in-depth check so a future
// mis-registration cannot silently expose the kill switch anonymously.
func (s *Server) requireBrowserUser(w http.ResponseWriter, r *http.Request, action string) (string, bool) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		auditBrowser(action, "", "", "denied", "unauthenticated")
		s.respondError(w, http.StatusUnauthorized, "Authentication required")
		return "", false
	}
	return user.ID.String(), true
}

// decodeBrowserBody reads a single, size-capped JSON object from the request.
func decodeBrowserBody(w http.ResponseWriter, r *http.Request) (map[string]interface{}, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, browserMaxBodyBytes)
	dec := json.NewDecoder(r.Body)
	var payload map[string]interface{}
	if err := dec.Decode(&payload); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return nil, false
	}
	// Reject trailing data after the first JSON value (e.g. two concatenated
	// objects) — the decoder must hit EOF, otherwise the payload is malformed.
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return nil, false
	}
	if payload == nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return nil, false
	}
	return payload, true
}

// handleBrowserAutomationCancel is the WS-06 kill switch: it asks the AI
// engine to terminate the isolated browser session bound to a run. The AI
// engine re-checks that the run belongs to the forwarded user, so one user
// can never kill another user's browser.
func (s *Server) handleBrowserAutomationCancel(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.requireBrowserUser(w, r, "cancel")
	if !ok {
		return
	}
	payload, ok := decodeBrowserBody(w, r)
	if !ok {
		auditBrowser("cancel", userID, "", "rejected", "invalid payload")
		return
	}
	runID, _ := payload["run_id"].(string)
	if runID == "" {
		auditBrowser("cancel", userID, "", "rejected", "missing run_id")
		http.Error(w, "run_id is required", http.StatusBadRequest)
		return
	}
	// Never let the client dictate the actor.
	payload["user_id"] = userID

	auditBrowser("cancel", userID, runID, "requested", nil)

	ctx, cancel := context.WithTimeout(r.Context(), browserCancelTimeout)
	defer cancel()

	result, err := s.AI.PostJSONWithContext(ctx, "/api/v1/browser/automation/cancel", payload, s.getXUserHeaders(r))
	if err != nil {
		auditBrowser("cancel", userID, runID, "error", err)
		if status, ok := extractAIStatus(err); ok && (status == http.StatusForbidden || status == http.StatusNotFound) {
			s.respondError(w, status, "Run not found for this account")
			return
		}
		log.Printf("[BrowserAutomation] Cancel proxy error: %v", err)
		http.Error(w, "failed to cancel browser run", http.StatusBadGateway)
		return
	}

	auditBrowser("cancel", userID, runID, "ok", result["terminated"])
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(result)
}

func (s *Server) handleBrowserAutomation(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.requireBrowserUser(w, r, "run")
	if !ok {
		return
	}
	payload, ok := decodeBrowserBody(w, r)
	if !ok {
		auditBrowser("run", userID, "", "rejected", "invalid payload")
		return
	}
	runID, _ := payload["run_id"].(string)
	payload["user_id"] = userID
	auditBrowser("run", userID, runID, "requested", nil)

	ctx, cancel := context.WithTimeout(r.Context(), browserRunTimeout)
	defer cancel()

	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithContext(ctx, "/api/v1/browser/automation", payload, headers)
	if err != nil {
		auditBrowser("run", userID, runID, "error", err)
		log.Printf("[BrowserAutomation] Proxy error: %v", err)
		http.Error(w, "failed to execute browser automation", http.StatusBadGateway)
		return
	}

	auditBrowser("run", userID, runID, "ok", nil)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(result)
}

// handleBrowserAutomationStream passes the Glass-Box screenshot SSE stream
// through verbatim (Moat-2 passthrough pattern, optional flusher).
func (s *Server) handleBrowserAutomationStream(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.requireBrowserUser(w, r, "stream")
	if !ok {
		return
	}
	body, ok := decodeBrowserBody(w, r)
	if !ok {
		auditBrowser("stream", userID, "", "rejected", "invalid payload")
		return
	}
	runID, _ := body["run_id"].(string)
	body["user_id"] = userID
	auditBrowser("stream", userID, runID, "requested", nil)

	ctx, cancel := context.WithTimeout(r.Context(), browserStreamTimeout)
	defer cancel()

	upstream, err := s.AI.PostStream(ctx, "/api/v1/browser/automation/stream", body, s.getXUserHeaders(r))
	if err != nil {
		auditBrowser("stream", userID, runID, "error", err)
		log.Printf("handleBrowserAutomationStream: upstream failed: %v", err)
		if status, ok := extractAIStatus(err); ok {
			s.respondError(w, status, "Upstream AI service error")
			return
		}
		s.respondError(w, http.StatusBadGateway, "Browser automation stream failed")
		return
	}
	defer upstream.Body.Close()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)

	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 4096)
	for {
		n, err := upstream.Body.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				auditBrowser("stream", userID, runID, "client-disconnect", nil)
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err != nil {
			if err != io.EOF {
				auditBrowser("stream", userID, runID, "error", err)
				log.Printf("handleBrowserAutomationStream: read error: %v", err)
			} else {
				auditBrowser("stream", userID, runID, "ok", nil)
			}
			return
		}
	}
}
