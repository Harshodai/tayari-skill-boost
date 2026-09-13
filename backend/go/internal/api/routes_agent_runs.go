package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"tayari-backend/internal/auth"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// routesAgentRuns exposes the apply-agent run history the frontend
// (src/lib/agent/applyAgent.ts) reads: list, detail, steps, and the
// candidate-driven submit/cancel transition.
//
// Every statement carries an owner predicate (user_id = $n). The Go gateway
// connects as a BYPASSRLS role, so these predicates are the only tenant
// isolation on this path — never relax them.
func (s *Server) routesAgentRuns(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		r.Get("/api/v1/agent-runs", s.handleListAgentRuns)
		r.Get("/api/agent-runs", s.handleListAgentRuns)
		r.Get("/api/v1/agent-runs/{runId}", s.handleGetAgentRun)
		r.Get("/api/agent-runs/{runId}", s.handleGetAgentRun)
		r.Get("/api/v1/agent-runs/{runId}/steps", s.handleListAgentRunSteps)
		r.Get("/api/agent-runs/{runId}/steps", s.handleListAgentRunSteps)
		r.Post("/api/v1/agent-runs/{runId}/transition", s.handleAgentRunTransition)
		r.Post("/api/agent-runs/{runId}/transition", s.handleAgentRunTransition)
	})
}

type agentRunRow struct {
	ID          string  `json:"id"`
	JobTitle    *string `json:"job_title"`
	Company     *string `json:"company"`
	JobURL      *string `json:"job_url"`
	Mode        string  `json:"mode"`
	Status      string  `json:"status"`
	Progress    int     `json:"progress"`
	CurrentStep *string `json:"current_step"`
	Outcome     *string `json:"outcome"`
	SubmittedAt *string `json:"submitted_at"`
	CreatedAt   string  `json:"created_at"`
}

type agentRunStepRow struct {
	ID            string  `json:"id"`
	RunID         string  `json:"run_id"`
	Idx           int     `json:"idx"`
	Name          string  `json:"name"`
	Status        string  `json:"status"`
	Detail        *string `json:"detail"`
	Logs          *string `json:"logs"`
	ScreenshotURL *string `json:"screenshot_url"`
	CreatedAt     string  `json:"created_at"`
}

// agentRunActor resolves the caller and the run id, rejecting anonymous
// callers and malformed uuids before any SQL runs.
func (s *Server) agentRunActor(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == [16]byte{} {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return "", "", false
	}
	runID := chi.URLParam(r, "runId")
	if runID != "" {
		if _, err := uuid.Parse(runID); err != nil {
			s.respondError(w, http.StatusBadRequest, "invalid run id")
			return "", "", false
		}
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return "", "", false
	}
	return user.ID.String(), runID, true
}

func (s *Server) handleListAgentRuns(w http.ResponseWriter, r *http.Request) {
	uid, _, ok := s.agentRunActor(w, r)
	if !ok {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `
		SELECT id, job_title, company, job_url, mode, status, progress,
		       current_step, outcome, submitted_at::text, created_at::text
		FROM agent_runs
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 50
	`, uid)
	if err != nil {
		log.Printf("handleListAgentRuns: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load runs")
		return
	}
	defer rows.Close()

	runs := make([]agentRunRow, 0, 50)
	for rows.Next() {
		var run agentRunRow
		if err := rows.Scan(&run.ID, &run.JobTitle, &run.Company, &run.JobURL, &run.Mode,
			&run.Status, &run.Progress, &run.CurrentStep, &run.Outcome, &run.SubmittedAt, &run.CreatedAt); err != nil {
			log.Printf("handleListAgentRuns: scan failed: %v", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to load runs")
			return
		}
		runs = append(runs, run)
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleListAgentRuns: rows err: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load runs")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"runs": runs})
}

func (s *Server) handleGetAgentRun(w http.ResponseWriter, r *http.Request) {
	uid, runID, ok := s.agentRunActor(w, r)
	if !ok {
		return
	}
	var run agentRunRow
	err := s.DB.Conn.QueryRowContext(r.Context(), `
		SELECT id, job_title, company, job_url, mode, status, progress,
		       current_step, outcome, submitted_at::text, created_at::text
		FROM agent_runs
		WHERE id = $1 AND user_id = $2
	`, runID, uid).Scan(&run.ID, &run.JobTitle, &run.Company, &run.JobURL, &run.Mode,
		&run.Status, &run.Progress, &run.CurrentStep, &run.Outcome, &run.SubmittedAt, &run.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		s.respondError(w, http.StatusNotFound, "Run not found")
		return
	}
	if err != nil {
		log.Printf("handleGetAgentRun: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load run")
		return
	}
	s.respondJSON(w, http.StatusOK, run)
}

func (s *Server) handleListAgentRunSteps(w http.ResponseWriter, r *http.Request) {
	uid, runID, ok := s.agentRunActor(w, r)
	if !ok {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `
		SELECT id, run_id, idx, name, status, detail, logs, screenshot_url, created_at::text
		FROM agent_run_steps
		WHERE run_id = $1 AND user_id = $2
		ORDER BY idx ASC
	`, runID, uid)
	if err != nil {
		log.Printf("handleListAgentRunSteps: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load run steps")
		return
	}
	defer rows.Close()

	steps := make([]agentRunStepRow, 0, 16)
	for rows.Next() {
		var step agentRunStepRow
		if err := rows.Scan(&step.ID, &step.RunID, &step.Idx, &step.Name, &step.Status,
			&step.Detail, &step.Logs, &step.ScreenshotURL, &step.CreatedAt); err != nil {
			log.Printf("handleListAgentRunSteps: scan failed: %v", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to load run steps")
			return
		}
		steps = append(steps, step)
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleListAgentRunSteps: rows err: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load run steps")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"steps": steps})
}

// handleAgentRunTransition applies the candidate's decision on a prepared run.
//
// Manual-submit boundary: the agent never submits. "submit" records that the
// candidate confirmed the application was sent. That alone is candidate-
// confirmed but externally unverified, so it does NOT spend a credit. A credit
// is debited only when a verified submission receipt exists for the run, and
// the ledger reference makes that debit idempotent.
func (s *Server) handleAgentRunTransition(w http.ResponseWriter, r *http.Request) {
	uid, runID, ok := s.agentRunActor(w, r)
	if !ok {
		return
	}
	var payload struct {
		Action string `json:"action"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024)).Decode(&payload); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var newStatus string
	switch payload.Action {
	case "submit":
		newStatus = "submitted"
	case "cancel":
		newStatus = "cancelled"
	default:
		s.respondError(w, http.StatusBadRequest, "action must be submit or cancel")
		return
	}

	res, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE agent_runs
		SET status = $3,
		    submitted_at = CASE WHEN $3 = 'submitted' THEN NOW() ELSE submitted_at END,
		    current_step = CASE WHEN $3 = 'submitted'
		                        THEN 'Candidate confirmed submission'
		                        ELSE 'Cancelled by you' END,
		    updated_at = NOW()
		WHERE id = $1 AND user_id = $2
		  AND status IN ('queued', 'running', 'awaiting_review')
	`, runID, uid, newStatus)
	if err != nil {
		log.Printf("handleAgentRunTransition: update failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to update the run")
		return
	}
	affected, err := res.RowsAffected()
	if err != nil || affected == 0 {
		s.respondError(w, http.StatusNotFound, "Run not found or already finished")
		return
	}

	response := map[string]interface{}{"status": newStatus, "credit_debited": false}

	if newStatus == "submitted" && s.Billing != nil {
		// Only an externally verified receipt spends a credit.
		var verified bool
		lookupErr := s.DB.Conn.QueryRowContext(r.Context(), `
			SELECT TRUE FROM submission_receipts
			WHERE run_id = $1 AND user_id = $2 AND verified = TRUE
			LIMIT 1
		`, runID, uid).Scan(&verified)
		switch {
		case errors.Is(lookupErr, sql.ErrNoRows):
			response["credit_note"] = "Recorded as candidate-confirmed. No credit spent until a verified receipt is captured."
		case lookupErr != nil:
			log.Printf("handleAgentRunTransition: receipt lookup failed: %v", lookupErr)
			response["credit_note"] = "Submission recorded; credit status could not be checked."
		default:
			okDebit, balance, debitErr := s.Billing.DebitCredit(uid, 1, "receipt_"+runID, "Verified submission")
			if debitErr != nil {
				log.Printf("handleAgentRunTransition: debit failed: %v", debitErr)
				response["credit_note"] = "Verified submission recorded; the credit could not be charged."
			} else if !okDebit {
				response["credit_note"] = "Verified submission recorded, but you have no submission credits left."
			} else {
				response["credit_debited"] = true
				if balance != nil {
					response["balance"] = balance.Balance
				}
			}
		}
	}

	s.respondJSON(w, http.StatusOK, response)
}
