package api

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"database/sql"
	"bytes"
	"mime/multipart"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)


// -------------------------------------------------------------------
// Profile
// -------------------------------------------------------------------

func (s *Server) handleGetProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var p models.Profile
	query := `SELECT id, full_name, avatar_url, email, headline, summary, skills, desired_roles, locations, experience_years, open_to_remote, links, created_at, updated_at FROM profiles WHERE id=$1`
	err := s.DB.Conn.QueryRowContext(r.Context(), query, user.ID).Scan(
		&p.ID, &p.FullName, &p.AvatarURL, &p.Email, &p.Headline, &p.Summary, &p.Skills, &p.DesiredRoles, &p.Locations, &p.ExperienceYears, &p.OpenToRemote, &p.Links, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		log.Printf("handleGetProfile: scan error for user %s: %v", user.ID, err)
		// If no profile row, return a default empty profile with profile_id
		p.ID = user.ID
		p.Email = user.Email
		s.respondJSON(w, http.StatusOK, map[string]interface{}{
			"profile_id": p.ID,
			"email":      p.Email,
		})
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"profile_id": p.ID,
		"full_name":  p.FullName,
		"avatar_url": p.AvatarURL,
		"email":      p.Email,
		"headline":   p.Headline,
		"summary":    p.Summary,
		"skills":     p.Skills,
		"desired_roles":    p.DesiredRoles,
		"locations":        p.Locations,
		"experience_years": p.ExperienceYears,
		"open_to_remote":   p.OpenToRemote,
		"links":            p.Links,
		"created_at":       p.CreatedAt,
		"updated_at":       p.UpdatedAt,
	})
}

func (s *Server) handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var req models.Profile
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	query := `
		INSERT INTO profiles (id, full_name, avatar_url, email, headline, summary, skills, desired_roles, locations, experience_years, open_to_remote, links, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
		ON CONFLICT (id) DO UPDATE SET
			full_name = EXCLUDED.full_name,
			avatar_url = EXCLUDED.avatar_url,
			email = EXCLUDED.email,
			headline = EXCLUDED.headline,
			summary = EXCLUDED.summary,
			skills = EXCLUDED.skills,
			desired_roles = EXCLUDED.desired_roles,
			locations = EXCLUDED.locations,
			experience_years = EXCLUDED.experience_years,
			open_to_remote = EXCLUDED.open_to_remote,
			links = EXCLUDED.links,
			updated_at = NOW()
		RETURNING updated_at
	`
	var updatedAt time.Time
	err := s.DB.Conn.QueryRowContext(r.Context(), query, user.ID, req.FullName, req.AvatarURL, user.Email, req.Headline, req.Summary, req.Skills, req.DesiredRoles, req.Locations, req.ExperienceYears, req.OpenToRemote, req.Links).Scan(&updatedAt)
	if err != nil {
		log.Printf("handleUpdateProfile: failed to upsert profile: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"updated_at": updatedAt})
}

// -------------------------------------------------------------------
// Job Search
// -------------------------------------------------------------------

func (s *Server) handleJobSearch(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	// Validate: require at least a query or location
	query, _ := req["query"].(string)
	location, _ := req["location"].(string)
	if query == "" && location == "" {
		s.respondError(w, http.StatusBadRequest, "query or location is required")
		return
	}

	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if ok && user != nil {
		req["user_id"] = user.ID.String()
	}

	result, err := s.AI.PostJSON("/api/v1/jobs/search", req)
	if err != nil {
		log.Printf("handleJobSearch: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Job search failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleAgentSearch(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req["user_id"] = user.ID.String()

	result, err := s.AI.PostJSON("/api/v1/jobs/agent-search", req)
	if err != nil {
		log.Printf("handleAgentSearch: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Agent search failed")
		return
	}

	// Format result to match integration test schema: {session_id, events, count, jobs, top_research}
	var pyResp struct {
		Events []interface{} `json:"events"`
		Result struct {
			Query      string        `json:"query"`
			TotalFound int           `json:"total_found"`
			Results    []interface{} `json:"results"`
		} `json:"result"`
	}

	// Re-marshal and unmarshal result to parse properly
	resultBytes, _ := json.Marshal(result)
	_ = json.Unmarshal(resultBytes, &pyResp)

	sessionID := uuid.New()
	eventsJSON, _ := json.Marshal(pyResp.Events)

	queryStr := ""
	if q, ok := req["query"].(string); ok {
		queryStr = q
	}

	_, err = s.DB.Conn.ExecContext(r.Context(), `
		INSERT INTO hermes_sessions (id, user_id, goal, kind, status, events, created_at, updated_at)
		VALUES ($1, $2, $3, 'job_search', 'done', $4, NOW(), NOW())`,
		sessionID, user.ID, queryStr, eventsJSON)
	if err != nil {
		log.Printf("handleAgentSearch: failed to insert hermes session: %v", err)
		// non-fatal, continue returning response
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"session_id":   sessionID.String(),
		"events":       pyResp.Events,
		"count":        len(pyResp.Result.Results),
		"jobs":         pyResp.Result.Results,
		"top_research": nil,
	})
}



func (s *Server) handleSaveJob(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var req struct {
		DedupeKey string                 `json:"dedupe_key"`
		Job       map[string]interface{} `json:"job"`
		Status    string                 `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.DedupeKey == "" {
		s.respondError(w, http.StatusBadRequest, "dedupe_key is required")
		return
	}
	jobJSON := models.JSONMap(req.Job)
	status := req.Status
	if status == "" {
		status = "saved"
	}
	query := `INSERT INTO saved_jobs (user_id, dedupe_key, job, status, saved_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (user_id, dedupe_key) DO UPDATE SET job = EXCLUDED.job, status = EXCLUDED.status, updated_at = NOW() RETURNING id`
	var id int
	err := s.DB.Conn.QueryRowContext(r.Context(), query, user.ID, req.DedupeKey, jobJSON, status).Scan(&id)
	if err != nil {
		log.Printf("handleSaveJob: failed to save job: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to save job")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"saved_id": id, "status": "saved"})
}

func (s *Server) handleListSavedJobs(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	statusFilter := r.URL.Query().Get("status")
	var query string
	var args []interface{}
	if statusFilter != "" {
		query = `SELECT id, dedupe_key, job, status, saved_at, updated_at FROM saved_jobs WHERE user_id=$1 AND status=$2 ORDER BY saved_at DESC`
		args = []interface{}{user.ID, statusFilter}
	} else {
		query = `SELECT id, dedupe_key, job, status, saved_at, updated_at FROM saved_jobs WHERE user_id=$1 ORDER BY saved_at DESC`
		args = []interface{}{user.ID}
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), query, args...)
	if err != nil {
		log.Printf("handleListSavedJobs: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch saved jobs")
		return
	}
	defer rows.Close()
	jobs := []map[string]interface{}{}
	for rows.Next() {
		var id int
		var dedupeKey, status string
		var job models.JSONMap
		var savedAt, updatedAt time.Time
		if err := rows.Scan(&id, &dedupeKey, &job, &status, &savedAt, &updatedAt); err != nil {
			continue
		}
		jobs = append(jobs, map[string]interface{}{
			"id": id, "dedupe_key": dedupeKey, "job": job, "status": status,
			"saved_at": savedAt, "updated_at": updatedAt,
		})
	}
	s.respondJSON(w, http.StatusOK, jobs)
}

func (s *Server) handleDeleteSavedJob(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid id")
		return
	}
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	res, err := s.DB.Conn.ExecContext(r.Context(), "DELETE FROM saved_jobs WHERE id=$1 AND user_id=$2", id, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to delete saved job")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Saved job not found")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// -------------------------------------------------------------------
// Autopilot
// -------------------------------------------------------------------

func (s *Server) handleAutopilotStart(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	// Check for concurrent active runs
	var activeCount int
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM autopilot_runs WHERE user_id=$1 AND status IN ('queued', 'running')", user.ID).Scan(&activeCount); err == nil && activeCount > 0 {
		s.respondError(w, http.StatusConflict, "An autopilot run is already active. Please wait for it to complete.")
		return
	}
	var req struct {
		RunConfig     map[string]interface{} `json:"run_config"`
		Profile       map[string]interface{} `json:"profile,omitempty"`
		ResumeText    string                 `json:"resume_text"`
		CandidateName string                 `json:"candidate_name,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ResumeText == "" {
		s.respondError(w, http.StatusBadRequest, "resume_text is required")
		return
	}
	// Call Python AI to start run
	pythonPayload := map[string]interface{}{
		"run_config":      req.RunConfig,
		"profile":         req.Profile,
		"resume_text":     req.ResumeText,
		"candidate_name":  req.CandidateName,
	}
	result, err := s.AI.PostJSON("/api/v1/autopilot/run", pythonPayload)
	if err != nil {
		log.Printf("handleAutopilotStart: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to start autopilot")
		return
	}
	runID, _ := result["run_id"].(string)
	if runID == "" {
		s.respondError(w, http.StatusInternalServerError, "AI returned invalid run_id")
		return
	}
	configJSON := models.JSONMap(req.RunConfig)
	query := `INSERT INTO autopilot_runs (run_id, user_id, config, status, progress, created_at, updated_at) VALUES ($1, $2, $3, 'queued', 0, NOW(), NOW()) RETURNING id`
	var dbID int
	err = s.DB.Conn.QueryRowContext(r.Context(), query, runID, user.ID, configJSON).Scan(&dbID)
	if err != nil {
		log.Printf("handleAutopilotStart: DB insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to record autopilot run")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"run_id": runID, "db_id": dbID, "status": "queued"})
}

func (s *Server) handleListAutopilotRuns(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), "SELECT run_id, config, status, progress, current_step, logs, applications_created, error, created_at, updated_at FROM autopilot_runs WHERE user_id=$1 ORDER BY created_at DESC", user.ID)
	if err != nil {
		log.Printf("handleListAutopilotRuns: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch runs")
		return
	}
	defer rows.Close()
	runs := []map[string]interface{}{}
	for rows.Next() {
		var runID, status, currentStep, errMsg sql.NullString
		var config models.JSONMap
		var logs models.LogEntrySlice
		var progress, appsCreated int
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&runID, &config, &status, &progress, &currentStep, &logs, &appsCreated, &errMsg, &createdAt, &updatedAt); err != nil {
			continue
		}
		runs = append(runs, map[string]interface{}{
			"run_id": runID.String, "config": config, "status": status.String, "progress": progress,
			"current_step": currentStep.String, "logs": logs, "applications_created": appsCreated,
			"error": errMsg.String, "created_at": createdAt, "updated_at": updatedAt,
		})
	}
	s.respondJSON(w, http.StatusOK, runs)
}

func (s *Server) handleGetAutopilotRun(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	runID := chi.URLParam(r, "id")
	var run models.AutopilotRun
	var currentStep, errMsg sql.NullString
	query := `SELECT run_id, config, status, progress, current_step, logs, applications_created, error, created_at, updated_at FROM autopilot_runs WHERE run_id=$1 AND user_id=$2`
	err := s.DB.Conn.QueryRowContext(r.Context(), query, runID, user.ID).Scan(
		&run.RunID, &run.Config, &run.Status, &run.Progress, &currentStep, &run.Logs, &run.ApplicationsCreated, &errMsg, &run.CreatedAt, &run.UpdatedAt,
	)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Run not found")
		return
	}
	run.CurrentStep = currentStep.String
	run.Error = errMsg.String
	// Enrich with Python status
	pythonStatus, err := s.AI.GetJSON(fmt.Sprintf("/api/v1/autopilot/status/%s", runID))
	if err == nil && pythonStatus != nil {
		if st, ok := pythonStatus["status"].(string); ok && st != "" {
			run.Status = st
		}
		if prog, ok := pythonStatus["progress"].(float64); ok {
			run.Progress = int(prog)
		}
		if step, ok := pythonStatus["current_step"].(string); ok {
			run.CurrentStep = step
		}
		if logs, ok := pythonStatus["logs"].([]interface{}); ok {
			l := make(models.LogEntrySlice, 0, len(logs))
			for _, v := range logs {
				if entry, ok := v.(map[string]interface{}); ok {
					l = append(l, entry)
				}
			}
			run.Logs = l
		}
		if apps, ok := pythonStatus["applications_created"].(float64); ok {
			run.ApplicationsCreated = int(apps)
		}
		if e, ok := pythonStatus["error"].(string); ok && e != "" {
			run.Error = e
		}
		// Update DB with latest
		_, _ = s.DB.Conn.ExecContext(r.Context(), `UPDATE autopilot_runs SET status=$1, progress=$2, current_step=$3, logs=$4, applications_created=$5, error=$6, updated_at=NOW() WHERE run_id=$7`,
			run.Status, run.Progress, run.CurrentStep, run.Logs, run.ApplicationsCreated, run.Error, runID)
	}
	// Fetch applications for this run
	apps := []map[string]interface{}{}
	appRows, err := s.DB.Conn.QueryContext(r.Context(), `SELECT id, application_id, job, tailored_resume_text, cover_letter, changes, keywords_added, ats_score_before, ats_score_after, is_dream_company, status, submission_mode, apply_url, created_at, updated_at FROM applications WHERE user_id=$1 AND run_id=$2`, user.ID, runID)
	if err == nil {
		defer appRows.Close()
		for appRows.Next() {
			var a models.Application
			var changes models.JSONMap
			var keywords models.StringSlice
			if err := appRows.Scan(&a.ID, &a.ApplicationID, &a.Job, &a.TailoredResumeText, &a.CoverLetter, &changes, &keywords, &a.ATSScoreBefore, &a.ATSScoreAfter, &a.IsDreamCompany, &a.Status, &a.SubmissionMode, &a.ApplyURL, &a.CreatedAt, &a.UpdatedAt); err != nil {
				continue
			}
			apps = append(apps, map[string]interface{}{
				"id": a.ID, "application_id": a.ApplicationID, "job": a.Job,
				"tailored_resume_text": a.TailoredResumeText, "cover_letter": a.CoverLetter,
				"changes": changes, "keywords_added": keywords,
				"ats_score_before": a.ATSScoreBefore, "ats_score_after": a.ATSScoreAfter,
				"is_dream_company": a.IsDreamCompany, "status": a.Status,
				"submission_mode": a.SubmissionMode, "apply_url": a.ApplyURL,
				"created_at": a.CreatedAt, "updated_at": a.UpdatedAt,
			})
		}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"run_id":               run.RunID,
		"config":               run.Config,
		"status":               run.Status,
		"progress":             run.Progress,
		"current_step":         run.CurrentStep,
		"logs":                 run.Logs,
		"applications_created": run.ApplicationsCreated,
		"error":                run.Error,
		"created_at":           run.CreatedAt,
		"updated_at":           run.UpdatedAt,
		"applications":         apps,
	})
}

// -------------------------------------------------------------------
// Applications (Kanban)
// -------------------------------------------------------------------

func (s *Server) handleCreateApplication(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var req struct {
		Job                map[string]interface{} `json:"job"`
		TailoredResumeText string                 `json:"tailored_resume_text,omitempty"`
		CoverLetter        string                 `json:"cover_letter,omitempty"`
		Changes            map[string]interface{} `json:"changes,omitempty"`
		KeywordsAdded      []string               `json:"keywords_added,omitempty"`
		ATSScoreBefore     int                    `json:"ats_score_before"`
		ATSScoreAfter      int                    `json:"ats_score_after"`
		IsDreamCompany     bool                   `json:"is_dream_company"`
		Status             string                 `json:"status"`
		SubmissionMode     string                 `json:"submission_mode,omitempty"`
		ApplyURL           string                 `json:"apply_url,omitempty"`
		ResumeVariantID    *int                   `json:"resume_variant_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Status == "" {
		req.Status = "saved"
	}
	appID := uuid.New().String()
	query := `INSERT INTO applications (application_id, user_id, job, tailored_resume_text, cover_letter, changes, keywords_added, ats_score_before, ats_score_after, is_dream_company, status, submission_mode, apply_url, resume_variant_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()) RETURNING id`
	var id int
	err := s.DB.Conn.QueryRowContext(r.Context(), query, appID, user.ID, models.JSONMap(req.Job), req.TailoredResumeText, req.CoverLetter, models.JSONMap(req.Changes), models.StringSlice(req.KeywordsAdded), req.ATSScoreBefore, req.ATSScoreAfter, req.IsDreamCompany, req.Status, req.SubmissionMode, req.ApplyURL, req.ResumeVariantID).Scan(&id)
	if err != nil {
		log.Printf("handleCreateApplication: insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create application")
		return
	}

	// Increment pulls if status is applied
	if req.Status == "applied" && req.ResumeVariantID != nil {
		s.incrementBanditPull(r.Context(), *req.ResumeVariantID)
	}

	s.respondJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "application_id": appID, "status": req.Status})
}

func (s *Server) handleListApplications(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	statusFilter := r.URL.Query().Get("status")
	var query string
	var args []interface{}
	if statusFilter != "" {
		query = `SELECT id, application_id, run_id, job, tailored_resume_text, cover_letter, changes, keywords_added, ats_score_before, ats_score_after, is_dream_company, status, submission_mode, apply_url, created_at, updated_at FROM applications WHERE user_id=$1 AND status=$2 ORDER BY created_at DESC`
		args = []interface{}{user.ID, statusFilter}
	} else {
		query = `SELECT id, application_id, run_id, job, tailored_resume_text, cover_letter, changes, keywords_added, ats_score_before, ats_score_after, is_dream_company, status, submission_mode, apply_url, created_at, updated_at FROM applications WHERE user_id=$1 ORDER BY created_at DESC`
		args = []interface{}{user.ID}
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), query, args...)
	if err != nil {
		log.Printf("handleListApplications: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch applications")
		return
	}
	defer rows.Close()
	apps := []map[string]interface{}{}
	for rows.Next() {
		var a models.Application
		var runID sql.NullString
		if err := rows.Scan(&a.ID, &a.ApplicationID, &runID, &a.Job, &a.TailoredResumeText, &a.CoverLetter, &a.Changes, &a.KeywordsAdded, &a.ATSScoreBefore, &a.ATSScoreAfter, &a.IsDreamCompany, &a.Status, &a.SubmissionMode, &a.ApplyURL, &a.CreatedAt, &a.UpdatedAt); err != nil {
			continue
		}
		if runID.Valid {
			a.RunID = runID.String
		}
		apps = append(apps, map[string]interface{}{
			"id": a.ID, "application_id": a.ApplicationID, "run_id": a.RunID, "job": a.Job,
			"tailored_resume_text": a.TailoredResumeText, "cover_letter": a.CoverLetter,
			"changes": a.Changes, "keywords_added": a.KeywordsAdded,
			"ats_score_before": a.ATSScoreBefore, "ats_score_after": a.ATSScoreAfter,
			"is_dream_company": a.IsDreamCompany, "status": a.Status,
			"submission_mode": a.SubmissionMode, "apply_url": a.ApplyURL,
			"created_at": a.CreatedAt, "updated_at": a.UpdatedAt,
		})
	}
	s.respondJSON(w, http.StatusOK, apps)
}

func (s *Server) handleGetApplication(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")
	var a models.Application
	var runID sql.NullString
	query := `SELECT id, application_id, run_id, job, tailored_resume_text, cover_letter, changes, keywords_added, ats_score_before, ats_score_after, is_dream_company, status, submission_mode, apply_url, created_at, updated_at FROM applications WHERE application_id=$1 AND user_id=$2`
	err := s.DB.Conn.QueryRowContext(r.Context(), query, appIDStr, user.ID).Scan(&a.ID, &a.ApplicationID, &runID, &a.Job, &a.TailoredResumeText, &a.CoverLetter, &a.Changes, &a.KeywordsAdded, &a.ATSScoreBefore, &a.ATSScoreAfter, &a.IsDreamCompany, &a.Status, &a.SubmissionMode, &a.ApplyURL, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
	}
	if runID.Valid {
		a.RunID = runID.String
	}
	s.respondJSON(w, http.StatusOK, a)
}

func (s *Server) handleUpdateApplication(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Status == "" {
		s.respondError(w, http.StatusBadRequest, "status is required")
		return
	}

	// 1. Fetch current status and resume_variant_id
	var currentStatus string
	var variantID sql.NullInt64
	checkQuery := `SELECT status, resume_variant_id FROM applications WHERE application_id = $1 AND user_id = $2`
	err := s.DB.Conn.QueryRowContext(r.Context(), checkQuery, appIDStr, user.ID).Scan(&currentStatus, &variantID)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
	}

	// 2. Perform the update
	res, err := s.DB.Conn.ExecContext(r.Context(), "UPDATE applications SET status=$1, updated_at=NOW() WHERE application_id=$2 AND user_id=$3", req.Status, appIDStr, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to update application")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
	}

	// 3. Increment pulls and conversions based on status transitions
	if variantID.Valid && variantID.Int64 > 0 {
		vID := int(variantID.Int64)
		// If transitioning to applied, record a pull
		if currentStatus != "applied" && req.Status == "applied" {
			s.incrementBanditPull(r.Context(), vID)
		}
		// If transitioning to interview/offer for the first time, record a conversion
		isOldConversion := currentStatus == "interview" || currentStatus == "offer"
		isNewConversion := req.Status == "interview" || req.Status == "offer"
		if !isOldConversion && isNewConversion {
			s.incrementBanditConversion(r.Context(), vID)
		}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{"application_id": appIDStr, "status": req.Status})
}

func (s *Server) handleDeleteApplication(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")
	res, err := s.DB.Conn.ExecContext(r.Context(), "DELETE FROM applications WHERE application_id=$1 AND user_id=$2", appIDStr, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to delete application")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func (s *Server) handleDownloadApplicationResume(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	appIDStr := chi.URLParam(r, "id")
	var resumeText string
	query := `SELECT tailored_resume_text FROM applications WHERE application_id=$1 AND user_id=$2`
	err := s.DB.Conn.QueryRowContext(r.Context(), query, appIDStr, user.ID).Scan(&resumeText)
	if err != nil {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
	}
	if resumeText == "" {
		s.respondError(w, http.StatusBadRequest, "No tailored resume available")
		return
	}
	result, err := s.AI.PostJSON("/api/v1/export/docx", map[string]interface{}{"text": resumeText, "title": "Tailored Resume"})
	if err != nil {
		log.Printf("handleDownloadApplicationResume: export failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Failed to export resume")
		return
	}
	data, _ := result["data"].(string)
	if data == "" {
		s.respondError(w, http.StatusInternalServerError, "Export returned empty data")
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"tayari-resume-%s.docx\"", appIDStr))
	// data is base64 encoded from Python
	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to decode export")
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write(decoded)
}

// -------------------------------------------------------------------
// Autopilot Schedules
// -------------------------------------------------------------------

func (s *Server) handleCreateSchedule(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var req struct {
		Frequency string                 `json:"frequency"`
		Config    map[string]interface{} `json:"config,omitempty"`
		Active    bool                   `json:"active"`
		NextRunAt *time.Time             `json:"next_run_at,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Frequency == "" {
		s.respondError(w, http.StatusBadRequest, "frequency is required")
		return
	}
	// Validate frequency: only daily and weekly are allowed
	if req.Frequency != "daily" && req.Frequency != "weekly" {
		s.respondError(w, http.StatusBadRequest, "frequency must be 'daily' or 'weekly'")
		return
	}
	// Check if user has a resume uploaded
	var resumeCount int
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM resumes WHERE user_id=$1", user.ID).Scan(&resumeCount); err != nil || resumeCount == 0 {
		s.respondError(w, http.StatusBadRequest, "No resume uploaded. Please upload a resume first.")
		return
	}
	scheduleID := uuid.New().String()
	// Default active to true if not provided
	active := req.Active
	// Compute next_run_at if not provided
	nextRunAt := req.NextRunAt
	if nextRunAt == nil {
		now := time.Now().UTC()
		if req.Frequency == "daily" {
			t := now.Add(24 * time.Hour)
			nextRunAt = &t
		} else {
			t := now.Add(7 * 24 * time.Hour)
			nextRunAt = &t
		}
	}
	query := `INSERT INTO autopilot_schedules (schedule_id, user_id, frequency, config, active, next_run_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`
	var id int
	err := s.DB.Conn.QueryRowContext(r.Context(), query, scheduleID, user.ID, req.Frequency, models.JSONMap(req.Config), active, nextRunAt).Scan(&id)
	if err != nil {
		log.Printf("handleCreateSchedule: insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create schedule")
		return
	}
	s.respondJSON(w, http.StatusCreated, map[string]interface{}{
		"id": id, "schedule_id": scheduleID, "active": active, "next_run_at": nextRunAt,
	})
}

func (s *Server) handleListSchedules(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), "SELECT schedule_id, frequency, config, active, next_run_at, last_run_at, created_at FROM autopilot_schedules WHERE user_id=$1 ORDER BY created_at DESC", user.ID)
	if err != nil {
		log.Printf("handleListSchedules: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to fetch schedules")
		return
	}
	defer rows.Close()
	schedules := []map[string]interface{}{}
	for rows.Next() {
		var sch models.AutopilotSchedule
		if err := rows.Scan(&sch.ScheduleID, &sch.Frequency, &sch.Config, &sch.Active, &sch.NextRunAt, &sch.LastRunAt, &sch.CreatedAt); err != nil {
			continue
		}
		schedules = append(schedules, map[string]interface{}{
			"schedule_id": sch.ScheduleID, "frequency": sch.Frequency, "config": sch.Config,
			"active": sch.Active, "next_run_at": sch.NextRunAt, "last_run_at": sch.LastRunAt,
			"created_at": sch.CreatedAt,
		})
	}
	s.respondJSON(w, http.StatusOK, schedules)
}

func (s *Server) handleUpdateSchedule(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	scheduleID := chi.URLParam(r, "id")
	var req struct {
		Frequency string                 `json:"frequency"`
		Config    map[string]interface{} `json:"config,omitempty"`
		Active    bool                   `json:"active"`
		NextRunAt *time.Time             `json:"next_run_at,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	res, err := s.DB.Conn.ExecContext(r.Context(), "UPDATE autopilot_schedules SET frequency=$1, config=$2, active=$3, next_run_at=$4, updated_at=NOW() WHERE schedule_id=$5 AND user_id=$6", req.Frequency, models.JSONMap(req.Config), req.Active, req.NextRunAt, scheduleID, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to update schedule")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Schedule not found")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"schedule_id": scheduleID, "status": "updated"})
}

func (s *Server) handleDeleteSchedule(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	scheduleID := chi.URLParam(r, "id")
	res, err := s.DB.Conn.ExecContext(r.Context(), "DELETE FROM autopilot_schedules WHERE schedule_id=$1 AND user_id=$2", scheduleID, user.ID)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to delete schedule")
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		s.respondError(w, http.StatusNotFound, "Schedule not found")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// -------------------------------------------------------------------
// Resume AI Enhancements
// -------------------------------------------------------------------

func (s *Server) handleOptimizeResume(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid resume id")
		return
	}
	var resumeText string
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT original_text FROM resumes WHERE id=$1 AND user_id=$2", id, user.ID).Scan(&resumeText); err != nil {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}
	var req struct {
		JobDescription string `json:"job_description,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// body is optional; ignore error if empty
		req.JobDescription = ""
	}
	result, err := s.AI.PostJSON("/api/v1/optimizer/optimize", map[string]interface{}{
		"resume_text":     resumeText,
		"job_description": req.JobDescription,
	})
	if err != nil {
		log.Printf("handleOptimizeResume: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Optimization failed")
		return
	}

	var optText string
	if opt, ok := result["optimized_text"].(string); ok {
		optText = opt
	}
	if optText != "" {
		_, err = s.DB.Conn.ExecContext(r.Context(), "UPDATE resumes SET optimized_text=$1, status='optimized', updated_at=NOW() WHERE id=$2 AND user_id=$3", optText, id, user.ID)
		if err != nil {
			log.Printf("handleOptimizeResume: failed to update resume status/optimized_text: %v", err)
		}
	}

	resultJSON, _ := json.Marshal(result)
	var versionID int
	err = s.DB.Conn.QueryRowContext(r.Context(), `
		INSERT INTO resume_versions (resume_id, version_type, parsed_json, created_at)
		VALUES ($1, 'optimized', $2, NOW()) RETURNING id`,
		id, string(resultJSON)).Scan(&versionID)
	if err != nil {
		log.Printf("handleOptimizeResume: failed to insert resume_version: %v", err)
		versionID = id
	}

	result["id"] = versionID
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleDeepATS(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid resume id")
		return
	}
	var resumeText string
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT original_text FROM resumes WHERE id=$1 AND user_id=$2", id, user.ID).Scan(&resumeText); err != nil {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}
	var req struct {
		JobDescription string `json:"job_description,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.JobDescription = ""
	}
	result, err := s.AI.PostJSON("/api/v1/ats/deep", map[string]interface{}{
		"resume_text":     resumeText,
		"job_description": req.JobDescription,
	})
	if err != nil {
		log.Printf("handleDeepATS: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Deep ATS analysis failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleExportResume(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid resume id")
		return
	}

	// Try to get optimized text from request body first, fallback to DB original_text
	var resumeText string
	if r.Body != nil && r.ContentLength > 0 {
		var body map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			if opt, ok := body["optimized_text"].(string); ok && opt != "" {
				resumeText = opt
			}
		}
	}
	if resumeText == "" {
		if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT COALESCE(optimized_text, original_text) FROM resumes WHERE id=$1 AND user_id=$2", id, user.ID).Scan(&resumeText); err != nil {
			s.respondError(w, http.StatusNotFound, "Resume not found")
			return
		}
	}
	result, err := s.AI.PostJSON("/api/v1/export/docx", map[string]interface{}{"text": resumeText, "title": "Resume"})
	if err != nil {
		log.Printf("handleExportResume: export failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Export failed")
		return
	}
	data, _ := result["data"].(string)
	if data == "" {
		s.respondError(w, http.StatusInternalServerError, "Export returned empty data")
		return
	}
	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to decode export")
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"tayari-resume-%d.docx\"", id))
	w.WriteHeader(http.StatusOK)
	w.Write(decoded)
}

// -------------------------------------------------------------------
// Archive-compatible handlers
// -------------------------------------------------------------------

func (s *Server) handleUploadResumeMultipart(w http.ResponseWriter, r *http.Request) {
	for name, values := range r.Header {
		for _, value := range values {
			log.Printf("Header: %s = %s", name, value)
		}
	}
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		log.Printf("handleUploadResumeMultipart: ParseMultipartForm failed: %v", err)
		s.respondError(w, http.StatusBadRequest, "Failed to parse multipart form")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("handleUploadResumeMultipart: FormFile failed: %v", err)
		s.respondError(w, http.StatusBadRequest, "Missing file field")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to read file")
		return
	}
	fileType := "txt"
	if header.Filename != "" {
		parts := strings.Split(header.Filename, ".")
		if len(parts) > 1 {
			fileType = strings.ToLower(parts[len(parts)-1])
		}
	}
	resumeText := string(data)
	if fileType == "pdf" || fileType == "docx" {
		parsed, err := s.AI.ParseDocument(data, fileType)
		if err == nil {
			if text, ok := parsed["text"].(string); ok && text != "" {
				resumeText = text
			}
		}
	}
	query := `INSERT INTO resumes (user_id, title, original_text, file_type, status, created_at) VALUES ($1, $2, $3, $4, 'uploaded', NOW()) RETURNING id, created_at`
	var id int
	var createdAt time.Time
	err = s.DB.Conn.QueryRowContext(r.Context(), query, user.ID, header.Filename, resumeText, fileType).Scan(&id, &createdAt)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to create resume")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":         id,
		"resume_id":  id,
		"title":      header.Filename,
		"status":     "uploaded",
		"created_at": createdAt,
	})
}

func (s *Server) handleJobSearchGET(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	location := r.URL.Query().Get("location")
	topNStr := r.URL.Query().Get("top_n")
	topN := 12
	if topNStr != "" {
		if n, err := strconv.Atoi(topNStr); err == nil {
			topN = n
		}
	}
	result, err := s.AI.PostJSON("/api/v1/jobs/search", map[string]interface{}{
		"query":    query,
		"location": location,
		"top_n":    topN,
	})
	if err != nil {
		log.Printf("handleJobSearchGET: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Job search failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleDashboardStats(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var resumesCount, savedJobsCount, applicationsCount, interviewsCount, reviewQueueCount int
	_ = s.DB.Conn.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM resumes WHERE user_id=$1", user.ID).Scan(&resumesCount)
	_ = s.DB.Conn.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM saved_jobs WHERE user_id=$1", user.ID).Scan(&savedJobsCount)
	_ = s.DB.Conn.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM applications WHERE user_id=$1", user.ID).Scan(&applicationsCount)
	_ = s.DB.Conn.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM applications WHERE user_id=$1 AND status='interview'", user.ID).Scan(&interviewsCount)
	_ = s.DB.Conn.QueryRowContext(r.Context(), "SELECT COUNT(*) FROM applications WHERE user_id=$1 AND status='review'", user.ID).Scan(&reviewQueueCount)

	var profileCompletion int
	var headline, summary sql.NullString
	var skills sql.NullString
	err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT headline, summary, skills FROM profiles WHERE id=$1", user.ID).Scan(&headline, &summary, &skills)
	if err == nil {
		fields := 0
		if headline.Valid && headline.String != "" {
			fields++
		}
		if summary.Valid && summary.String != "" {
			fields++
		}
		if skills.Valid && skills.String != "" && skills.String != "{}" {
			fields++
		}
		profileCompletion = fields * 33
		if profileCompletion > 100 {
			profileCompletion = 100
		}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"resumes_count":          resumesCount,
		"saved_jobs_count":       savedJobsCount,
		"applications_count":     applicationsCount,
		"interviews_count":       interviewsCount,
		"review_queue_count":     reviewQueueCount,
		"profile_completion_pct":   profileCompletion,
	})
}


// ---------------------------------------------------------------------------
// NEW: Cover Letter, Communication, Interview Prep, Knowledge Graph, Profile Import
// ---------------------------------------------------------------------------

func (s *Server) handleCoverLetterGenerate(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	resumeID, _ := req["resume_id"].(float64)
	jobID, _ := req["job_id"].(float64)
	tone, _ := req["tone"].(string)
	if tone == "" {
		tone = "formal"
	}
	companyName, _ := req["company_name"].(string)
	jobTitle, _ := req["job_title"].(string)
	jobDescription, _ := req["job_description"].(string)
	resumeText, _ := req["resume_text"].(string)
	personalNotes, _ := req["personal_notes"].(string)

	if resumeText == "" && resumeID > 0 {
		var rt string
		if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT COALESCE(optimized_text, original_text) FROM resumes WHERE id=$1 AND user_id=$2", int(resumeID), user.ID).Scan(&rt); err == nil {
			resumeText = rt
		}
	}
	if jobDescription == "" && jobID > 0 {
		var jdText string
		if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT text FROM job_descriptions WHERE id=$1 AND user_id=$2", int(jobID), user.ID).Scan(&jdText); err == nil {
			jobDescription = jdText
		}
	}
	if resumeText == "" {
		s.respondError(w, http.StatusBadRequest, "Resume text is required")
		return
	}
	if jobDescription == "" {
		s.respondError(w, http.StatusBadRequest, "Job description is required")
		return
	}
	result, err := s.AI.PostJSON("/api/v1/cover-letter/generate", map[string]interface{}{
		"resume_text":    resumeText,
		"job_title":      jobTitle,
		"company":        companyName,
		"job_description": jobDescription,
		"tone":           tone,
		"personal_notes": personalNotes,
	})
	if err != nil {
		log.Printf("handleCoverLetterGenerate: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Cover letter generation failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleCommunicationGenerate(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	commType, _ := req["comm_type"].(string)
	if commType == "" {
		s.respondError(w, http.StatusBadRequest, "comm_type is required")
		return
	}
	applicationID, _ := req["application_id"].(string)
	resumeText, _ := req["resume_text"].(string)
	jobTitle, _ := req["job_title"].(string)
	companyName, _ := req["company_name"].(string)
	recipientName, _ := req["recipient_name"].(string)
	var discussionPoints []string
	if dp, ok := req["discussion_points"].([]interface{}); ok {
		for _, v := range dp {
			if s, ok := v.(string); ok {
				discussionPoints = append(discussionPoints, s)
			}
		}
	}
	var offerDetails map[string]interface{}
	if od, ok := req["offer_details"].(map[string]interface{}); ok {
		offerDetails = od
	}
	daysSince, _ := req["days_since"].(float64)
	if daysSince == 0 {
		daysSince = 3
	}

	if applicationID != "" {
		var appData struct {
			JobTitle    string
			CompanyName string
			JobDesc     string
			ResumeText  string
		}
		if err := s.DB.Conn.QueryRowContext(r.Context(), `
			SELECT COALESCE(a.job->>'title', ''), COALESCE(a.job->>'company', ''), COALESCE(a.job->>'description', ''), COALESCE(r.original_text, '')
			FROM applications a
			LEFT JOIN resumes r ON r.user_id = $1
			WHERE a.application_id = $2 AND a.user_id = $1
			ORDER BY r.created_at DESC LIMIT 1
		`, user.ID, applicationID).Scan(&appData.JobTitle, &appData.CompanyName, &appData.JobDesc, &appData.ResumeText); err == nil {
			if jobTitle == "" { jobTitle = appData.JobTitle }
			if companyName == "" { companyName = appData.CompanyName }
			if resumeText == "" { resumeText = appData.ResumeText }
		}
	}

	result, err := s.AI.PostJSON("/api/v1/communication/generate", map[string]interface{}{
		"comm_type":        commType,
		"resume_text":      resumeText,
		"job_title":        jobTitle,
		"company_name":     companyName,
		"recipient_name":   recipientName,
		"discussion_points": discussionPoints,
		"offer_details":    offerDetails,
		"days_since":       int(daysSince),
	})
	if err != nil {
		log.Printf("handleCommunicationGenerate: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Communication generation failed")
		return
	}

	// Audit #6: persist the generated message so we can track per-touchpoint
	// response rate. Best-effort — a DB miss doesn't break generation.
	body, _ := result["body"].(string)
	subject, _ := result["subject"].(string)
	var commID int64
	if body != "" && s.DB != nil && s.DB.Conn != nil {
		if err := s.DB.Conn.QueryRowContext(r.Context(), `
			INSERT INTO communications (user_id, application_id, comm_type, job_title, company_name, subject, body)
			VALUES ($1, NULLIF($2, ''), $3, $4, $5, $6, $7)
			RETURNING id
		`, user.ID, applicationID, commType, jobTitle, companyName, subject, body).Scan(&commID); err != nil {
			log.Printf("handleCommunicationGenerate: persist comm failed: %v", err)
		} else {
			result["comm_id"] = commID
		}
	}

	s.respondJSON(w, http.StatusOK, result)
}

// handleCommunicationResponse marks a persisted communication as responded
// (or no_response). Audit #6 — the response-rate denominator's numerator.
func (s *Server) handleCommunicationResponse(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	commID := chi.URLParam(r, "commId")
	if commID == "" {
		s.respondError(w, http.StatusBadRequest, "commId is required")
		return
	}
	var req struct {
		ResponseStatus string `json:"response_status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	// ponytail: whitelist status — never trust arbitrary client strings into a
	// status column. no_response clears responded_at; responded stamps it.
	switch req.ResponseStatus {
	case "responded", "no_response", "sent":
	default:
		s.respondError(w, http.StatusBadRequest, "invalid response_status")
		return
	}
	var respondedAt interface{}
	if req.ResponseStatus == "responded" {
		respondedAt = time.Now()
	}
	_, err := s.DB.Conn.ExecContext(r.Context(), `
		UPDATE communications SET response_status = $1, responded_at = $2
		WHERE id = $3 AND user_id = $4
	`, req.ResponseStatus, respondedAt, commID, user.ID)
	if err != nil {
		log.Printf("handleCommunicationResponse: update failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to update communication")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"ok": true, "response_status": req.ResponseStatus})
}

// handleCommunicationStats returns per-type response-rate aggregates for the
// signed-in user. Drives the CommunicationHub response-rate card (audit #6).
func (s *Server) handleCommunicationStats(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `
		SELECT comm_type,
		       COUNT(*) AS total,
		       COUNT(*) FILTER (WHERE response_status = 'responded') AS responded,
		       COUNT(*) FILTER (WHERE response_status = 'no_response') AS no_response
		FROM communications
		WHERE user_id = $1
		GROUP BY comm_type
	`, user.ID)
	if err != nil {
		log.Printf("handleCommunicationStats: query failed: %v", err)
		s.respondJSON(w, http.StatusOK, map[string]interface{}{"stats": []interface{}{}})
		return
	}
	defer rows.Close()
	type typeStat struct {
		CommType    string `json:"comm_type"`
		Total       int    `json:"total"`
		Responded   int    `json:"responded"`
		NoResponse  int    `json:"no_response"`
		ResponseRate int   `json:"response_rate"`
	}
	var stats []typeStat
	for rows.Next() {
		var ts typeStat
		if err := rows.Scan(&ts.CommType, &ts.Total, &ts.Responded, &ts.NoResponse); err != nil {
			continue
		}
		if ts.Total > 0 {
			ts.ResponseRate = int(float64(ts.Responded) / float64(ts.Total) * 100)
		}
		stats = append(stats, ts)
	}
	if stats == nil {
		stats = []typeStat{}
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"stats": stats})
}

func (s *Server) handleCommunicationSuggestions(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(), `
		SELECT a.application_id, a.status, a.created_at, a.updated_at,
			COALESCE(a.job->>'title', 'Unknown') as job_title,
			COALESCE(a.job->>'company', 'Unknown') as company_name
		FROM applications a
		WHERE a.user_id = $1 AND a.status NOT IN ('rejected', 'offer')
		ORDER BY a.updated_at DESC
	`, user.ID)
	if err != nil {
		log.Printf("handleCommunicationSuggestions: query failed: %v", err)
		s.respondJSON(w, http.StatusOK, map[string]interface{}{"suggestions": []interface{}{}})
		return
	}
	defer rows.Close()

	var suggestions []map[string]interface{}
	now := time.Now()
	for rows.Next() {
		var appID, status string
		var createdAt, updatedAt time.Time
		var jobTitle, companyName string
		if err := rows.Scan(&appID, &status, &createdAt, &updatedAt, &jobTitle, &companyName); err != nil {
			continue
		}
		var suggestionType, timing string
		daysSince := int(now.Sub(updatedAt).Hours() / 24)
		switch status {
		case "saved":
			if daysSince >= 1 {
				suggestionType = "apply-reminder"
				timing = "You haven't applied yet. Consider applying today."
			}
		case "applied":
			if daysSince >= 3 {
				suggestionType = "follow-up"
				timing = fmt.Sprintf("Applied %d days ago. Follow up now.", daysSince)
			}
		case "phone_screen":
			if daysSince >= 1 {
				suggestionType = "thank-you"
				timing = "Send a thank-you email within 24 hours."
			}
		case "interview":
			if daysSince >= 1 {
				suggestionType = "thank-you"
				timing = "Send a thank-you email within 24 hours."
			} else if daysSince >= 7 {
				suggestionType = "status-check"
				timing = fmt.Sprintf("No update in %d days. Send a status check.", daysSince)
			}
		case "offer":
			if daysSince >= 1 {
				suggestionType = "negotiation"
				timing = "Received an offer. Consider negotiating before accepting."
			}
		}
		if suggestionType != "" {
			suggestions = append(suggestions, map[string]interface{}{
				"application_id": appID,
				"job_title":      jobTitle,
				"company_name":   companyName,
				"status":         status,
				"days_since":     daysSince,
				"suggestion_type": suggestionType,
				"timing_note":    timing,
			})
		}
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"suggestions": suggestions})
}

func (s *Server) handleInterviewPrep(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	interviewType, _ := req["interview_type"].(string)
	if interviewType == "" {
		interviewType = "behavioral"
	}
	applicationID, _ := req["application_id"].(string)
	resumeText, _ := req["resume_text"].(string)
	jobTitle, _ := req["job_title"].(string)
	companyName, _ := req["company_name"].(string)
	jobDescription, _ := req["job_description"].(string)

	if applicationID != "" {
		var appData struct {
			JobTitle       string
			CompanyName    string
			JobDescription string
			ResumeText     string
		}
		if err := s.DB.Conn.QueryRowContext(r.Context(), `
			SELECT COALESCE(a.job->>'title', ''), COALESCE(a.job->>'company', ''), COALESCE(a.job->>'description', ''), COALESCE(r.original_text, '')
			FROM applications a
			LEFT JOIN resumes r ON r.user_id = $1
			WHERE a.application_id = $2 AND a.user_id = $1
			ORDER BY r.created_at DESC LIMIT 1
		`, user.ID, applicationID).Scan(&appData.JobTitle, &appData.CompanyName, &appData.JobDescription, &appData.ResumeText); err == nil {
			if jobTitle == "" { jobTitle = appData.JobTitle }
			if companyName == "" { companyName = appData.CompanyName }
			if jobDescription == "" { jobDescription = appData.JobDescription }
			if resumeText == "" { resumeText = appData.ResumeText }
		}
	}
	if resumeText == "" {
		var rt string
		if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT COALESCE(optimized_text, original_text) FROM resumes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1", user.ID).Scan(&rt); err == nil {
			resumeText = rt
		}
	}
	if resumeText == "" {
		s.respondError(w, http.StatusBadRequest, "Resume text is required")
		return
	}

	result, err := s.AI.PostJSON("/api/v1/interview/prep", map[string]interface{}{
		"resume_text":      resumeText,
		"job_title":        jobTitle,
		"company_name":     companyName,
		"job_description":  jobDescription,
		"interview_type":   interviewType,
	})
	if err != nil {
		log.Printf("handleInterviewPrep: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Interview prep generation failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleResumeKnowledgeGraph(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid resume id")
		return
	}
	var resumeText string
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT COALESCE(optimized_text, original_text) FROM resumes WHERE id=$1 AND user_id=$2", id, user.ID).Scan(&resumeText); err != nil {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}
	result, err := s.AI.PostJSON("/api/v1/resume/knowledge-graph", map[string]interface{}{"resume_text": resumeText})
	if err != nil {
		log.Printf("handleResumeKnowledgeGraph: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Knowledge graph extraction failed")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleImportProfilePDF(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		s.respondError(w, http.StatusBadRequest, "Failed to parse multipart form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Missing file field")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to read file")
		return
	}
	result, err := s.AI.PostJSON("/api/v1/profile/import-text", map[string]interface{}{"resume_text": string(data)})
	if err != nil {
		log.Printf("handleImportProfilePDF: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Profile import failed")
		return
	}
	// Optionally update profile if fields extracted
	if headline, ok := result["headline"].(string); ok && headline != "" {
		s.DB.Conn.ExecContext(r.Context(), "UPDATE profiles SET headline=$1, updated_at=NOW() WHERE user_id=$2", headline, user.ID)
	}
	if skills, ok := result["skills"].([]interface{}); ok && len(skills) > 0 {
		var skillStrings []string
		for _, s := range skills {
			if str, ok := s.(string); ok {
				skillStrings = append(skillStrings, str)
			}
		}
		if len(skillStrings) > 0 {
			jsonSkills, _ := json.Marshal(skillStrings)
			s.DB.Conn.ExecContext(r.Context(), "UPDATE profiles SET skills=$1, updated_at=NOW() WHERE user_id=$2", string(jsonSkills), user.ID)
		}
	}
	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleDownloadResumeDocx(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid resume id")
		return
	}
	var resumeText string
	if err := s.DB.Conn.QueryRowContext(r.Context(), "SELECT COALESCE(original_text, '') FROM resumes WHERE id=$1 AND user_id=$2", id, user.ID).Scan(&resumeText); err != nil {
		s.respondError(w, http.StatusNotFound, "Resume not found")
		return
	}

	result, err := s.AI.PostJSON("/api/v1/export/docx", map[string]interface{}{"text": resumeText, "title": "Resume"})
	if err != nil {
		log.Printf("handleDownloadResumeDocx: export failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Export failed")
		return
	}
	data, _ := result["data"].(string)
	if data == "" {
		s.respondError(w, http.StatusInternalServerError, "Export returned empty data")
		return
	}
	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to decode export")
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"tayari-resume-%d.docx\"", id))
	w.WriteHeader(http.StatusOK)
	w.Write(decoded)
}

func (s *Server) handleDownloadVersionDocx(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid version id")
		return
	}
	var parsedJSON string
	query := `SELECT rv.parsed_json FROM resume_versions rv 
	          JOIN resumes r ON rv.resume_id = r.id 
	          WHERE rv.id = $1 AND r.user_id = $2`
	if err := s.DB.Conn.QueryRowContext(r.Context(), query, id, user.ID).Scan(&parsedJSON); err != nil {
		s.respondError(w, http.StatusNotFound, "Version not found")
		return
	}

	var parsedMap map[string]interface{}
	_ = json.Unmarshal([]byte(parsedJSON), &parsedMap)
	optText, _ := parsedMap["optimized_text"].(string)
	if optText == "" {
		optText = parsedJSON
	}

	result, err := s.AI.PostJSON("/api/v1/export/docx", map[string]interface{}{"text": optText, "title": "Optimized Resume"})
	if err != nil {
		log.Printf("handleDownloadVersionDocx: export failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "Export failed")
		return
	}
	data, _ := result["data"].(string)
	if data == "" {
		s.respondError(w, http.StatusInternalServerError, "Export returned empty data")
		return
	}
	decoded, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to decode export")
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"tayari-resume-version-%d.docx\"", id))
	w.WriteHeader(http.StatusOK)
	w.Write(decoded)
}

func (s *Server) handleLinkedInAnalyze(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	var req struct {
		ProfileText string `json:"profile_text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ProfileText == "" {
		s.respondError(w, http.StatusBadRequest, "profile_text is required")
		return
	}

	result, err := s.AI.PostJSON("/api/v1/linkedin/analyze", map[string]interface{}{
		"profile_text": req.ProfileText,
	})
	if err != nil {
		log.Printf("handleLinkedInAnalyze: AI call failed: %v", err)
		s.respondError(w, http.StatusBadGateway, "LinkedIn analysis failed")
		return
	}

	s.respondJSON(w, http.StatusOK, result)
}

func (s *Server) handleOptimizeResumeStream(w http.ResponseWriter, r *http.Request) {
	// Parse multipart/form-data or standard form values
	if err := r.ParseMultipartForm(10 * 1024 * 1024); err != nil {
		_ = r.ParseForm()
	}

	resumeText := r.FormValue("resume_text")
	jobDescription := r.FormValue("job_description")
	targetRole := r.FormValue("target_role")

	if resumeText == "" {
		s.respondError(w, http.StatusBadRequest, "resume_text is required")
		return
	}

	bodyBuf := &bytes.Buffer{}
	bodyWriter := multipart.NewWriter(bodyBuf)
	_ = bodyWriter.WriteField("resume_text", resumeText)
	if jobDescription != "" {
		_ = bodyWriter.WriteField("job_description", jobDescription)
	}
	if targetRole != "" {
		_ = bodyWriter.WriteField("target_role", targetRole)
	}
	bodyWriter.Close()

	pythonURL := s.Config.PythonAIURL + "/api/v1/optimize/stream"
	httpReq, err := http.NewRequest(http.MethodPost, pythonURL, bodyBuf)
	if err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to create request")
		return
	}
	httpReq.Header.Set("Content-Type", bodyWriter.FormDataContentType())

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		s.respondError(w, http.StatusBadGateway, "Python AI service unreachable")
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	buf := make([]byte, 1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			_, _ = w.Write(buf[:n])
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
		if err != nil {
			break
		}
	}
}


