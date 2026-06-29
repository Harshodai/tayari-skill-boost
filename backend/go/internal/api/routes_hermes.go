package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"tayari-backend/internal/models"
)

// -------------------------------------------------------------------
// Hermes agent layer (WS-E) — proxy routes to the Python AI service.
//
// All four handlers forward to the Python ``/api/v1/hermes/*`` endpoints via
// ``s.AI.PostJSON``/``s.AI.GetJSON``. The scrape endpoint is async-first on
// the Python side (enqueues a Celery task and returns a run_id immediately),
// so the 30s ``ai.Client`` timeout is never the bottleneck. ``GetJSON``
// surfaces non-2xx as an error, so 404s from Python are translated into a
// matching 404 to the Go caller.
// -------------------------------------------------------------------

// routesHermes wires the Hermes proxy routes (both /api/v1 and /api aliases).
func (s *Server) routesHermes(r chi.Router) {
	// v1 routes
	r.Post("/api/v1/hermes/scrape", s.handleHermesScrape)
	r.Get("/api/v1/hermes/jobs/{board}", s.handleHermesJobsBoard)
	r.Get("/api/v1/hermes/runs", s.handleHermesRunsList)
	r.Get("/api/v1/hermes/runs/active", s.handleHermesRunsActive)
	r.Get("/api/v1/hermes/runs/{id}", s.handleHermesRunDetail)
	r.Get("/api/v1/hermes/context", s.handleHermesContext)
	r.Get("/api/v1/hermes/status", s.handleHermesStatus)
	r.Post("/api/v1/hermes/sessions", s.handleHermesCreateSession)
	r.Post("/api/v1/hermes/sessions/{id}/events", s.handleHermesAddEvent)
	r.Get("/api/v1/hermes/sessions/{id}", s.handleHermesGetSession)

	// archive-compatible aliases (subset the frontend actually calls)
	r.Post("/api/hermes/scrape", s.handleHermesScrape)
	r.Get("/api/hermes/jobs/{board}", s.handleHermesJobsBoard)
	r.Get("/api/hermes/runs", s.handleHermesRunsList)
	r.Get("/api/hermes/runs/active", s.handleHermesRunsActive)
	r.Get("/api/hermes/runs/{id}", s.handleHermesRunDetail)
	r.Get("/api/hermes/context", s.handleHermesContext)
	r.Get("/api/hermes/status", s.handleHermesStatus)
	r.Post("/api/hermes/sessions", s.handleHermesCreateSession)
	r.Post("/api/hermes/sessions/{id}/events", s.handleHermesAddEvent)
	r.Get("/api/hermes/sessions/{id}", s.handleHermesGetSession)
}

// handleHermesRunsActive proxies GET /api/v1/hermes/runs/active — the K1
// observable-chain header chip. Forwards status=running&status=queued to the
// Python /hermes/runs list (which owns agent_runs + user scoping) and returns
// the merged list + a count envelope the chip can render in one poll.
// ponytail: assumes Python /hermes/runs accepts repeated status values
// (FastAPI List[str] Query). If it honors only the last, queued silently
// drops — upgrade to a direct agent_runs query if the chip undercounts.
func (s *Server) handleHermesRunsActive(w http.ResponseWriter, r *http.Request) {
	target := "/api/v1/hermes/runs?status=" + activeRunsStatusFilter + "&limit=" + strconv.Itoa(activeRunsLimit)
	result, err := s.AI.GetJSON(target)
	if err != nil {
		log.Printf("handleHermesRunsActive: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch active runs")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"count": countListItems(result),
		"runs":  result,
	})
}

// K1 / runs-active constants — single source of truth for the active-runs chip.
const (
	activeRunsLimit        = 50
	activeRunsStatusFilter = "running&status=queued" // repeated status values for FastAPI List[str]
)

// activeRunsListFields are the JSON keys a Python /hermes/runs response may
// use to wrap its run list. Tried in order by countListItems.
var activeRunsListFields = []string{"runs", "data", "items", "results"}

// countListItems best-effort counts the runs in a GetJSON response, which may
// be either a bare JSON array or an object wrapping the list under one of
// activeRunsListFields. SRP: isolates shape-tolerance from the handler.
func countListItems(result map[string]interface{}) int {
	b, err := json.Marshal(result)
	if err != nil {
		return 0
	}
	var arr []interface{}
	if json.Unmarshal(b, &arr) == nil {
		return len(arr)
	}
	var obj map[string]interface{}
	if json.Unmarshal(b, &obj) != nil {
		return 0
	}
	for _, k := range activeRunsListFields {
		if v, ok := obj[k].([]interface{}); ok {
			return len(v)
		}
	}
	return 0
}

// handleHermesScrape forwards the scrape request body to Python.
//
// The Python endpoint enqueues a Celery task by default (sync=false) and
// returns {run_id, status:"queued", task_id} immediately, so the 30s client
// timeout is never hit. When the caller passes sync=true the Python side
// runs the scrape inline; that path may exceed 30s for large boards, so we
// log a warning and forward as-is (the caller accepts the risk).
func (s *Server) handleHermesScrape(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to read request body")
		return
	}
	if len(body) == 0 {
		s.respondError(w, http.StatusBadRequest, "Request body is required")
		return
	}
	var probe struct {
		Sync bool `json:"sync"`
	}
	_ = json.Unmarshal(body, &probe) // tolerate non-JSON / extra fields
	if probe.Sync {
		log.Printf("handleHermesScrape: sync=true requested; this may exceed the 30s AI client timeout — recommend async")
	}

	result, err := s.AI.PostJSON("/api/v1/hermes/scrape", json.RawMessage(body))
	if err != nil {
		log.Printf("handleHermesScrape: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Hermes scrape failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// safeSlugPattern allows alphanumeric, hyphen, underscore. Used to validate
// path-parameter values before they are concatenated into internal URLs.
var safeSlugPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)
var safeUUIDOrSlug = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

// handleHermesJobsBoard proxies GET /api/v1/hermes/jobs/{board}?limit=N.
func (s *Server) handleHermesJobsBoard(w http.ResponseWriter, r *http.Request) {
	board := chi.URLParam(r, "board")
	if !safeSlugPattern.MatchString(board) {
		s.respondError(w, http.StatusBadRequest, "Invalid board identifier")
		return
	}
	limit := 40
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 200 {
			s.respondError(w, http.StatusBadRequest, "Invalid limit (1-200)")
			return
		}
		limit = n
	}
	target := "/api/v1/hermes/jobs/" + url.PathEscape(board) + "?limit=" + strconv.Itoa(limit)
	result, err := s.AI.GetJSON(target)
	if err != nil {
		log.Printf("handleHermesJobsBoard: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch cached jobs")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// allowedRunsListParams is the explicit allowlist of query keys the caller
// may forward to the internal Python /hermes/runs endpoint.
var allowedRunsListParams = map[string]bool{
	"run_type": true,
	"status":   true,
	"limit":    true,
}

// handleHermesRunsList proxies GET /api/v1/hermes/runs?run_type=...&status=...&limit=...
// Only allowlisted query keys are forwarded; values are length-bounded.
func (s *Server) handleHermesRunsList(w http.ResponseWriter, r *http.Request) {
	out := url.Values{}
	for key, vals := range r.URL.Query() {
		if !allowedRunsListParams[key] {
			continue
		}
		for _, v := range vals {
			if len(v) > 64 {
				s.respondError(w, http.StatusBadRequest, "Query parameter too long")
				return
			}
			out.Add(key, v)
		}
	}
	if raw := out.Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 200 {
			s.respondError(w, http.StatusBadRequest, "Invalid limit (1-200)")
			return
		}
		out.Set("limit", strconv.Itoa(n))
	}
	target := "/api/v1/hermes/runs"
	if enc := out.Encode(); enc != "" {
		target += "?" + enc
	}
	result, err := s.AI.GetJSON(target)
	if err != nil {
		log.Printf("handleHermesRunsList: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to list Hermes runs")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

// handleHermesRunDetail proxies GET /api/v1/hermes/runs/{id}. The id is
// validated against an allowlist pattern before being concatenated.
func (s *Server) handleHermesRunDetail(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !safeUUIDOrSlug.MatchString(id) {
		s.respondError(w, http.StatusBadRequest, "Invalid run id")
		return
	}
	result, err := s.AI.GetJSON("/api/v1/hermes/runs/" + url.PathEscape(id))
	if err != nil {
		if isPythonNotFound(err) {
			s.respondError(w, http.StatusNotFound, "Hermes run not found")
			return
		}
		log.Printf("handleHermesRunDetail: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to fetch Hermes run")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}


// isPythonNotFound returns true when the error from ai.Client.GetJSON indicates
// the Python service returned 404. The client formats non-2xx as
// "AI service returned %d: %s", so we detect the 404 status code substring.
// This avoids exposing the raw error body to the caller while still surfacing
// the not-found semantic.
func isPythonNotFound(err error) bool {
	if err == nil {
		return false
	}
	// ai.Client.GetJSON error: "AI service returned 404: <body>"
	return strings.Contains(err.Error(), " 404:")
}

func (s *Server) handleHermesContext(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	// 1. Fetch profile
	var p models.Profile
	var profileMap map[string]interface{}
	queryProfile := `SELECT id, full_name, email, headline, summary, skills, desired_roles, locations, experience_years, open_to_remote, links FROM profiles WHERE id=$1`
	err := s.DB.Conn.QueryRowContext(r.Context(), queryProfile, user.ID).Scan(
		&p.ID, &p.FullName, &p.Email, &p.Headline, &p.Summary, &p.Skills, &p.DesiredRoles, &p.Locations, &p.ExperienceYears, &p.OpenToRemote, &p.Links,
	)
	if err == nil {
		profileMap = map[string]interface{}{
			"profile_id":       p.ID,
			"full_name":        p.FullName,
			"email":            p.Email,
			"headline":         p.Headline,
			"summary":          p.Summary,
			"skills":           p.Skills,
			"desired_roles":    p.DesiredRoles,
			"locations":        p.Locations,
			"experience_years": p.ExperienceYears,
			"open_to_remote":   p.OpenToRemote,
			"links":            p.Links,
		}
	} else {
		// fallback empty profile
		profileMap = map[string]interface{}{
			"profile_id": user.ID,
			"email":      user.Email,
		}
	}

	// Build a profile summary text for the LLM
	var summaryParts []string
	if name, ok := profileMap["full_name"].(string); ok && name != "" {
		summaryParts = append(summaryParts, "Name: "+name)
	}
	if headline, ok := profileMap["headline"].(string); ok && headline != "" {
		summaryParts = append(summaryParts, "Headline: "+headline)
	}
	if summary, ok := profileMap["summary"].(string); ok && summary != "" {
		summaryParts = append(summaryParts, "Summary: "+summary)
	}
	if skillsRaw, ok := profileMap["skills"]; ok && skillsRaw != nil {
		var skills []string
		if b, err := json.Marshal(skillsRaw); err == nil {
			_ = json.Unmarshal(b, &skills)
		}
		if len(skills) > 0 {
			summaryParts = append(summaryParts, "Skills: "+strings.Join(skills, ", "))
		}
	}
	if rolesRaw, ok := profileMap["desired_roles"]; ok && rolesRaw != nil {
		var roles []string
		if b, err := json.Marshal(rolesRaw); err == nil {
			_ = json.Unmarshal(b, &roles)
		}
		if len(roles) > 0 {
			summaryParts = append(summaryParts, "Desired Roles: "+strings.Join(roles, ", "))
		}
	}
	profileSummaryText := strings.Join(summaryParts, " | ")

	// 2. Fetch latest resume
	var resumeID interface{}
	var resumeText string
	queryResume := `SELECT id, COALESCE(optimized_text, original_text) FROM resumes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`
	err = s.DB.Conn.QueryRowContext(r.Context(), queryResume, user.ID).Scan(&resumeID, &resumeText)
	latestResume := map[string]interface{}{
		"id":   nil,
		"text": "",
	}
	if err == nil {
		latestResume["id"] = resumeID
		latestResume["text"] = resumeText
	}

	// 3. Return aggregated context
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"user": map[string]interface{}{
			"id":    user.ID,
			"email": user.Email,
		},
		"profile":         profileMap,
		"profile_summary": profileSummaryText,
		"latest_resume":   latestResume,
		"instructions": "Use the Tayari Job Companion API (jobs/search, jobs/company-research, applications) on behalf of " +
			"this user. Prefer profile desired_roles, skills, and locations. Operate in " +
			"Review Mode: queue applications for human approval, never auto-submit without consent.",
	})
}

func (s *Server) handleHermesStatus(w http.ResponseWriter, r *http.Request) {
	configured := os.Getenv("HERMES_BASE_URL") != "" || os.Getenv("HERMES_AGENT_URL") != ""
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"configured": configured})
}

func (s *Server) handleHermesCreateSession(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Goal string `json:"goal"`
		Kind string `json:"kind"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Goal == "" {
		s.respondError(w, http.StatusBadRequest, "goal is required")
		return
	}
	if req.Kind == "" {
		req.Kind = "job_search"
	}

	sessionID := uuid.New()
	_, err := s.DB.Conn.ExecContext(r.Context(), `
		INSERT INTO hermes_sessions (id, user_id, goal, kind, status, events, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'running', '[]'::jsonb, NOW(), NOW())`,
		sessionID, user.ID, req.Goal, req.Kind)
	if err != nil {
		log.Printf("handleHermesCreateSession: insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create session")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":         sessionID.String(),
		"user_id":    user.ID.String(),
		"goal":       req.Goal,
		"kind":       req.Kind,
		"status":     "running",
		"events":     []interface{}{},
		"created_at": time.Now().UTC().Format(time.RFC3339),
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handleHermesAddEvent(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	sessionID := chi.URLParam(r, "id")

	var req struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Type == "" {
		s.respondError(w, http.StatusBadRequest, "type is required")
		return
	}

	event := map[string]interface{}{
		"id":      uuid.New().String(),
		"type":    req.Type,
		"message": req.Message,
		"at":      time.Now().UTC().Format(time.RFC3339),
	}
	eventJSON, _ := json.Marshal(event)

	_, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE hermes_sessions
		SET events = COALESCE(events, '[]'::jsonb) || $1::jsonb,
		    updated_at = NOW()
		WHERE id = $2::uuid AND user_id = $3`,
		string(eventJSON), sessionID, user.ID)
	if err != nil {
		log.Printf("handleHermesAddEvent: update failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to add event")
		return
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"ok":    true,
		"event": event,
	})
}

func (s *Server) handleHermesGetSession(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	sessionID := chi.URLParam(r, "id")

	var (
		id        uuid.UUID
		goal      string
		kind      string
		status    string
		eventsRaw []byte
		createdAt time.Time
		updatedAt time.Time
	)

	err := s.DB.Conn.QueryRowContext(r.Context(), `
		SELECT id, goal, kind, status, events, created_at, updated_at
		FROM hermes_sessions
		WHERE id = $1::uuid AND user_id = $2`,
		sessionID, user.ID).Scan(&id, &goal, &kind, &status, &eventsRaw, &createdAt, &updatedAt)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Session not found")
		return
	}

	var events []interface{}
	_ = json.Unmarshal(eventsRaw, &events)
	if events == nil {
		events = []interface{}{}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":         id.String(),
		"user_id":    user.ID.String(),
		"goal":       goal,
		"kind":       kind,
		"status":     status,
		"events":     events,
		"created_at": createdAt.Format(time.RFC3339),
		"updated_at": updatedAt.Format(time.RFC3339),
	})
}