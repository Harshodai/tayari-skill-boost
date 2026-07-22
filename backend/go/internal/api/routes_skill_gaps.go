package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// -------------------------------------------------------------------
// Skill-gap proxy (K3) — forwards the body to the Python
// ``/api/v1/skill-gaps`` taxonomy endpoint. Registered under BOTH the
// versioned and archive-compatible prefixes (route-parity rule).
//
// The Python endpoint is a pure taxonomy set-difference (no LLM/DB), so the
// 30s ai.Client timeout is never the bottleneck. PostJSON surfaces non-2xx
// as an error → mapped to 502 here.
// -------------------------------------------------------------------

// RegisterSkillGapRoutes wires POST /skill-gaps under both /api/v1 and /api.
// Called from router.go at integration time (kept out of the shared wiring
// file until then).
func (s *Server) RegisterSkillGapRoutes(r chi.Router) {
	r.Post("/api/v1/skill-gaps", s.handleSkillGaps)
	r.Post("/api/skill-gaps", s.handleSkillGaps)
}

func (s *Server) handleSkillGaps(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	if len(body) == 0 {
		s.respondError(w, http.StatusBadRequest, "Request body is required")
		return
	}

	result, err := s.AI.PostJSON("/api/v1/skill-gaps", json.RawMessage(body))
	if err != nil {
		log.Printf("handleSkillGaps: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Skill-gap analysis failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}
