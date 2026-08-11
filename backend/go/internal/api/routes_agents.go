package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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

		// `/agent/config` is the current name; `/hermes/config` is the legacy
		// codename kept as an alias so existing clients keep working.
		r.Get("/api/v1/agent/config", s.handleGetHermesConfig)
		r.Get("/api/v1/hermes/config", s.handleGetHermesConfig)

		// WS-03 take-over: pause a running apply-agent run and hand control to
		// the human-answer queue (agent_questions). Both /api/v1 and /api
		// twins are registered — route parity is asserted by
		// TestRouteParity_BidirectionalAliases.
		r.Post("/api/v1/agent-runs/{runId}/take-over", s.handleAgentRunTakeOver)
		r.Post("/api/agent-runs/{runId}/take-over", s.handleAgentRunTakeOver)
	})
}

// handleAgentRunTakeOver pauses a running/queued apply-agent run and, in the
// same transaction, enqueues a pending question for it in the human-answer
// queue (agent_questions). The run stays paused until the user answers; the
// queue's pending->answered transition is what unblocks it. Simple CRUD on
// Supabase tables — Go's lane, no Python hop.
func (s *Server) handleAgentRunTakeOver(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == [16]byte{} {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	uid := user.ID.String()
	runID := chi.URLParam(r, "runId")
	if runID == "" {
		s.respondError(w, http.StatusBadRequest, "runId is required")
		return
	}
	// Supabase's agent_runs.id is a uuid column; a malformed runId would fail
	// inside the UPDATE with a Postgres type error (500) instead of a 400.
	if _, err := uuid.Parse(runID); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid run id")
		return
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}

	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("handleAgentRunTakeOver: begin tx failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to start take-over")
		return
	}
	defer tx.Rollback()

	// Verify ownership + pause the run. The user-scoped WHERE doubles as the
	// authorization check: a run that isn't the caller's never matches.
	// progress is kept; only status/current_step move to the human gate.
	res, err := tx.ExecContext(r.Context(), `
		UPDATE agent_runs
		SET status = 'awaiting_review',
		    current_step = 'Take-over: paused for your input',
		    updated_at = NOW()
		WHERE id = $1 AND user_id = $2 AND status IN ('running', 'queued')
	`, runID, uid)
	if err != nil {
		log.Printf("handleAgentRunTakeOver: pause failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to pause the run")
		return
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		log.Printf("handleAgentRunTakeOver: rows affected failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to pause the run")
		return
	}
	if rowsAffected == 0 {
		// The run was not paused by this call (already not running, or not
		// owned by the caller). A prior take-over may have already paused it
		// and enqueued a question — resolve that question by (user, run) so
		// a repeated take-over returns the existing question id instead of
		// 404. If no owned pending question exists, preserve the not-found
		// error.
		var existingID string
		lookupErr := tx.QueryRowContext(r.Context(), `
			SELECT id FROM agent_questions
			WHERE user_id = $1 AND run_id = $2 AND status = 'pending'
			LIMIT 1
		`, uid, runID).Scan(&existingID)
		if lookupErr == nil && existingID != "" {
			if err := tx.Commit(); err != nil {
				log.Printf("handleAgentRunTakeOver: commit (existing) failed: %v", err)
				s.respondError(w, http.StatusInternalServerError, "Failed to complete take-over")
				return
			}
			s.respondJSON(w, http.StatusOK, map[string]interface{}{
				"ok":          true,
				"run_id":      runID,
				"question_id": existingID,
			})
			return
		}
		tx.Rollback()
		s.respondError(w, http.StatusNotFound, "Run not found or not running")
		return
	}

	// Enqueue one pending question for this run — but only if one isn't
	// already sitting in the queue for it. The INSERT..SELECT..WHERE NOT
	// EXISTS guard keeps repeated take-overs idempotent.
	var questionID string
	err = tx.QueryRowContext(r.Context(), `
		INSERT INTO agent_questions (user_id, run_id, job_title, company, field_label, field_type, status)
		SELECT $1, $2,
		       (SELECT job_title FROM agent_runs WHERE id = $2),
		       (SELECT company FROM agent_runs WHERE id = $2),
		       'Manual take-over — the agent paused and handed control to you',
		       'text',
		       'pending'
		WHERE NOT EXISTS (
			SELECT 1 FROM agent_questions
			WHERE user_id = $1 AND run_id = $2 AND status = 'pending'
		)
		RETURNING id
	`, uid, runID).Scan(&questionID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		log.Printf("handleAgentRunTakeOver: enqueue failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to enqueue the question")
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		// A pending question already exists for this (user, run) — resolve
		// its id so the response carries the real question id.
		var existingID string
		lookupErr := tx.QueryRowContext(r.Context(), `
			SELECT id FROM agent_questions
			WHERE user_id = $1 AND run_id = $2 AND status = 'pending'
			LIMIT 1
		`, uid, runID).Scan(&existingID)
		if lookupErr == nil && existingID != "" {
			questionID = existingID
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("handleAgentRunTakeOver: commit failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to complete take-over")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"ok":          true,
		"run_id":      runID,
		"question_id": questionID,
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
