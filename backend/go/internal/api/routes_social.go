package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

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

		// Application outcomes (M2 funnel)
		r.Post("/api/v1/applications/{id}/outcome", s.handleUpsertOutcome)
		r.Post("/api/applications/{id}/outcome", s.handleUpsertOutcome)
		r.Get("/api/v1/applications/{id}/outcome", s.handleGetOutcome)
		r.Get("/api/applications/{id}/outcome", s.handleGetOutcome)
	})
}

// ---- Connection handlers --------------------------------------------------

func (s *Server) handleSendConnectionRequest(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
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
	var id string
	err = s.DB.Conn.QueryRowContext(r.Context(),
		`INSERT INTO connections (requester_id, addressee_id) VALUES ($1,$2) RETURNING id`,
		user.ID, addresseeID,
	).Scan(&id)
	if err != nil {
		log.Printf("handleSendConnectionRequest: %v", err)
		s.respondError(w, http.StatusConflict, "Connection already exists or invalid user")
		return
	}
	s.respondJSON(w, http.StatusCreated, map[string]string{"id": id, "status": "pending"})
}

func (s *Server) handleAcceptConnection(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	res, err := s.DB.Conn.ExecContext(r.Context(),
		`UPDATE connections SET status='accepted', updated_at=NOW()
		 WHERE id=$1 AND addressee_id=$2 AND status='pending'`,
		id, user.ID,
	)
	if err != nil || func() bool { n, _ := res.RowsAffected(); return n == 0 }() {
		s.respondError(w, http.StatusNotFound, "Connection not found or already processed")
		return
	}
	s.respondJSON(w, http.StatusOK, map[string]string{"id": id, "status": "accepted"})
}

func (s *Server) handleDeleteConnection(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	s.DB.Conn.ExecContext(r.Context(),
		`DELETE FROM connections WHERE id=$1 AND (requester_id=$2 OR addressee_id=$2)`,
		id, user.ID,
	)
	s.respondJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

func (s *Server) handleListConnections(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT id, requester_id, addressee_id, status, created_at FROM connections
		 WHERE (requester_id=$1 OR addressee_id=$1) AND status='accepted'
		 ORDER BY created_at DESC`, user.ID,
	)
	if err != nil {
		s.respondJSON(w, http.StatusOK, []interface{}{})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, req, addr, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &req, &addr, &status, &createdAt); err == nil {
			list = append(list, map[string]interface{}{
				"id": id, "requester_id": req, "addressee_id": addr,
				"status": status, "created_at": createdAt.Format(time.RFC3339),
			})
		}
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *Server) handleListPendingConnections(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT id, requester_id, status, created_at FROM connections
		 WHERE addressee_id=$1 AND status='pending'
		 ORDER BY created_at DESC`, user.ID,
	)
	if err != nil {
		s.respondJSON(w, http.StatusOK, []interface{}{})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, req, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &req, &status, &createdAt); err == nil {
			list = append(list, map[string]interface{}{
				"id": id, "requester_id": req, "status": status,
				"created_at": createdAt.Format(time.RFC3339),
			})
		}
	}
	s.respondJSON(w, http.StatusOK, list)
}

// ---- Shared Interview Questions ------------------------------------------

func (s *Server) handleCreateInterviewQuestion(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
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
	if err := DecodeAndValidate(r, &req); err != nil || req.QuestionText == "" {
		s.respondError(w, http.StatusBadRequest, "question_text is required")
		return
	}
	if req.Visibility == "" {
		req.Visibility = "connections"
	}
	if req.Category == "" {
		req.Category = "behavioral"
	}
	var id string
	err := s.DB.Conn.QueryRowContext(r.Context(),
		`INSERT INTO shared_interview_questions
		 (user_id, company, role, question_text, answer_text, category, visibility)
		 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
		user.ID, req.Company, req.Role, req.QuestionText, req.AnswerText, req.Category, req.Visibility,
	).Scan(&id)
	if err != nil {
		log.Printf("handleCreateInterviewQuestion: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Failed to create question")
		return
	}
	s.respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (s *Server) handleFeedInterviewQuestions(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	company := r.URL.Query().Get("company")
	rows, err := s.DB.Conn.QueryContext(r.Context(),
		`SELECT id, user_id, company, role, question_text, answer_text, category, visibility, upvotes, created_at
		 FROM shared_interview_questions
		 WHERE (visibility='public'
		     OR user_id=$1
		     OR (visibility='connections' AND user_id IN (
		         SELECT CASE WHEN requester_id=$1 THEN addressee_id ELSE requester_id END
		         FROM connections WHERE (requester_id=$1 OR addressee_id=$1) AND status='accepted'
		     )))
		 AND ($2='' OR company ILIKE '%'||$2||'%')
		 ORDER BY upvotes DESC, created_at DESC
		 LIMIT 50`,
		user.ID, company,
	)
	if err != nil {
		s.respondJSON(w, http.StatusOK, []interface{}{})
		return
	}
	defer rows.Close()
	var list []map[string]interface{}
	for rows.Next() {
		var id, uid, co, role, qt, at, cat, vis string
		var upvotes int
		var createdAt time.Time
		if err := rows.Scan(&id, &uid, &co, &role, &qt, &at, &cat, &vis, &upvotes, &createdAt); err == nil {
			list = append(list, map[string]interface{}{
				"id": id, "user_id": uid, "company": co, "role": role,
				"question_text": qt, "answer_text": at, "category": cat,
				"visibility": vis, "upvotes": upvotes,
				"created_at": createdAt.Format(time.RFC3339),
			})
		}
	}
	s.respondJSON(w, http.StatusOK, list)
}

func (s *Server) handleUpvoteInterviewQuestion(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	s.DB.Conn.ExecContext(r.Context(),
		`UPDATE shared_interview_questions SET upvotes=upvotes+1 WHERE id=$1`, id)
	s.respondJSON(w, http.StatusOK, map[string]string{"status": "upvoted"})
}

// ---- Application Outcomes (M2 Funnel) ------------------------------------

func (s *Server) handleUpsertOutcome(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	appID := chi.URLParam(r, "id")
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
	DecodeAndValidate(r, &req)

	_, err := s.DB.Conn.ExecContext(r.Context(),
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
		   updated_at=NOW()`,
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
	s.respondJSON(w, http.StatusOK, map[string]string{"status": "saved", "application_id": appID})
}

func (s *Server) handleGetOutcome(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Unauthorized")
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
		s.respondError(w, http.StatusNotFound, "Outcome not found")
		return
	}
	if err := json.Unmarshal(rowJSON, &result); err != nil {
		s.respondError(w, http.StatusInternalServerError, "Failed to parse outcome")
		return
	}
	s.respondJSON(w, http.StatusOK, result)
}
