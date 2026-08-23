package api

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/capabilities"
)

type automationDefinitionRequest struct {
	Name           string          `json:"name"`
	Objective      string          `json:"objective"`
	TriggerType    string          `json:"trigger_type"`
	TriggerConfig  json.RawMessage `json:"trigger_config"`
	ToolAllowlist  json.RawMessage `json:"tool_allowlist"`
	ApprovalPolicy json.RawMessage `json:"approval_policy"`
	RetentionDays  int             `json:"retention_days"`
	Budget         json.RawMessage `json:"budget"`
}

type automationRunRequest struct {
	IdempotencyKey string `json:"idempotency_key"`
	ExpiresSeconds int    `json:"expires_seconds"`
}

type automationEventRequest struct {
	EventID    uuid.UUID       `json:"event_id"`
	EventType  string          `json:"event_type"`
	Source     string          `json:"source"`
	OccurredAt time.Time       `json:"occurred_at"`
	Payload    json.RawMessage `json:"payload"`
}

type automationApprovalRequest struct {
	ActionType     string          `json:"action_type"`
	RiskTier       string          `json:"risk_tier"`
	Summary        string          `json:"summary"`
	Payload        json.RawMessage `json:"payload"`
	PolicyVersion  string          `json:"policy_version"`
	ExpiresSeconds int             `json:"expires_seconds"`
}

type notificationPreferencesRequest struct {
	EmailEnabled    bool            `json:"email_enabled"`
	EmailAddress    string          `json:"email_address"`
	WhatsAppEnabled bool            `json:"whatsapp_enabled"`
	PhoneE164       string          `json:"phone_e164"`
	WhatsAppOptIn   bool            `json:"whatsapp_opt_in"`
	Locale          string          `json:"locale"`
	QuietHours      json.RawMessage `json:"quiet_hours"`
	FallbackOrder   json.RawMessage `json:"fallback_order"`
}

func (s *Server) routesAutomations(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		r.Post("/api/v1/automations", s.handleCreateAutomation)
		r.Post("/api/automations", s.handleCreateAutomation)
		r.Get("/api/v1/automations", s.handleListAutomations)
		r.Get("/api/automations", s.handleListAutomations)
		r.Post("/api/v1/automations/{automationID}/runs", s.handleCreateAutomationRun)
		r.Post("/api/automations/{automationID}/runs", s.handleCreateAutomationRun)
		r.Post("/api/v1/automations/events", s.handleIngestAutomationEvent)
		r.Post("/api/automations/events", s.handleIngestAutomationEvent)
		r.Get("/api/v1/automation-runs/{runID}", s.handleGetAutomationRun)
		r.Get("/api/automation-runs/{runID}", s.handleGetAutomationRun)
		r.Get("/api/v1/automation-runs/{runID}/events", s.handleListAutomationEvents)
		r.Get("/api/automation-runs/{runID}/events", s.handleListAutomationEvents)
		r.Post("/api/v1/automation-runs/{runID}/pause", s.handlePauseAutomationRun)
		r.Post("/api/automation-runs/{runID}/pause", s.handlePauseAutomationRun)
		r.Post("/api/v1/automation-runs/{runID}/resume", s.handleResumeAutomationRun)
		r.Post("/api/automation-runs/{runID}/resume", s.handleResumeAutomationRun)
		r.Post("/api/v1/automation-runs/{runID}/cancel", s.handleCancelAutomationRun)
		r.Post("/api/automation-runs/{runID}/cancel", s.handleCancelAutomationRun)
		r.Post("/api/v1/automation-runs/{runID}/approvals", s.handleCreateAutomationApproval)
		r.Post("/api/automation-runs/{runID}/approvals", s.handleCreateAutomationApproval)
		r.Get("/api/v1/approvals", s.handleListAutomationApprovals)
		r.Get("/api/approvals", s.handleListAutomationApprovals)
		r.Post("/api/v1/approvals/{approvalID}/approve", s.handleApproveAutomationApproval)
		r.Post("/api/approvals/{approvalID}/approve", s.handleApproveAutomationApproval)
		r.Post("/api/v1/approvals/{approvalID}/deny", s.handleDenyAutomationApproval)
		r.Post("/api/approvals/{approvalID}/deny", s.handleDenyAutomationApproval)
		r.Get("/api/v1/notification-preferences", s.handleGetNotificationPreferences)
		r.Get("/api/notification-preferences", s.handleGetNotificationPreferences)
		r.Put("/api/v1/notification-preferences", s.handlePutNotificationPreferences)
		r.Put("/api/notification-preferences", s.handlePutNotificationPreferences)
	})
}

func decodeAutomationJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 256*1024))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func automationOwner(r *http.Request) (uuid.UUID, uuid.UUID, bool) {
	user, tenantID, ok := calendarUser(r)
	if !ok || user == nil || user.ID == uuid.Nil || tenantID == uuid.Nil {
		return uuid.Nil, uuid.Nil, false
	}
	return user.ID, tenantID, true
}

func validAutomationTrigger(value string) bool {
	switch value {
	case "manual", "schedule", "webhook", "provider_event", "approval_decision", "task_event":
		return true
	default:
		return false
	}
}

func validAutomationEventType(value string) bool {
	switch value {
	case "job_watch.due", "job_watch.requested", "job_match.found", "candidate_bundle.requested", "application.stage_changed", "application.outcome_recorded", "pipeline.sweep_due", "automation.approval.requested", "automation.approval.approved", "automation.approval.denied", "notification.retry_due", "calendar.interview_detected", "learning.sweep_due":
		return true
	default:
		return false
	}
}

func validAutomationRisk(value string) bool {
	switch value {
	case "read", "navigation", "draft", "sensitive", "external_write", "submission":
		return true
	default:
		return false
	}
}

func jsonOrEmpty(raw json.RawMessage) []byte {
	if len(raw) == 0 || !json.Valid(raw) {
		return []byte(`{}`)
	}
	return raw
}

func (s *Server) automationReady(w http.ResponseWriter, capability capabilities.Name) bool {
	if !s.requireCapability(w, capability) {
		return false
	}
	if s.DB == nil || s.DB.Conn == nil {
		s.respondError(w, http.StatusServiceUnavailable, "database unavailable")
		return false
	}
	return true
}

func writeAutomationEvent(r *http.Request, tx *sql.Tx, runID, userID, tenantID uuid.UUID, eventType string, payload []byte) error {
	_, err := tx.ExecContext(r.Context(), `INSERT INTO automation_events (run_id, tenant_id, user_id, event_type, payload) VALUES ($1,$2,$3,$4,$5)`, runID, tenantID, userID, eventType, payload)
	return err
}

func writeAutomationInboxEvent(r *http.Request, tx *sql.Tx, eventID, userID, tenantID uuid.UUID, eventType, source string, payload []byte) error {
	_, err := tx.ExecContext(r.Context(), `INSERT INTO automation_event_inbox (event_id,tenant_id,user_id,event_type,source,occurred_at,payload) VALUES ($1,$2,$3,$4,$5,now(),$6) ON CONFLICT (event_id) DO NOTHING`, eventID, tenantID, userID, eventType, source, payload)
	return err
}

func (s *Server) handleCreateAutomation(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceAutomations) {
		return
	}
	var req automationDefinitionRequest
	if err := decodeAutomationJSON(r, &req); err != nil || strings.TrimSpace(req.Name) == "" || len(req.Name) > 160 || strings.TrimSpace(req.Objective) == "" || len(req.Objective) > 10000 || !validAutomationTrigger(req.TriggerType) {
		s.respondError(w, http.StatusBadRequest, "name, objective, and a valid trigger_type are required")
		return
	}
	retention := req.RetentionDays
	if retention == 0 {
		retention = 90
	}
	if retention < 1 || retention > 3650 {
		s.respondError(w, http.StatusBadRequest, "retention_days must be between 1 and 3650")
		return
	}
	var id uuid.UUID
	err := s.DB.Conn.QueryRowContext(r.Context(), `INSERT INTO automation_definitions (tenant_id,user_id,name,objective,trigger_type,trigger_config,tool_allowlist,approval_policy,retention_days,budget,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft') RETURNING id`, tenantID, userID, strings.TrimSpace(req.Name), strings.TrimSpace(req.Objective), req.TriggerType, jsonOrEmpty(req.TriggerConfig), jsonOrEmpty(req.ToolAllowlist), jsonOrEmpty(req.ApprovalPolicy), retention, jsonOrEmpty(req.Budget)).Scan(&id)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to create automation")
		return
	}
	s.respondJSON(w, http.StatusCreated, map[string]any{"id": id, "status": "draft", "approval_required": true})
}

func (s *Server) handleListAutomations(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceAutomations) {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `SELECT id,name,objective,trigger_type,status,policy_version,created_at,updated_at FROM automation_definitions WHERE tenant_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 100`, tenantID, userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to list automations")
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id uuid.UUID
		var name, objective, triggerType, status, policyVersion string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &name, &objective, &triggerType, &status, &policyVersion, &createdAt, &updatedAt); err != nil {
			continue
		}
		items = append(items, map[string]any{"id": id, "name": name, "objective": objective, "trigger_type": triggerType, "status": status, "policy_version": policyVersion, "created_at": createdAt, "updated_at": updatedAt})
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"automations": items})
}

func (s *Server) handleIngestAutomationEvent(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceAutomations) {
		return
	}
	var req automationEventRequest
	if err := decodeAutomationJSON(r, &req); err != nil || req.EventID == uuid.Nil || !validAutomationEventType(strings.TrimSpace(req.EventType)) || strings.TrimSpace(req.Source) == "" || len(strings.TrimSpace(req.Source)) > 160 {
		s.respondError(w, http.StatusBadRequest, "event_id, supported event_type, and bounded source are required")
		return
	}
	if len(req.Payload) == 0 {
		req.Payload = json.RawMessage(`{}`)
	}
	if len(req.Payload) > 64*1024 || !json.Valid(req.Payload) {
		s.respondError(w, http.StatusBadRequest, "payload must be valid JSON no larger than 64 KiB")
		return
	}
	occurredAt := req.OccurredAt
	if occurredAt.IsZero() {
		occurredAt = time.Now().UTC()
	}
	var accepted bool
	err := s.DB.Conn.QueryRowContext(r.Context(), `INSERT INTO automation_event_inbox (event_id,tenant_id,user_id,event_type,source,occurred_at,payload) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (event_id) DO NOTHING RETURNING true`, req.EventID, tenantID, userID, strings.TrimSpace(req.EventType), strings.TrimSpace(req.Source), occurredAt, req.Payload).Scan(&accepted)
	if err == sql.ErrNoRows {
		s.respondJSON(w, http.StatusAccepted, map[string]any{"accepted": false, "duplicate": true, "event_id": req.EventID})
		return
	}
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to enqueue automation event")
		return
	}
	s.respondJSON(w, http.StatusAccepted, map[string]any{"accepted": accepted, "duplicate": false, "event_id": req.EventID, "status": "received"})
}

func (s *Server) handleCreateAutomationRun(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceAutomations) {
		return
	}
	automationID, err := uuid.Parse(chi.URLParam(r, "automationID"))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid automation id")
		return
	}
	var req automationRunRequest
	if err := decodeAutomationJSON(r, &req); err != nil || strings.TrimSpace(req.IdempotencyKey) == "" || len(req.IdempotencyKey) > 200 {
		s.respondError(w, http.StatusBadRequest, "idempotency_key is required")
		return
	}
	expiresSeconds := req.ExpiresSeconds
	if expiresSeconds == 0 {
		expiresSeconds = 86400
	}
	if expiresSeconds < 60 || expiresSeconds > 604800 {
		s.respondError(w, http.StatusBadRequest, "expires_seconds must be between 60 and 604800")
		return
	}
	var runID uuid.UUID
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to start automation run")
		return
	}
	defer tx.Rollback()
	err = tx.QueryRowContext(r.Context(), `INSERT INTO automation_runs (definition_id,tenant_id,user_id,status,idempotency_key,expires_at) SELECT $1,$2,$3,'queued',$4,now()+($5 * interval '1 second') WHERE EXISTS (SELECT 1 FROM automation_definitions WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status='active') ON CONFLICT (tenant_id,user_id,idempotency_key) DO UPDATE SET updated_at=now() RETURNING id`, automationID, tenantID, userID, strings.TrimSpace(req.IdempotencyKey), expiresSeconds).Scan(&runID)
	if err != nil {
		s.respondError(w, http.StatusConflict, "automation is not active or idempotency key is already in use")
		return
	}
	if err := writeAutomationEvent(r, tx, runID, userID, tenantID, "automation.run.queued", []byte(`{"status":"queued"}`)); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to record automation event")
		return
	}
	if err := tx.Commit(); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to commit automation run")
		return
	}
	s.respondJSON(w, http.StatusCreated, map[string]any{"id": runID, "status": "queued", "approval_required": true})
}

func parseAutomationRunID(r *http.Request) (uuid.UUID, error) {
	return uuid.Parse(chi.URLParam(r, "runID"))
}

func (s *Server) handleGetAutomationRun(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceAutomations) {
		return
	}
	runID, err := parseAutomationRunID(r)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid run id")
		return
	}
	var status string
	var definitionID uuid.UUID
	var version int64
	var expiresAt, createdAt, updatedAt time.Time
	err = s.DB.Conn.QueryRowContext(r.Context(), `SELECT definition_id,status,version,expires_at,created_at,updated_at FROM automation_runs WHERE id=$1 AND tenant_id=$2 AND user_id=$3`, runID, tenantID, userID).Scan(&definitionID, &status, &version, &expiresAt, &createdAt, &updatedAt)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "automation run not found")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"id": runID, "definition_id": definitionID, "status": status, "version": version, "expires_at": expiresAt, "created_at": createdAt, "updated_at": updatedAt})
}

func (s *Server) transitionAutomationRun(w http.ResponseWriter, r *http.Request, target, event string) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceAutomations) {
		return
	}
	runID, err := parseAutomationRunID(r)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid run id")
		return
	}
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to start transition")
		return
	}
	defer tx.Rollback()
	res, err := tx.ExecContext(r.Context(), `UPDATE automation_runs SET status=$4, version=version+1, updated_at=now(), completed_at=CASE WHEN $4 IN ('cancelled','completed','failed','expired') THEN now() ELSE completed_at END WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status NOT IN ('completed','failed','cancelled','expired')`, runID, tenantID, userID, target)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to transition automation run")
		return
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		s.respondError(w, http.StatusConflict, "automation run cannot transition from its current state")
		return
	}
	if err := writeAutomationEvent(r, tx, runID, userID, tenantID, event, []byte(fmt.Sprintf(`{"status":%q}`, target))); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to record automation transition")
		return
	}
	if err := tx.Commit(); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to commit automation transition")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"id": runID, "status": target})
}

func (s *Server) handlePauseAutomationRun(w http.ResponseWriter, r *http.Request) {
	s.transitionAutomationRun(w, r, "paused", "automation.run.paused")
}
func (s *Server) handleResumeAutomationRun(w http.ResponseWriter, r *http.Request) {
	s.transitionAutomationRun(w, r, "resumed", "automation.run.resumed")
}
func (s *Server) handleCancelAutomationRun(w http.ResponseWriter, r *http.Request) {
	s.transitionAutomationRun(w, r, "cancelled", "automation.run.cancelled")
}

func (s *Server) handleListAutomationEvents(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceAutomations) {
		return
	}
	runID, err := parseAutomationRunID(r)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid run id")
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `SELECT sequence_no,event_type,payload,created_at FROM automation_events WHERE run_id=$1 AND tenant_id=$2 AND user_id=$3 ORDER BY sequence_no`, runID, tenantID, userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to list automation events")
		return
	}
	defer rows.Close()
	events := make([]map[string]any, 0)
	for rows.Next() {
		var sequence int64
		var eventType string
		var payload json.RawMessage
		var createdAt time.Time
		if rows.Scan(&sequence, &eventType, &payload, &createdAt) == nil {
			events = append(events, map[string]any{"sequence_no": sequence, "event_type": eventType, "payload": payload, "created_at": createdAt})
		}
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"events": events})
}

func randomApprovalToken() (string, string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", err
	}
	token := hex.EncodeToString(bytes)
	digest := sha256.Sum256([]byte(token))
	return token, hex.EncodeToString(digest[:]), nil
}

func canonicalApprovalHash(req automationApprovalRequest) string {
	payload := jsonOrEmpty(req.Payload)
	data := strings.Join([]string{req.ActionType, req.RiskTier, req.Summary, string(payload), req.PolicyVersion}, "\x00")
	digest := sha256.Sum256([]byte(data))
	return hex.EncodeToString(digest[:])
}

func (s *Server) handleCreateAutomationApproval(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceApprovals) {
		return
	}
	runID, err := parseAutomationRunID(r)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid run id")
		return
	}
	var req automationApprovalRequest
	if err := decodeAutomationJSON(r, &req); err != nil || strings.TrimSpace(req.ActionType) == "" || strings.TrimSpace(req.Summary) == "" || len(req.Summary) > 2000 || !validAutomationRisk(req.RiskTier) {
		s.respondError(w, http.StatusBadRequest, "action_type, risk_tier, and summary are required")
		return
	}
	if req.RiskTier == "submission" {
		s.respondError(w, http.StatusForbidden, "submission remains disabled by default")
		return
	}
	expiresSeconds := req.ExpiresSeconds
	if expiresSeconds == 0 {
		expiresSeconds = 900
	}
	if expiresSeconds < 60 || expiresSeconds > 86400 {
		s.respondError(w, http.StatusBadRequest, "expires_seconds must be between 60 and 86400")
		return
	}
	if req.PolicyVersion == "" {
		req.PolicyVersion = "v1"
	}
	token, digest, err := randomApprovalToken()
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to create approval token")
		return
	}
	actionHash := canonicalApprovalHash(req)
	var approvalID uuid.UUID
	expiresAt := time.Now().Add(time.Duration(expiresSeconds) * time.Second)
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to start approval")
		return
	}
	defer tx.Rollback()
	err = tx.QueryRowContext(r.Context(), `INSERT INTO approval_requests (run_id,tenant_id,user_id,action_type,risk_tier,action_hash,summary,payload,policy_version,review_token_digest,token_expires_at) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11 WHERE EXISTS (SELECT 1 FROM automation_runs WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status IN ('queued','running','paused','resumed','awaiting_action_approval')) RETURNING id`, runID, tenantID, userID, req.ActionType, req.RiskTier, actionHash, strings.TrimSpace(req.Summary), jsonOrEmpty(req.Payload), req.PolicyVersion, digest, expiresAt).Scan(&approvalID)
	if err != nil {
		s.respondError(w, http.StatusConflict, "automation run is not eligible for approval")
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE automation_runs SET status='awaiting_action_approval', version=version+1, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND user_id=$3`, runID, tenantID, userID); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to pause automation for approval")
		return
	}
	approvalPayload := []byte(fmt.Sprintf(`{"approval_id":%q,"risk_tier":%q}`, approvalID, req.RiskTier))
	if err := writeAutomationEvent(r, tx, runID, userID, tenantID, "automation.approval.requested", approvalPayload); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to record approval event")
		return
	}
	if err := writeAutomationInboxEvent(r, tx, approvalID, userID, tenantID, "automation.approval.requested", "go.automation_api", approvalPayload); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to enqueue approval event")
		return
	}
	if err := tx.Commit(); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to commit approval")
		return
	}
	// The raw token is returned only to the authenticated caller that created the
	// approval. Provider adapters should consume it immediately and never persist it.
	s.respondJSON(w, http.StatusCreated, map[string]any{"id": approvalID, "status": "pending", "risk_tier": req.RiskTier, "action_hash": actionHash, "expires_at": expiresAt, "review_token": token, "delivery_state": "in_app_pending"})
}

func (s *Server) handleListAutomationApprovals(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceApprovals) {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `SELECT id,run_id,action_type,risk_tier,summary,status,token_expires_at,decision_channel,decided_at,created_at FROM approval_requests WHERE tenant_id=$1 AND user_id=$2 AND status IN ('pending','delivered','viewed') ORDER BY created_at DESC LIMIT 100`, tenantID, userID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to list approvals")
		return
	}
	defer rows.Close()
	items := make([]map[string]any, 0)
	for rows.Next() {
		var id uuid.UUID
		var runID *uuid.UUID
		var actionType, riskTier, summary, status string
		var expiresAt time.Time
		var channel sql.NullString
		var decidedAt, createdAt sql.NullTime
		if rows.Scan(&id, &runID, &actionType, &riskTier, &summary, &status, &expiresAt, &channel, &decidedAt, &createdAt) == nil {
			items = append(items, map[string]any{"id": id, "run_id": runID, "action_type": actionType, "risk_tier": riskTier, "summary": summary, "status": status, "expires_at": expiresAt, "decision_channel": channel.String, "decided_at": decidedAt.Time, "created_at": createdAt.Time})
		}
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"approvals": items})
}

func (s *Server) decideAutomationApproval(w http.ResponseWriter, r *http.Request, decision string) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceApprovals) {
		return
	}
	approvalID, err := uuid.Parse(chi.URLParam(r, "approvalID"))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid approval id")
		return
	}
	tx, err := s.DB.Conn.BeginTx(r.Context(), nil)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to start approval decision")
		return
	}
	defer tx.Rollback()
	var runID *uuid.UUID
	var riskTier string
	var tokenExpiresAt time.Time
	err = tx.QueryRowContext(r.Context(), `SELECT run_id,risk_tier,token_expires_at FROM approval_requests WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status IN ('pending','delivered','viewed') FOR UPDATE`, approvalID, tenantID, userID).Scan(&runID, &riskTier, &tokenExpiresAt)
	if err != nil || time.Now().After(tokenExpiresAt) {
		s.respondError(w, http.StatusConflict, "approval is missing or expired")
		return
	}
	if riskTier == "submission" {
		s.respondError(w, http.StatusForbidden, "submission remains disabled by default")
		return
	}
	if _, err := tx.ExecContext(r.Context(), `UPDATE approval_requests SET status=$4, decision_channel='in_app', decided_at=now(), decided_by=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status IN ('pending','delivered','viewed')`, approvalID, tenantID, userID, decision); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to decide approval")
		return
	}
	if runID != nil {
		if _, err := tx.ExecContext(r.Context(), `UPDATE automation_runs SET status=$2, version=version+1, updated_at=now() WHERE id=$1 AND tenant_id=$3 AND user_id=$4`, *runID, map[string]string{"approved": "resumed", "denied": "failed"}[decision], tenantID, userID); err != nil {
			s.respondError(w, http.StatusInternalServerError, "failed to update automation run")
			return
		}
		decisionPayload := []byte(fmt.Sprintf(`{"approval_id":%q,"decision":%q}`, approvalID, decision))
		_ = writeAutomationEvent(r, tx, *runID, userID, tenantID, "automation.approval."+decision, decisionPayload)
		decisionEventID := uuid.NewSHA1(uuid.NameSpaceURL, []byte("tayari:approval:"+approvalID.String()+":"+decision))
		_ = writeAutomationInboxEvent(r, tx, decisionEventID, userID, tenantID, "automation.approval."+decision, "go.automation_api", decisionPayload)

	}
	if err := tx.Commit(); err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to commit approval decision")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"id": approvalID, "status": decision, "decision_channel": "in_app"})
}

func (s *Server) handleApproveAutomationApproval(w http.ResponseWriter, r *http.Request) {
	s.decideAutomationApproval(w, r, "approved")
}
func (s *Server) handleDenyAutomationApproval(w http.ResponseWriter, r *http.Request) {
	s.decideAutomationApproval(w, r, "denied")
}

func (s *Server) handleGetNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceApprovals) {
		return
	}
	var emailEnabled, whatsappEnabled bool
	var emailAddress, phoneE164, locale, whatsappWAID string
	var whatsappVerifiedAt sql.NullTime
	var optIn, optOut sql.NullTime
	var quietHours, fallback json.RawMessage
	err := s.DB.Conn.QueryRowContext(r.Context(), `SELECT email_enabled,COALESCE(email_address,''),whatsapp_enabled,COALESCE(phone_e164,''),COALESCE(whatsapp_wa_id,''),whatsapp_verified_at,whatsapp_opt_in_at,whatsapp_opt_out_at,locale,quiet_hours,fallback_order FROM notification_preferences WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID).Scan(&emailEnabled, &emailAddress, &whatsappEnabled, &phoneE164, &whatsappWAID, &whatsappVerifiedAt, &optIn, &optOut, &locale, &quietHours, &fallback)
	if err == sql.ErrNoRows {
		s.respondJSON(w, http.StatusOK, map[string]any{"email_enabled": false, "whatsapp_enabled": false, "whatsapp_opt_in": false, "whatsapp_verified": false, "locale": "en", "quiet_hours": json.RawMessage(`{}`), "fallback_order": json.RawMessage(`["in_app"]`)})
		return
	}
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to load notification preferences")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"email_enabled": emailEnabled, "email_address": emailAddress, "whatsapp_enabled": whatsappEnabled, "phone_e164": phoneE164, "whatsapp_opt_in": optIn.Valid && !optOut.Valid, "whatsapp_verified": whatsappVerifiedAt.Valid && whatsappWAID != "", "locale": locale, "quiet_hours": quietHours, "fallback_order": fallback})
}

func (s *Server) handlePutNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	userID, tenantID, ok := automationOwner(r)
	if !ok {
		s.respondError(w, http.StatusForbidden, "Verified tenant context required")
		return
	}
	if !s.automationReady(w, capabilities.WorkspaceApprovals) {
		return
	}
	var req notificationPreferencesRequest
	if err := decodeAutomationJSON(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid notification preferences")
		return
	}
	if strings.TrimSpace(req.PhoneE164) != "" && !validWhatsAppPhoneE164(req.PhoneE164) {
		s.respondError(w, http.StatusBadRequest, "phone_e164 must be a valid E.164 phone number")
		return
	}
	if req.WhatsAppEnabled && (!req.WhatsAppOptIn || !validWhatsAppPhoneE164(req.PhoneE164)) {
		s.respondError(w, http.StatusBadRequest, "WhatsApp requires explicit opt-in and a valid E.164 phone number")
		return
	}
	if req.WhatsAppEnabled {
		var verifiedAt sql.NullTime
		var waID, verifiedPhone string
		if err := s.DB.Conn.QueryRowContext(r.Context(), `SELECT whatsapp_verified_at,COALESCE(whatsapp_wa_id,''),COALESCE(phone_e164,'') FROM notification_preferences WHERE tenant_id=$1 AND user_id=$2`, tenantID, userID).Scan(&verifiedAt, &waID, &verifiedPhone); err != nil || !verifiedAt.Valid || strings.TrimSpace(waID) == "" || strings.TrimSpace(verifiedPhone) != strings.TrimSpace(req.PhoneE164) {
			s.respondError(w, http.StatusPreconditionFailed, "WhatsApp phone ownership must be confirmed for this phone before enabling approval delivery")
			return
		}
	}

	locale := strings.TrimSpace(req.Locale)
	if locale == "" {
		locale = "en"
	}
	_, err := s.DB.Conn.ExecContext(r.Context(), `INSERT INTO notification_preferences (tenant_id,user_id,email_enabled,email_address,whatsapp_enabled,phone_e164,whatsapp_opt_in_at,whatsapp_opt_out_at,locale,quiet_hours,fallback_order) VALUES ($1,$2,$3,NULLIF($4,''),$5,NULLIF($6,''),CASE WHEN $7 THEN now() ELSE NULL END,CASE WHEN $7 THEN NULL ELSE now() END,$8,$9,$10) ON CONFLICT (tenant_id,user_id) DO UPDATE SET email_enabled=$3,email_address=NULLIF($4,''),whatsapp_enabled=$5,phone_e164=NULLIF($6,''),whatsapp_wa_id=CASE WHEN $5 THEN notification_preferences.whatsapp_wa_id ELSE NULL END,whatsapp_verified_at=CASE WHEN $5 THEN notification_preferences.whatsapp_verified_at ELSE NULL END,whatsapp_opt_in_at=CASE WHEN $7 AND $5 THEN now() ELSE NULL END,whatsapp_opt_out_at=CASE WHEN $7 AND $5 THEN NULL ELSE now() END,locale=$8,quiet_hours=$9,fallback_order=$10,updated_at=now()`, tenantID, userID, req.EmailEnabled, strings.TrimSpace(req.EmailAddress), req.WhatsAppEnabled, strings.TrimSpace(req.PhoneE164), req.WhatsAppOptIn, locale, jsonOrEmpty(req.QuietHours), jsonOrEmpty(req.FallbackOrder))
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "failed to save notification preferences")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]any{"ok": true, "email_enabled": req.EmailEnabled, "whatsapp_enabled": req.WhatsAppEnabled, "whatsapp_opt_in": req.WhatsAppOptIn})
}
