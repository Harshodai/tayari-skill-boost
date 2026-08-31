package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"tayari-backend/internal/models"
)

// routesSocial wires the social graph endpoints (Phase 4.2).
// Connections, shared interview questions, outcome reporting.
func (s *Server) routesSocial(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		// Connections
		r.Post("/api/v1/connections", s.handleSendConnectionRequest)
		r.Post("/api/connections", s.handleSendConnectionRequest)
		r.Post("/api/v1/connections/{id}/accept", s.handleAcceptConnection)
		r.Post("/api/connections/{id}/accept", s.handleAcceptConnection)
		r.Delete("/api/v1/connections/{id}", s.handleDeleteConnection)
		r.Delete("/api/connections/{id}", s.handleDeleteConnection)
		r.Get("/api/v1/connections", s.handleListConnections)
		r.Get("/api/connections", s.handleListConnections)
		r.Get("/api/v1/connections/pending", s.handleListPendingConnections)
		r.Get("/api/connections/pending", s.handleListPendingConnections)

		// Shared interview questions
		r.Post("/api/v1/interview-questions", s.handleCreateInterviewQuestion)
		r.Post("/api/interview-questions", s.handleCreateInterviewQuestion)
		r.Get("/api/v1/feed/interview-questions", s.handleFeedInterviewQuestions)
		r.Get("/api/feed/interview-questions", s.handleFeedInterviewQuestions)
		r.Post("/api/v1/interview-questions/{id}/upvote", s.handleUpvoteInterviewQuestion)
		r.Post("/api/interview-questions/{id}/upvote", s.handleUpvoteInterviewQuestion)
		r.Post("/api/v1/interview-questions/{id}/report", s.handleReportInterviewQuestion)
		r.Post("/api/interview-questions/{id}/report", s.handleReportInterviewQuestion)

		// Application outcomes (M2 funnel)
		r.Post("/api/v1/applications/{id}/outcome", s.handleUpsertOutcome)
		r.Post("/api/applications/{id}/outcome", s.handleUpsertOutcome)
		r.Get("/api/v1/applications/{id}/outcome", s.handleGetOutcome)
		r.Get("/api/applications/{id}/outcome", s.handleGetOutcome)
	})
}

// allowedQuestionCategories / allowedQuestionVisibility mirror the CHECK
// constraints on public.shared_interview_questions (see
// supabase/migrations/20260731_social_graph.sql) — client-supplied values
// outside these sets must be rejected before they reach the DB insert.
var allowedQuestionCategories = map[string]bool{
	"behavioral": true, "technical": true, "system_design": true,
	"culture": true, "hr": true, "other": true,
}

var allowedQuestionVisibility = map[string]bool{
	"private": true, "connections": true, "public": true,
}

// authUser reads the authenticated user from the request context, writing a
// 401 response and returning ok=false when it's missing.
func (s *Server) authUser(w http.ResponseWriter, r *http.Request) (*models.User, bool) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return nil, false
	}
	return user, true
}

// pgErrorCode extracts the Postgres SQLSTATE from err, or "" if err isn't a
// *pgconn.PgError (e.g. a context timeout or driver-level error).
func pgErrorCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

// ---- Connection handlers --------------------------------------------------

func (s *Server) handleSendConnectionRequest(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	var req struct {
		AddresseeID string `json:"addressee_id"`
	}
	if err := DecodeAndValidate(r, &req); err != nil || req.AddresseeID == "" {
		s.respondError(w, http.StatusBadRequest, "addressee_id is required")
		return
	}
	addresseeID, err := uuid.Parse(req.AddresseeID)
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid addressee_id")
		return
	}
	if addresseeID == user.ID {
		s.respondError(w, http.StatusBadRequest, "Cannot connect with yourself")
		return
	}

	// Block semantics are direction-agnostic: the UNIQUE(requester_id,
	// addressee_id) constraint only catches a duplicate of the exact same
	// ordered pair, so a blocked row created in one direction would not
	// stop a fresh request from the other direction without this check.
	var existingStatus string
	checkErr := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT status FROM connections
		 WHERE (requester_id=$1 AND addressee_id=$2) OR (requester_id=$2 AND addressee_id=$1)
		 LIMIT 1`,
		user.ID, addresseeID,
	).Scan(&existingStatus)
	if checkErr == nil {
		if existingStatus == "blocked" {
			s.respondError(w, http.StatusForbidden, "Cannot connect with this user")
			return
		}
		s.respondError(w, http.StatusConflict, "Connection already exists")
		return
	} else if !errors.Is(checkErr, sql.ErrNoRows) {
		log.Printf("handleSendConnectionRequest: existence check failed: %v", checkErr)
		s.respondError(w, http.StatusInternalServerError, "Failed to send connection request")
		return
	}

	var id string
	err = s.DB.Conn.QueryRowContext(r.Context(),
		`INSERT INTO connections (requester_id, addressee_id) VALUES ($1,$2) RETURNING id`,
		user.ID, addresseeID,
	).Scan(&id)
	if err != nil {
		switch pgErrorCode(err) {
		case "23505": // unique_violation — the pair already exists (race with the check above)
			s.respondError(w, http.StatusConflict, "Connection already exists")
		case "23503": // foreign_key_violation — addressee doesn't exist
			s.respondError(w, http.StatusBadRequest, "Invalid user")
		default:
			log.Printf("handleSendConnectionRequest: %v", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to send connection request")
		}
		return
	}
	s.respondJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "pending"})
}

func (s *Server) handleAcceptConnection(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := s.DB.Conn.ExecContext(r.Context(),
		`UPDATE connections SET status='accepted', updated_at=NOW()
		 WHERE id=$1 AND addressee_id=$2 AND status='pending'`,
		id, user.ID,
	)
	if err != nil {
		log.Printf("handleAcceptConnection: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to accept connection")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		s.respondError(w, http.StatusNotFound, "Connection not found or already processed")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]string{"id": id.String(), "status": "accepted"})
}

func (s *Server) handleDeleteConnection(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := s.DB.Conn.ExecContext(r.Context(),
		`DELETE FROM connections WHERE id=$1 AND (requester_id=$2 OR addressee_id=$2)`,
		id, user.ID,
	)
	if err != nil {
		log.Printf("handleDeleteConnection: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to remove connection")
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		s.respondError(w, http.StatusNotFound, "Connection not found")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

func (s *Server) handleListConnections(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT id, requester_id, addressee_id, status, created_at FROM connections
		 WHERE (requester_id=$1 OR addressee_id=$1) AND status='accepted'
		 ORDER BY created_at DESC`, user.ID,
	)
	if err != nil {
		log.Printf("handleListConnections: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to list connections")
		return
	}
	defer rows.Close()
	list := []map[string]interface{}{}
	for rows.Next() {
		var id, reqID, addr, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &reqID, &addr, &status, &createdAt); err != nil {
			log.Printf("handleListConnections: scan failed: %v", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to scan connection")
			return
		}
		list = append(list, map[string]interface{}{
			"id": id, "requester_id": reqID, "addressee_id": addr,
			"status": status, "created_at": createdAt.Format(time.RFC3339),
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleListConnections: rows iteration failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to list connections")
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *Server) handleListPendingConnections(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT id, requester_id, status, created_at FROM connections
		 WHERE addressee_id=$1 AND status='pending'
		 ORDER BY created_at DESC`, user.ID,
	)
	if err != nil {
		log.Printf("handleListPendingConnections: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to list pending connections")
		return
	}
	defer rows.Close()
	list := []map[string]interface{}{}
	for rows.Next() {
		var id, reqID, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &reqID, &status, &createdAt); err != nil {
			log.Printf("handleListPendingConnections: scan failed: %v", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to scan pending connection")
			return
		}
		list = append(list, map[string]interface{}{
			"id": id, "requester_id": reqID, "status": status,
			"created_at": createdAt.Format(time.RFC3339),
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleListPendingConnections: rows iteration failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to list pending connections")
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

// ---- Shared Interview Questions ------------------------------------------

func (s *Server) handleCreateInterviewQuestion(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	var req struct {
		Company      string `json:"company"`
		Role         string `json:"role"`
		QuestionText string `json:"question_text"`
		AnswerText   string `json:"answer_text"`
		Category     string `json:"category"`
		Visibility   string `json:"visibility"`
	}
	if err := DecodeAndValidate(r, &req); err != nil || strings.TrimSpace(req.QuestionText) == "" {
		s.respondError(w, http.StatusBadRequest, "question_text is required")
		return
	}
	if req.Visibility == "" {
		req.Visibility = "connections"
	}
	if req.Category == "" {
		req.Category = "behavioral"
	}
	if !allowedQuestionCategories[req.Category] {
		s.respondError(w, http.StatusBadRequest, "invalid category")
		return
	}
	if !allowedQuestionVisibility[req.Visibility] {
		s.respondError(w, http.StatusBadRequest, "invalid visibility")
		return
	}
	moderationStatus, moderationReason := moderateInterviewContent(req.Company, req.Role, req.QuestionText, req.AnswerText)
	if req.Visibility == "private" && moderationStatus == "pending" {
		moderationStatus = "approved"
	}
	var id string
	err := s.DB.Conn.QueryRowContext(r.Context(),
		`INSERT INTO shared_interview_questions
		 (user_id, company, role, question_text, answer_text, category, visibility, moderation_status, moderation_reason)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
		user.ID, strings.TrimSpace(req.Company), strings.TrimSpace(req.Role), strings.TrimSpace(req.QuestionText), strings.TrimSpace(req.AnswerText), req.Category, req.Visibility, moderationStatus, moderationReason,
	).Scan(&id)
	if err != nil {
		log.Printf("handleCreateInterviewQuestion: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create question")
		return
	}
	s.respondJSON(w, http.StatusCreated, map[string]string{"id": id, "moderation_status": moderationStatus, "moderation_reason": moderationReason})
}

func (s *Server) handleFeedInterviewQuestions(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	company := r.URL.Query().Get("company")
	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT q.id, q.user_id, COALESCE(q.company, ''), COALESCE(q.role, ''), q.question_text,
		        COALESCE(q.answer_text, ''), COALESCE(q.category, 'behavioral'), q.visibility,
		        (SELECT COUNT(*) FROM question_upvotes qu WHERE qu.question_id = q.id) AS upvotes,
		        q.created_at
		 FROM shared_interview_questions q
		 WHERE (q.visibility='public'
		     OR q.user_id=$1
		     OR (q.visibility='connections' AND q.user_id IN (
		         SELECT CASE WHEN requester_id=$1 THEN addressee_id ELSE requester_id END
		         FROM connections WHERE (requester_id=$1 OR addressee_id=$1) AND status='accepted'
		     )))
		 AND ($2='' OR q.company ILIKE '%'||$2||'%')
		 ORDER BY upvotes DESC, q.created_at DESC
		 LIMIT 50`,
		user.ID, company,
	)
	if err != nil {
		log.Printf("handleFeedInterviewQuestions: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load feed")
		return
	}
	defer rows.Close()
	list := []map[string]interface{}{}
	for rows.Next() {
		var id, uid, co, role, qt, at, cat, vis string
		var upvotes int
		var createdAt time.Time
		if err := rows.Scan(&id, &uid, &co, &role, &qt, &at, &cat, &vis, &upvotes, &createdAt); err != nil {
			log.Printf("handleFeedInterviewQuestions: scan failed: %v", err)
			s.respondError(w, http.StatusInternalServerError, "Failed to scan interview question")
			return
		}
		list = append(list, map[string]interface{}{
			"id": id, "user_id": uid, "company": co, "role": role,
			"question_text": qt, "answer_text": at, "category": cat,
			"visibility": vis, "upvotes": upvotes,
			"created_at": createdAt.Format(time.RFC3339),
		})
	}
	if err := rows.Err(); err != nil {
		log.Printf("handleFeedInterviewQuestions: rows iteration failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load feed")
		return
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *Server) handleUpvoteInterviewQuestion(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		s.respondError(w, http.StatusBadRequest, "invalid id")
		return
	}

	// Verify the question exists and is visible to this user before recording a vote —
	// otherwise upvote counts would leak the existence of private/connections-only questions.
	var visible bool
	if err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT EXISTS (
			SELECT 1 FROM shared_interview_questions q
			WHERE q.id=$1 AND (
				q.visibility='public'
				OR q.user_id=$2
				OR (q.visibility='connections' AND EXISTS (
					SELECT 1 FROM connections c
					WHERE c.status='accepted'
					  AND ((c.requester_id=$2 AND c.addressee_id=q.user_id) OR (c.addressee_id=$2 AND c.requester_id=q.user_id))
				))
			)
		)`,
		id, user.ID,
	).Scan(&visible); err != nil {
		log.Printf("handleUpvoteInterviewQuestion: visibility check failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to record upvote")
		return
	}
	if !visible {
		s.respondError(w, http.StatusNotFound, "Question not found")
		return
	}

	// One vote per (question, user) — retries are idempotent via ON CONFLICT DO NOTHING.
	res, err := s.DB.Conn.ExecContext(r.Context(),
		`INSERT INTO question_upvotes (question_id, user_id) VALUES ($1, $2)
		 ON CONFLICT (question_id, user_id) DO NOTHING`,
		id, user.ID,
	)
	if err != nil {
		log.Printf("handleUpvoteInterviewQuestion: insert failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to record upvote")
		return
	}
	n, _ := res.RowsAffected()

	var total int
	if err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT COUNT(*) FROM question_upvotes WHERE question_id=$1`, id,
	).Scan(&total); err != nil {
		log.Printf("handleUpvoteInterviewQuestion: count failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to record upvote")
		return
	}

	status := "upvoted"
	if n == 0 {
		status = "already_upvoted"
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"status": status, "upvotes": total})
}

// ---- Application Outcomes (M2 Funnel) ------------------------------------

func (s *Server) handleUpsertOutcome(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	appID := chi.URLParam(r, "id")

	// Ownership check: an application_id belonging to another user must
	// never be upsertable — the ON CONFLICT WHERE clause below is a second
	// line of defense against a check/insert race.
	var owned bool
	if err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT EXISTS (SELECT 1 FROM applications WHERE application_id=$1 AND user_id=$2)`,
		appID, user.ID,
	).Scan(&owned); err != nil {
		log.Printf("handleUpsertOutcome: ownership check failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to save outcome")
		return
	}
	if !owned {
		s.respondError(w, http.StatusNotFound, "Application not found")
		return
	}

	var req struct {
		RecruiterReply     *bool    `json:"recruiter_reply"`
		PhoneScreen        *bool    `json:"phone_screen"`
		TechnicalInterview *bool    `json:"technical_interview"`
		FinalInterview     *bool    `json:"final_interview"`
		OfferReceived      *bool    `json:"offer_received"`
		OfferAccepted      *bool    `json:"offer_accepted"`
		SalaryOffered      *float64 `json:"salary_offered"`
		Notes              *string  `json:"notes"`
	}
	if err := DecodeAndValidate(r, &req); err != nil {
		s.respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	res, err := s.DB.Conn.ExecContext(r.Context(),
		`INSERT INTO application_outcomes
		 (application_id, user_id, recruiter_reply, phone_screen, technical_interview,
		  final_interview, offer_received, offer_accepted, salary_offered, notes, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
		 ON CONFLICT (application_id) DO UPDATE SET
		   recruiter_reply=COALESCE($3, application_outcomes.recruiter_reply),
		   phone_screen=COALESCE($4, application_outcomes.phone_screen),
		   technical_interview=COALESCE($5, application_outcomes.technical_interview),
		   final_interview=COALESCE($6, application_outcomes.final_interview),
		   offer_received=COALESCE($7, application_outcomes.offer_received),
		   offer_accepted=COALESCE($8, application_outcomes.offer_accepted),
		   salary_offered=COALESCE($9, application_outcomes.salary_offered),
		   notes=COALESCE($10, application_outcomes.notes),
		   updated_at=NOW()
		 WHERE application_outcomes.user_id=$2`,
		appID, user.ID,
		req.RecruiterReply, req.PhoneScreen, req.TechnicalInterview,
		req.FinalInterview, req.OfferReceived, req.OfferAccepted,
		req.SalaryOffered, req.Notes,
	)
	if err != nil {
		log.Printf("handleUpsertOutcome: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to save outcome")
		return
	}
	// A conflicting row exists but its WHERE application_outcomes.user_id=$2
	// clause didn't match (ownership changed between the check above and this
	// exec) — the DO UPDATE was skipped, so 0 rows were touched even though
	// err is nil. Don't report success for a write that didn't happen.
	if n, rerr := res.RowsAffected(); rerr == nil && n == 0 {
		s.respondError(w, http.StatusConflict, "Outcome ownership changed, please retry")
		return
	}
	automationEventEnqueued := false
	if _, tenantID, tenantOK := calendarUser(r); tenantOK {
		payload, marshalErr := json.Marshal(map[string]interface{}{"application_id": appID, "outcome": req})
		if marshalErr != nil {
			log.Printf("handleUpsertOutcome: automation event payload marshal failed: %v", marshalErr)
		} else {
			eventID := uuid.NewSHA1(uuid.NameSpaceURL, []byte("tayari:application-outcome:"+user.ID.String()+":"+appID+":"+string(payload)))
			_, eventErr := s.DB.Conn.ExecContext(r.Context(), `INSERT INTO automation_event_inbox (event_id,tenant_id,user_id,event_type,source,occurred_at,payload) VALUES ($1,$2,$3,'application.outcome_recorded','go.outcome_api',NOW(),$4) ON CONFLICT (event_id) DO NOTHING`, eventID, tenantID, user.ID, payload)
			if eventErr != nil {
				log.Printf("handleUpsertOutcome: automation event enqueue failed: %v", eventErr)
			} else {
				automationEventEnqueued = true
			}
		}
	}
	s.respondJSON(w, http.StatusOK, map[string]interface{}{"status": "saved", "application_id": appID, "automation_event_enqueued": automationEventEnqueued})
}

func (s *Server) handleGetOutcome(w http.ResponseWriter, r *http.Request) {
	user, ok := s.authUser(w, r)
	if !ok {
		return
	}
	appID := chi.URLParam(r, "id")
	var result map[string]interface{}
	var rowJSON []byte
	err := s.DB.Conn.QueryRowContext(r.Context(),
		`SELECT row_to_json(o) FROM application_outcomes o WHERE application_id=$1 AND user_id=$2`,
		appID, user.ID,
	).Scan(&rowJSON)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			s.respondError(w, http.StatusNotFound, "Outcome not found")
			return
		}
		log.Printf("handleGetOutcome: query failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to load outcome")
		return
	}
	if err := json.Unmarshal(rowJSON, &result); err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to parse outcome")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}
