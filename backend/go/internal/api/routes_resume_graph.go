package api

import (
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
)

// handleGetResumeGraph proxies GET /api/v1/resume-graph/{run_id} to the Python
// resume-graph router. The frontend requests format=raw so the stored graph is
// returned unwrapped (top-level nodes/links) instead of the paginated
// {run_id, graph:{...}} envelope.
func (s *Server) handleGetResumeGraph(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "run_id")
	endpoint := "/v1/resume-graph/" + url.PathEscape(runID)
	if r.URL.RawQuery != "" {
		endpoint += "?" + r.URL.RawQuery
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders(endpoint, headers)
	if err != nil {
		log.Printf("handleGetResumeGraph: AI call failed for run %s: %v", runID, err)
		s.proxyAIError(w, err)
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// handlePostResumeGraph proxies POST /api/v1/resume-graph (parse + store).
func (s *Server) handlePostResumeGraph(w http.ResponseWriter, r *http.Request) {
	var payload map[string]interface{}
	if err := DecodeAndValidate(r, &payload); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/v1/resume-graph", payload, headers)
	if err != nil {
		log.Printf("handlePostResumeGraph: AI call failed: %v", err)
		s.proxyAIError(w, err)
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// handleDeleteResumeGraph proxies DELETE /api/v1/resume-graph/{run_id}.
// Python returns 204 No Content on success; pass the status through.
func (s *Server) handleDeleteResumeGraph(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "run_id")
	headers := s.getXUserHeaders(r)
	if err := s.AI.DeleteNoContent("/v1/resume-graph/"+url.PathEscape(runID), headers); err != nil {
		log.Printf("handleDeleteResumeGraph: AI call failed for run %s: %v", runID, err)
		s.proxyAIError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleExportResumeGraph proxies GET /api/v1/resume-graph/{run_id}/export,
// streaming the JSON blob through with its Content-Disposition header so the
// browser still gets a downloadable attachment.
func (s *Server) handleExportResumeGraph(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "run_id")
	endpoint := "/v1/resume-graph/" + url.PathEscape(runID) + "/export"
	headers := s.getXUserHeaders(r)
	resp, err := s.AI.GetBlob(endpoint, headers)
	if err != nil {
		log.Printf("handleExportResumeGraph: AI call failed for run %s: %v", runID, err)
		s.proxyAIError(w, err)
		return
	}
	defer resp.Body.Close()

	for _, h := range []string{"Content-Type", "Content-Disposition"} {
		if v := resp.Header.Get(h); v != "" {
			w.Header().Set(h, v)
		}
	}
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, resp.Body)
}

// proxyAIError maps an ai.Client error to a gateway status, forwarding 4xx
// upstream errors (e.g. Python's 404 "Resume graph not found" or 429 rate
// limit) instead of always 502ing. The client formats non-2xx as
// "AI service returned %d: %s", so we extract the status number — same
// convention as isPythonNotFound.
func (s *Server) proxyAIError(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}
	if status, ok := extractAIStatus(err); ok {
		s.respondError(w, status, "Upstream AI service error")
		return
	}
	s.respondError(w, http.StatusBadGateway, "ai_service_unavailable")
}

// extractAIStatus returns the upstream HTTP status from an ai.Client error of
// the form "AI service returned %d: ...", and ok=false for any other error.
func extractAIStatus(err error) (int, bool) {
	msg := err.Error()
	const prefix = "AI service returned "
	if !strings.HasPrefix(msg, prefix) {
		return 0, false
	}
	rest := strings.TrimPrefix(msg, prefix)
	status := 0
	for _, ch := range rest {
		if ch < '0' || ch > '9' {
			break
		}
		status = status*10 + int(ch-'0')
	}
	if status >= 400 && status <= 599 {
		return status, true
	}
	return 0, false
}
