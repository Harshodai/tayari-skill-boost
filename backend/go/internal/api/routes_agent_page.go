package api

import (
	"encoding/json"
	"io"
	"net/http"
)

func (s *Server) handleExtensionPageAnswer(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 64<<10))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "failed to read page context")
		return
	}
	if len(body) == 0 {
		s.respondError(w, http.StatusBadRequest, "page context is required")
		return
	}
	result, err := s.AI.PostJSONWithHeaders("/api/v1/agent/page-answer", json.RawMessage(body), s.getXUserHeaders(r))
	if err != nil {
		s.respondError(w, http.StatusBadGateway, "page answer unavailable")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}
