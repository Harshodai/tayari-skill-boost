package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/capabilities"
)

type taskCreateRequest struct {
	Title     string `json:"title"`
	Objective string `json:"objective"`
}
type taskPlanRequest struct {
	Steps json.RawMessage `json:"steps"`
}

type taskPlanStep struct {
	Tool     string `json:"tool"`
	RiskTier string `json:"risk_tier"`
}

func validateTaskPlanSteps(raw json.RawMessage) error {
	var steps []taskPlanStep
	if err := json.Unmarshal(raw, &steps); err != nil || len(steps) == 0 {
		return fmt.Errorf("steps must be a non-empty array")
	}
	for _, step := range steps {
		if step.Tool == "" {
			continue
		}
		if step.Tool != "candidate_context.read" {
			return fmt.Errorf("tool %q is not available in the candidate-controlled runtime", step.Tool)
		}
		if step.RiskTier != "read" {
			return fmt.Errorf("candidate_context.read must use risk_tier read")
		}
	}
	return nil
}

type actionRequest struct {
	ActionType string          `json:"action_type"`
	RiskTier   string          `json:"risk_tier"`
	SiteOrigin string          `json:"site_origin"`
	Payload    json.RawMessage `json:"payload"`
}
type taskRecord struct {
	ID                  string     `json:"id"`
	Title               string     `json:"title"`
	Objective           string     `json:"objective"`
	Status              string     `json:"status"`
	StopRequestedAt     *time.Time `json:"stop_requested_at,omitempty"`
	TakeoverRequestedAt *time.Time `json:"takeover_requested_at,omitempty"`
	Version             int64      `json:"version"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}
type taskArtifactRecord struct {
	ID           string          `json:"id"`
	TaskID       string          `json:"task_id"`
	ArtifactType string          `json:"artifact_type"`
	Title        string          `json:"title"`
	ContentType  string          `json:"content_type"`
	Body         string          `json:"body"`
	Provenance   json.RawMessage `json:"provenance"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}
type taskPlanRecord struct {
	TaskID     string          `json:"task_id"`
	Version    int64           `json:"version"`
	Steps      json.RawMessage `json:"steps"`
	Status     string          `json:"status"`
	CreatedAt  time.Time       `json:"created_at"`
	ApprovedAt *time.Time      `json:"approved_at,omitempty"`
}
type actionRecord struct {
	ID         string          `json:"id"`
	TaskID     string          `json:"task_id"`
	ActionType string          `json:"action_type"`
	RiskTier   string          `json:"risk_tier"`
	SiteOrigin string          `json:"site_origin,omitempty"`
	Payload    json.RawMessage `json:"payload"`
	Status     string          `json:"status"`
	DecidedAt  *time.Time      `json:"decided_at,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

func (s *Server) routesTasks(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				if !s.requireCapability(w, capabilities.WorkspaceTaskControl) {
					return
				}
				next.ServeHTTP(w, req)
			})
		})
		r.Post("/api/v1/tasks", s.handleCreateTask)
		r.Post("/api/tasks", s.handleCreateTask)
		r.Get("/api/v1/tasks", s.handleListTasks)
		r.Get("/api/tasks", s.handleListTasks)
		r.Get("/api/v1/tasks/{taskID}", s.handleGetTask)
		r.Get("/api/tasks/{taskID}", s.handleGetTask)
		r.Get("/api/v1/tasks/{taskID}/events", s.handleListTaskEvents)
		r.Get("/api/tasks/{taskID}/events", s.handleListTaskEvents)
		r.Post("/api/v1/tasks/{taskID}/plan", s.handleCreateTaskPlan)
		r.Post("/api/tasks/{taskID}/plan", s.handleCreateTaskPlan)
		r.Get("/api/v1/tasks/{taskID}/plan", s.handleGetTaskPlan)
		r.Get("/api/tasks/{taskID}/plan", s.handleGetTaskPlan)
		r.Get("/api/v1/tasks/{taskID}/artifacts", s.handleListTaskArtifacts)
		r.Get("/api/tasks/{taskID}/artifacts", s.handleListTaskArtifacts)
		r.Post("/api/v1/tasks/{taskID}/plan/approve", s.handleApproveTaskPlan)
		r.Post("/api/tasks/{taskID}/plan/approve", s.handleApproveTaskPlan)
		r.Post("/api/v1/tasks/{taskID}/plan/reject", s.handleRejectTaskPlan)
		r.Post("/api/tasks/{taskID}/plan/reject", s.handleRejectTaskPlan)
		r.Post("/api/v1/tasks/{taskID}/pause", s.handlePauseTask)
		r.Post("/api/tasks/{taskID}/pause", s.handlePauseTask)
		r.Post("/api/v1/tasks/{taskID}/resume", s.handleResumeTask)
		r.Post("/api/tasks/{taskID}/resume", s.handleResumeTask)
		r.Post("/api/v1/tasks/{taskID}/takeover", s.handleTakeoverTask)
		r.Post("/api/tasks/{taskID}/takeover", s.handleTakeoverTask)
		r.Post("/api/v1/tasks/{taskID}/stop", s.handleStopTask)
		r.Post("/api/tasks/{taskID}/stop", s.handleStopTask)
		r.Post("/api/v1/tasks/{taskID}/actions", s.handleCreateActionProposal)
		r.Post("/api/tasks/{taskID}/actions", s.handleCreateActionProposal)
		r.Get("/api/v1/tasks/{taskID}/actions", s.handleListActionProposals)
		r.Get("/api/tasks/{taskID}/actions", s.handleListActionProposals)
		r.Post("/api/v1/tasks/{taskID}/actions/{actionID}/approve", s.handleApproveAction)
		r.Post("/api/tasks/{taskID}/actions/{actionID}/approve", s.handleApproveAction)
		r.Post("/api/v1/tasks/{taskID}/actions/{actionID}/deny", s.handleDenyAction)
		r.Post("/api/tasks/{taskID}/actions/{actionID}/deny", s.handleDenyAction)
	})
}

func taskOwner(r *http.Request) (string, bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok || user == nil || user.ID == [16]byte{} {
		return "", false
	}
	return user.ID.String(), true
}
func (s *Server) taskDB(w http.ResponseWriter) bool {
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return false
	}
	return true
}

// legacyTaskApprovalReady gates the candidate-owned task plan/action review
// loop. This capability is separate from the higher-risk automation approval
// bundle and never authorizes application submission.
func (s *Server) legacyTaskApprovalReady(w http.ResponseWriter) bool {
	if !s.requireCapability(w, capabilities.WorkspaceTaskControl) {
		return false
	}
	return s.taskDB(w)
}
func decodeTaskJSON(r *http.Request, target any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, 256*1024))
	dec.DisallowUnknownFields()
	return dec.Decode(target)
}
func taskID(r *http.Request) (string, error) {
	id := chi.URLParam(r, "taskID")
	_, err := uuid.Parse(id)
	return id, err
}
func validTaskText(value string, max int) bool {
	value = strings.TrimSpace(value)
	return len(value) > 0 && len(value) <= max
}

func (s *Server) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	if !s.taskDB(w) {
		return
	}
	var req taskCreateRequest
	if err := decodeTaskJSON(r, &req); err != nil || !validTaskText(req.Title, 240) || !validTaskText(req.Objective, 10000) {
		s.respondError(w, 400, "title and objective are required")
		return
	}
	id := uuid.New().String()
	_, err := s.DB.Conn.ExecContext(r.Context(), `INSERT INTO task_runs (id,user_id,title,objective,status) VALUES ($1,$2,$3,$4,'awaiting_plan_approval')`, id, uid, strings.TrimSpace(req.Title), strings.TrimSpace(req.Objective))
	if err != nil {
		s.respondError(w, 500, "failed to create task")
		return
	}
	_, _ = s.DB.Conn.ExecContext(r.Context(), `INSERT INTO task_events (task_id,user_id,event_type,payload) VALUES ($1,$2,'task.created',$3)`, id, uid, []byte(`{"status":"awaiting_plan_approval"}`))
	s.writeTask(w, r, id, uid, 201)
}
func (s *Server) writeTask(w http.ResponseWriter, r *http.Request, id, uid string, status int) {
	var item taskRecord
	err := s.DB.Conn.QueryRowContext(r.Context(), `SELECT id,title,objective,status,stop_requested_at,takeover_requested_at,version,created_at,updated_at FROM task_runs WHERE id=$1 AND user_id=$2`, id, uid).Scan(&item.ID, &item.Title, &item.Objective, &item.Status, &item.StopRequestedAt, &item.TakeoverRequestedAt, &item.Version, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		s.respondError(w, 404, "task not found")
		return
	}
	s.respondJSON(w, status, item)
}
func (s *Server) handleListTasks(w http.ResponseWriter, r *http.Request) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	if !s.taskDB(w) {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `SELECT id,title,objective,status,stop_requested_at,takeover_requested_at,version,created_at,updated_at FROM task_runs WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100`, uid)
	if err != nil {
		s.respondError(w, 500, "failed to list tasks")
		return
	}
	defer rows.Close()
	result := []taskRecord{}
	for rows.Next() {
		var item taskRecord
		if err := rows.Scan(&item.ID, &item.Title, &item.Objective, &item.Status, &item.StopRequestedAt, &item.TakeoverRequestedAt, &item.Version, &item.CreatedAt, &item.UpdatedAt); err == nil {
			result = append(result, item)
		}
	}
	s.respondJSON(w, 200, map[string]any{"tasks": result})
}
func (s *Server) handleGetTask(w http.ResponseWriter, r *http.Request) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	id, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	if !s.taskDB(w) {
		return
	}
	s.writeTask(w, r, id, uid, 200)
}
func (s *Server) handleTaskTransition(w http.ResponseWriter, r *http.Request, status string, event string) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	id, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	if !s.taskDB(w) {
		return
	}
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, 500, "failed to start transition")
		return
	}
	defer tx.Rollback()
	var query string
	switch event {
	case "task.stop_requested":
		query = `UPDATE task_runs SET status='stopped',stop_requested_at=now(),version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2 AND status NOT IN ('completed','stopped')`
	case "task.takeover_requested":
		query = `UPDATE task_runs SET status='awaiting_takeover',takeover_requested_at=now(),version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2 AND status NOT IN ('completed','stopped')`
	default:
		query = `UPDATE task_runs SET status=$3,version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2 AND status NOT IN ('completed','stopped')`
	}
	args := []any{id, uid}
	if event != "task.stop_requested" && event != "task.takeover_requested" {
		args = append(args, status)
	}
	res, err := tx.ExecContext(r.Context(), query, args...)
	if err != nil {
		s.respondError(w, 500, "transition failed")
		return
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		s.respondError(w, 409, "task cannot transition from its current state")
		return
	}
	_, _ = tx.ExecContext(r.Context(), `INSERT INTO task_events (task_id,user_id,event_type,payload) VALUES ($1,$2,$3,$4)`, id, uid, event, []byte(`{}`))
	if err := tx.Commit(); err != nil {
		s.respondError(w, 500, "transition failed")
		return
	}
	s.writeTask(w, r, id, uid, 200)
}
func (s *Server) handlePauseTask(w http.ResponseWriter, r *http.Request) {
	s.handleTaskTransition(w, r, "paused", "task.paused")
}
func (s *Server) handleResumeTask(w http.ResponseWriter, r *http.Request) {
	s.handleTaskTransition(w, r, "queued", "task.resumed")
}
func (s *Server) handleTakeoverTask(w http.ResponseWriter, r *http.Request) {
	s.handleTaskTransition(w, r, "", "task.takeover_requested")
}
func (s *Server) handleStopTask(w http.ResponseWriter, r *http.Request) {
	s.handleTaskTransition(w, r, "", "task.stop_requested")
}

func (s *Server) handleCreateTaskPlan(w http.ResponseWriter, r *http.Request) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	id, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	if !s.taskDB(w) {
		return
	}
	var req taskPlanRequest
	if err := decodeTaskJSON(r, &req); err != nil || len(req.Steps) == 0 || !json.Valid(req.Steps) {
		s.respondError(w, 400, "steps must be valid JSON")
		return
	}
	if err := validateTaskPlanSteps(req.Steps); err != nil {
		s.respondError(w, 400, err.Error())
		return
	}
	var version int64
	err = s.DB.Conn.QueryRowContext(r.Context(), `SELECT COALESCE(MAX(version),0)+1 FROM task_plans WHERE task_id=$1 AND user_id=$2`, id, uid).Scan(&version)
	if err != nil {
		s.respondError(w, 500, "failed to version plan")
		return
	}
	res, err := s.DB.Conn.ExecContext(r.Context(), `INSERT INTO task_plans (task_id,user_id,version,steps) SELECT $1,$2,$3,$4 WHERE EXISTS (SELECT 1 FROM task_runs WHERE id=$1 AND user_id=$2)`, id, uid, version, req.Steps)
	if err != nil {
		s.respondError(w, 500, "failed to create plan")
		return
	}
	if n, _ := res.RowsAffected(); n != 1 {
		s.respondError(w, 404, "task not found")
		return
	}
	_, _ = s.DB.Conn.ExecContext(r.Context(), `INSERT INTO task_events (task_id,user_id,event_type,payload) VALUES ($1,$2,'plan.proposed',$3)`, id, uid, req.Steps)
	s.respondJSON(w, 201, map[string]any{"task_id": id, "version": version, "status": "proposed", "steps": json.RawMessage(req.Steps)})
}

func (s *Server) handleGetTaskPlan(w http.ResponseWriter, r *http.Request) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	id, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	if !s.taskDB(w) {
		return
	}
	var plan taskPlanRecord
	err = s.DB.Conn.QueryRowContext(r.Context(), `SELECT task_id,version,steps,status,created_at,approved_at FROM task_plans WHERE task_id=$1 AND user_id=$2 ORDER BY version DESC LIMIT 1`, id, uid).Scan(&plan.TaskID, &plan.Version, &plan.Steps, &plan.Status, &plan.CreatedAt, &plan.ApprovedAt)
	if err != nil {
		s.respondError(w, 404, "task plan not found")
		return
	}
	s.respondJSON(w, 200, plan)
}
func (s *Server) handleListTaskArtifacts(w http.ResponseWriter, r *http.Request) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	id, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	if !s.taskDB(w) {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `SELECT id,task_id,artifact_type,title,content_type,body,provenance,created_at,updated_at FROM task_artifacts WHERE task_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 50`, id, uid)
	if err != nil {
		s.respondError(w, 500, "failed to list task artifacts")
		return
	}
	defer rows.Close()
	artifacts := []taskArtifactRecord{}
	for rows.Next() {
		var artifact taskArtifactRecord
		if err := rows.Scan(&artifact.ID, &artifact.TaskID, &artifact.ArtifactType, &artifact.Title, &artifact.ContentType, &artifact.Body, &artifact.Provenance, &artifact.CreatedAt, &artifact.UpdatedAt); err == nil {
			artifacts = append(artifacts, artifact)
		}
	}
	s.respondJSON(w, 200, map[string]any{"artifacts": artifacts})
}

func (s *Server) handlePlanDecision(w http.ResponseWriter, r *http.Request, approved bool) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	id, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	if !s.legacyTaskApprovalReady(w) {
		return
	}
	status := "rejected"
	taskStatus := "awaiting_plan_approval"
	if approved {
		status = "approved"
		taskStatus = "queued"
	}
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, 500, "failed to decide plan")
		return
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(r.Context(), `UPDATE task_plans SET status=$3,approved_at=CASE WHEN $3='approved' THEN now() ELSE NULL END WHERE task_id=$1 AND user_id=$2 AND status='proposed' AND version=(SELECT MAX(version) FROM task_plans WHERE task_id=$1 AND user_id=$2)`, id, uid, status)
	if err != nil {
		s.respondError(w, 500, "failed to decide plan")
		return
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		s.respondError(w, 409, "no proposed plan is available")
		return
	}
	_, err = tx.ExecContext(r.Context(), `UPDATE task_runs SET status=$3,version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2`, id, uid, taskStatus)
	if err != nil {
		s.respondError(w, 500, "failed to update task")
		return
	}
	_, _ = tx.ExecContext(r.Context(), `INSERT INTO task_events (task_id,user_id,event_type,payload) VALUES ($1,$2,$3,$4)`, id, uid, func() string {
		if approved {
			return "plan.approved"
		}
		return "plan.rejected"
	}(), []byte(`{}`))
	if err := tx.Commit(); err != nil {
		s.respondError(w, 500, "failed to decide plan")
		return
	}
	s.writeTask(w, r, id, uid, 200)
}
func (s *Server) handleApproveTaskPlan(w http.ResponseWriter, r *http.Request) {
	s.handlePlanDecision(w, r, true)
}
func (s *Server) handleRejectTaskPlan(w http.ResponseWriter, r *http.Request) {
	s.handlePlanDecision(w, r, false)
}

func (s *Server) handleCreateActionProposal(w http.ResponseWriter, r *http.Request) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	if !s.requireCapability(w, capabilities.WorkspaceTaskControl) {
		return
	}
	taskID, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	if !s.taskDB(w) {
		return
	}
	var req actionRequest
	if err := decodeTaskJSON(r, &req); err != nil || !validTaskText(req.ActionType, 120) || !validTaskText(req.RiskTier, 32) {
		s.respondError(w, 400, "action_type and risk_tier are required")
		return
	}
	allowed := map[string]bool{"read": true, "navigation": true, "draft": true, "sensitive": true, "external_write": true, "submission": true}
	if !allowed[req.RiskTier] {
		s.respondError(w, 400, "invalid risk tier")
		return
	}
	if req.RiskTier == "submission" {
		s.respondError(w, http.StatusForbidden, "legacy submission approvals are disabled; use the canonical governed approval service")
		return
	}
	payload := req.Payload
	if len(payload) == 0 {
		payload = []byte(`{}`)
	}
	var id string
	err = s.DB.Conn.QueryRowContext(r.Context(), `INSERT INTO action_proposals (task_id,user_id,action_type,risk_tier,site_origin,payload,expires_at) SELECT $1,$2,$3,$4,$5,$6,now()+interval '15 minutes' WHERE EXISTS (SELECT 1 FROM task_runs WHERE id=$1 AND user_id=$2) RETURNING id`, taskID, uid, req.ActionType, req.RiskTier, req.SiteOrigin, payload).Scan(&id)
	if err != nil {
		s.respondError(w, 500, "failed to create action proposal")
		return
	}
	s.respondJSON(w, 201, map[string]any{"id": id, "task_id": taskID, "status": "pending", "risk_tier": req.RiskTier, "submission_disabled": req.RiskTier == "submission"})
}
func (s *Server) handleListActionProposals(w http.ResponseWriter, r *http.Request) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	id, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	if !s.taskDB(w) {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `SELECT id,task_id,action_type,risk_tier,COALESCE(site_origin,''),payload,status,decided_at,created_at FROM action_proposals WHERE task_id=$1 AND user_id=$2 ORDER BY created_at DESC`, id, uid)
	if err != nil {
		s.respondError(w, 500, "failed to list actions")
		return
	}
	defer rows.Close()
	result := []actionRecord{}
	for rows.Next() {
		var a actionRecord
		if err := rows.Scan(&a.ID, &a.TaskID, &a.ActionType, &a.RiskTier, &a.SiteOrigin, &a.Payload, &a.Status, &a.DecidedAt, &a.CreatedAt); err == nil {
			result = append(result, a)
		}
	}
	s.respondJSON(w, 200, map[string]any{"actions": result})
}
func (s *Server) handleActionDecision(w http.ResponseWriter, r *http.Request, approved bool) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	taskID, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	actionID := chi.URLParam(r, "actionID")
	if _, err := uuid.Parse(actionID); err != nil {
		s.respondError(w, 400, "invalid action id")
		return
	}
	if !s.legacyTaskApprovalReady(w) {
		return
	}
	if approved {
		var tier string
		if err := s.DB.Conn.QueryRowContext(r.Context(), `SELECT risk_tier FROM action_proposals WHERE id=$1 AND task_id=$2 AND user_id=$3 AND status='pending' AND expires_at>now()`, actionID, taskID, uid).Scan(&tier); err != nil {
			s.respondError(w, 409, "action proposal is no longer pending")
			return
		}
		if tier == "submission" {
			s.respondError(w, 403, "application submission remains disabled by default")
			return
		}
	}
	status := "denied"
	if approved {
		status = "approved"
	}
	res, err := s.DB.Conn.ExecContext(r.Context(), `UPDATE action_proposals SET status=$4,decided_at=now() WHERE id=$1 AND task_id=$2 AND user_id=$3 AND status='pending' AND expires_at>now()`, actionID, taskID, uid, status)
	if err != nil {
		s.respondError(w, 500, "failed to decide action")
		return
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		s.respondError(w, 409, "action proposal is no longer pending")
		return
	}
	s.respondJSON(w, 200, map[string]any{"id": actionID, "status": status})
}
func (s *Server) handleApproveAction(w http.ResponseWriter, r *http.Request) {
	s.handleActionDecision(w, r, true)
}
func (s *Server) handleDenyAction(w http.ResponseWriter, r *http.Request) {
	s.handleActionDecision(w, r, false)
}

func (s *Server) handleListTaskEvents(w http.ResponseWriter, r *http.Request) {
	uid, ok := taskOwner(r)
	if !ok {
		s.respondError(w, 401, "Unauthorized")
		return
	}
	id, err := taskID(r)
	if err != nil {
		s.respondError(w, 400, "invalid task id")
		return
	}
	if !s.taskDB(w) {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `SELECT sequence_no,event_type,payload,created_at FROM task_events WHERE task_id=$1 AND user_id=$2 ORDER BY sequence_no`, id, uid)
	if err != nil {
		s.respondError(w, 500, "failed to list events")
		return
	}
	defer rows.Close()
	events := []map[string]any{}
	for rows.Next() {
		var seq int64
		var kind string
		var payload json.RawMessage
		var created time.Time
		if err := rows.Scan(&seq, &kind, &payload, &created); err == nil {
			events = append(events, map[string]any{"sequence_no": seq, "event_type": kind, "payload": payload, "created_at": created})
		}
	}
	s.respondJSON(w, 200, map[string]any{"events": events})
}

var _ = sql.ErrNoRows
