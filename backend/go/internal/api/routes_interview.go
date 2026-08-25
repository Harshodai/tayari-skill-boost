package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
)

// handleInterviewCopilotHint proxies the single-shot STAR hint request.
func (s *Server) handleInterviewCopilotHint(w http.ResponseWriter, r *http.Request) {
	if !s.requireFeature(w, r, "interview_copilot") {
		return
	}
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		body = make(map[string]interface{})
	}
	result, err := s.AI.PostJSONWithHeaders("/api/v1/interview/copilot-hint", body, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleInterviewCopilotHint: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Live interview copilot failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// handleInterviewVoiceFeedback proxies the deterministic voice analysis.
func (s *Server) handleInterviewVoiceFeedback(w http.ResponseWriter, r *http.Request) {
	if !s.requireFeature(w, r, "interview_copilot") {
		return
	}
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		body = make(map[string]interface{})
	}
	result, err := s.AI.PostJSONWithHeaders("/api/v1/interview/voice-feedback", body, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleInterviewVoiceFeedback: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Voice analysis failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// handleInterviewCopilotStream passes the Python SSE stream through verbatim.
func (s *Server) handleInterviewCopilotStream(w http.ResponseWriter, r *http.Request) {
	if !s.requireFeature(w, r, "interview_copilot") {
		return
	}
	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		body = make(map[string]interface{})
	}

	upstream, err := s.AI.PostStream(r.Context(), "/api/v1/interview/copilot/stream", body, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleInterviewCopilotStream: upstream failed: %v", err)
		if status, ok := extractAIStatus(err); ok {
			s.respondError(w, status, "Upstream AI service error")
			return
		}
		s.respondError(w, http.StatusBadGateway, "Live interview copilot failed")
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
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err != nil {
			if err != io.EOF {
				log.Printf("handleInterviewCopilotStream: read error: %v", err)
			}
			return
		}
	}
}
