package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// routesCareerOps wires the Career-Ops proxy routes.
func (s *Server) routesCareerOps(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		r.Post("/api/v1/career-ops/evaluate", s.handleCareerOpsEvaluate)
		r.Post("/api/v1/career-ops/scan", s.handleCareerOpsScan)
		r.Get("/api/v1/career-ops/patterns", s.handleCareerOpsGetPatterns)
		r.Get("/api/v1/career-ops/followups", s.handleCareerOpsGetFollowups)
		r.Post("/api/v1/career-ops/followups/action", s.handleCareerOpsFollowupAction)
		
		r.Get("/api/v1/career-ops/portals", s.handleCareerOpsGetPortals)
		r.Post("/api/v1/career-ops/portals", s.handleCareerOpsSavePortal)
		r.Delete("/api/v1/career-ops/portals/{portal_id}", s.handleCareerOpsDeletePortal)

		r.Get("/api/v1/career-ops/story-bank", s.handleCareerOpsGetStoryBank)
		r.Post("/api/v1/career-ops/story-bank", s.handleCareerOpsSaveStoryBank)
	})
}

func (s *Server) handleCareerOpsEvaluate(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/career-ops/evaluate", json.RawMessage(body), headers)
	if err != nil {
		log.Printf("handleCareerOpsEvaluate: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to run Career-Ops evaluation")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerOpsScan(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/career-ops/scan", json.RawMessage(body), headers)
	if err != nil {
		log.Printf("handleCareerOpsScan: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to scan portals")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerOpsGetPatterns(w http.ResponseWriter, r *http.Request) {
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/career-ops/patterns", headers)
	if err != nil {
		log.Printf("handleCareerOpsGetPatterns: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to get targeting patterns")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerOpsGetFollowups(w http.ResponseWriter, r *http.Request) {
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/career-ops/followups", headers)
	if err != nil {
		log.Printf("handleCareerOpsGetFollowups: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to get follow-up items")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerOpsFollowupAction(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/career-ops/followups/action", json.RawMessage(body), headers)
	if err != nil {
		log.Printf("handleCareerOpsFollowupAction: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to record follow-up")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerOpsGetPortals(w http.ResponseWriter, r *http.Request) {
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/career-ops/portals", headers)
	if err != nil {
		log.Printf("handleCareerOpsGetPortals: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to get portals list")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerOpsSavePortal(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/career-ops/portals", json.RawMessage(body), headers)
	if err != nil {
		log.Printf("handleCareerOpsSavePortal: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to save portal configuration")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerOpsDeletePortal(w http.ResponseWriter, r *http.Request) {
	portalIDStr := chi.URLParam(r, "portal_id")
	portalID, err := strconv.Atoi(portalIDStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid portal ID")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.DeleteJSONWithHeaders("/api/v1/career-ops/portals/"+strconv.Itoa(portalID), headers)
	if err != nil {
		log.Printf("handleCareerOpsDeletePortal: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to delete portal")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerOpsGetStoryBank(w http.ResponseWriter, r *http.Request) {
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/career-ops/story-bank", headers)
	if err != nil {
		log.Printf("handleCareerOpsGetStoryBank: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to get story bank")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCareerOpsSaveStoryBank(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/career-ops/story-bank", json.RawMessage(body), headers)
	if err != nil {
		log.Printf("handleCareerOpsSaveStoryBank: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to save story bank")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}
