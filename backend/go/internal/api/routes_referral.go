package api

import (
	"log"
	"net/http"
)

// handleReferralDraft proxies a referral-draft request to the Python
// moderator (Moat-1). Pure proxy: auth handled by the route group; no DB.
func (s *Server) handleReferralDraft(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Contact     map[string]interface{} `json:"contact"`
		Job         map[string]interface{} `json:"job"`
		UserContext map[string]interface{} `json:"user_context"`
		Kind        string                 `json:"kind"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	switch req.Kind {
	case "intro", "referral", "followup", "thanks":
		// Valid draft kinds — forwarded to Python verbatim.
	default:
		s.respondError(w, http.StatusUnprocessableEntity, "kind must be one of: intro, referral, followup, thanks")
		return
	}
	contactName, _ := req.Contact["name"].(string)
	relationship, _ := req.Contact["relationship"].(string)
	if contactName == "" {
		s.respondError(w, http.StatusUnprocessableEntity, "contact.name is required")
		return
	}
	if relationship == "" {
		s.respondError(w, http.StatusUnprocessableEntity, "contact.relationship is required")
		return
	}
	if len(contactName) > 200 {
		s.respondError(w, http.StatusBadRequest, "contact.name exceeds 200 characters")
		return
	}
	if len(relationship) > 200 {
		s.respondError(w, http.StatusBadRequest, "contact.relationship exceeds 200 characters")
		return
	}
	if notes, ok := req.Contact["notes"].(string); ok && len(notes) > 2000 {
		s.respondError(w, http.StatusBadRequest, "contact.notes exceeds 2000 characters")
		return
	}
	if desc, ok := req.Job["description"].(string); ok && len(desc) > 8000 {
		s.respondError(w, http.StatusBadRequest, "job.description exceeds 8000 characters")
		return
	}

	result, err := s.AI.PostJSONWithHeaders("/api/v1/referral/draft", req, s.getXUserHeaders(r))
	if err != nil {
		log.Printf("handleReferralDraft: draft failed: %v", err)
		s.respondAIGatewayError(w, err, "Failed to generate referral draft")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}
