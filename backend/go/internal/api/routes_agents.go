package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
)

// routesAgents wires the Digital Employees and Tool Approvals proxy routes.
func (s *Server) routesAgents(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		r.Get("/api/v1/agents", s.handleListAgents)
		r.Post("/api/v1/agents", s.handleCreateAgent)
		r.Put("/api/v1/agents/{name}/instructions", s.handleUpdateAgentInstructions)
		r.Delete("/api/v1/agents/{name}", s.handleDeleteAgent)

		r.Post("/api/v1/agents/{agent_id}/tasks", s.handleCreateAgentTask)
		r.Get("/api/v1/agents/{agent_id}/tasks", s.handleListAgentTasks)
		r.Get("/api/v1/agents/tasks", s.handleListAllAgentTasks)
		r.Get("/api/v1/agents/tasks/{task_id}", s.handleGetAgentTaskDetails)
		r.Get("/api/v1/agents/tasks/{task_id}/events", s.handleListAgentTaskEvents)

		r.Get("/api/v1/approvals", s.handleListApprovals)
		r.Put("/api/v1/approvals/{approval_id}", s.handleUpdateApproval)

		r.Get("/api/v1/hermes/config", s.handleGetHermesConfig)
	})
}

func (s *Server) getXUserHeaders(r *http.Request) map[string]string {
	headers := make(map[string]string)
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if ok && user != nil {
		headers["X-User-Id"] = user.ID.String()
	}
	return headers
}

func (s *Server) handleListAgents(w http.ResponseWriter, r *http.Request) {
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/agents", headers)
	if err != nil {
		log.Printf("handleListAgents: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to list agents")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCreateAgent(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/agents", json.RawMessage(body), headers)
	if err != nil {
		log.Printf("handleCreateAgent: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to save agent")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleUpdateAgentInstructions(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		s.respondError(w, http.StatusBadRequest, "Agent name is required")
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/agents/"+name+"/instructions", json.RawMessage(body), headers)
	if err != nil {
		log.Printf("handleUpdateAgentInstructions: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to update instructions")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleDeleteAgent(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		s.respondError(w, http.StatusBadRequest, "Agent name is required")
		return
	}
	// Python backend delete endpoint can be triggered via POST/PUT or we can support a DELETE request.
	// In fastapi agents_routes.py we registered it as @router.delete("/agents/{name}")
	// Let's proxy it. Note: ai.Client doesn't have a DeleteJSON helper yet, but we can write one or use http client.
	// Since delete endpoint has no body and is simple, we can do it via a standard http request or extend GetJSONWithHeaders.
	// Wait, we can implement DeleteJSONWithHeaders in client.go, or we can simply request it here.
	// Let's look at the implementation of client.go. We can add DeleteJSONWithHeaders, or write it in routes_agents.go using s.AI.client.Do.
	// Writing it here is very simple:
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	req, err := http.NewRequest(http.MethodDelete, s.AI.BaseURL+"/api/v1/agents/"+name, nil)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Internal Server Error")
		return
	}
	req.Header.Set("X-User-Id", user.ID.String())

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("handleDeleteAgent: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to delete agent")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		s.respondError(w, resp.StatusCode, string(bodyBytes))
		return
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		s.respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleListApprovals(w http.ResponseWriter, r *http.Request) {
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/approvals", headers)
	if err != nil {
		log.Printf("handleListApprovals: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to list approvals")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleUpdateApproval(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "approval_id")
	if id == "" {
		s.respondError(w, http.StatusBadRequest, "Approval id is required")
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/approvals/"+id, json.RawMessage(body), headers)
	if err != nil {
		log.Printf("handleUpdateApproval: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to update approval")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleGetHermesConfig(w http.ResponseWriter, r *http.Request) {
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/hermes/config", headers)
	if err != nil {
		log.Printf("handleGetHermesConfig: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch Hermes config")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCreateAgentTask(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agent_id")
	if agentID == "" {
		s.respondError(w, http.StatusBadRequest, "Agent ID is required")
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.PostJSONWithHeaders("/api/v1/agents/"+agentID+"/tasks", json.RawMessage(body), headers)
	if err != nil {
		log.Printf("handleCreateAgentTask: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to enqueue task")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleListAgentTasks(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agent_id")
	if agentID == "" {
		s.respondError(w, http.StatusBadRequest, "Agent ID is required")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/agents/"+agentID+"/tasks", headers)
	if err != nil {
		log.Printf("handleListAgentTasks: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to list tasks")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleGetAgentTaskDetails(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "task_id")
	if taskID == "" {
		s.respondError(w, http.StatusBadRequest, "Task ID is required")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/agents/tasks/"+taskID, headers)
	if err != nil {
		log.Printf("handleGetAgentTaskDetails: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to get task details")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleListAgentTaskEvents(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "task_id")
	if taskID == "" {
		s.respondError(w, http.StatusBadRequest, "Task ID is required")
		return
	}
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/agents/tasks/"+taskID+"/events", headers)
	if err != nil {
		log.Printf("handleListAgentTaskEvents: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to list task events")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleListAllAgentTasks(w http.ResponseWriter, r *http.Request) {
	headers := s.getXUserHeaders(r)
	result, err := s.AI.GetJSONWithHeaders("/api/v1/agents/tasks", headers)
	if err != nil {
		log.Printf("handleListAllAgentTasks: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to list all agent tasks")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}
