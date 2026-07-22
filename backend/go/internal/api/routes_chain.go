package api

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	"tayari-backend/internal/models"
)

// -------------------------------------------------------------------
// K5 — observable chain aggregation.
//
// ``GET /api/v1/chain/{userId}`` returns the user's current position in the
// 7-stage Tayari pipeline (resume → optimize → jobs → cover → apply →
// interview → communicate) with per-stage counts + a current_stage pointer +
// next_action label. The Dashboard renders this as a horizontal strip.
//
// Each stage count is a fault-tolerant COUNT query: a missing table/column or
// a transient DB error degrades that stage to 0 rather than failing the whole
// response. The authenticated user's ID (from context) is used for all
// queries — the ``{userId}`` path param is route shape only (prevents IDOR).
// -------------------------------------------------------------------

// chainStage is one pipeline stage (OCP: stage list is data, handler logic is
// generic — add a stage by appending here, no branching change).
type chainStage struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Href  string `json:"href"`
	Count int    `json:"count"`
}

// chainQuery binds a stage to its COUNT SQL. Reached = Count > 0.
type chainQuery struct {
	key, label, href, sql string
}

// chainStagesQueries is the single source of truth for the 7-stage chain.
var chainStagesQueries = []chainQuery{
	{"resume", "Resume", "/resume", `SELECT COUNT(*) FROM resumes WHERE user_id=$1`},
	{"optimize", "Optimize", "/resume/results", `SELECT COUNT(*) FROM resumes WHERE user_id=$1 AND optimized_text IS NOT NULL`},
	{"jobs", "Jobs", "/jobs", `SELECT COUNT(*) FROM saved_jobs WHERE user_id=$1`},
	{"cover", "Cover Letter", "/cover-letter", `SELECT COUNT(*) FROM applications WHERE user_id=$1 AND cover_letter IS NOT NULL`},
	{"apply", "Apply", "/jobs/autopilot", `SELECT COUNT(*) FROM applications WHERE user_id=$1`},
	{"interview", "Interview", "/interview", `SELECT COUNT(*) FROM applications WHERE user_id=$1 AND status LIKE 'interview%'`},
	{"communicate", "Communicate", "/communication", `SELECT COUNT(*) FROM agent_runs WHERE user_id=$1 AND run_type='communication'`},
}

// RegisterChainRoutes wires the chain endpoint under both prefixes (parity).
func (s *Server) RegisterChainRoutes(r chi.Router) {
	r.Get("/api/v1/chain/{userId}", s.handleChain)
	r.Get("/api/chain/{userId}", s.handleChain)
}

// countOrZero runs a COUNT query and returns 0 on any error (SRP: isolates
// fault-tolerance from the handler so one bad stage never breaks the chain).
func (s *Server) countOrZero(ctx context.Context, query string, userID interface{}) int {
	var n int
	if err := s.DB.Conn.QueryRowContext(ctx, query, userID).Scan(&n); err != nil {
		return 0
	}
	if n < 0 {
		return 0
	}
	return n
}

func (s *Server) handleChain(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "User not found in context")
		return
	}

	stages := make([]chainStage, 0, len(chainStagesQueries))
	currentIdx := -1
	for i, q := range chainStagesQueries {
		n := s.countOrZero(r.Context(), q.sql, user.ID)
		stages = append(stages, chainStage{Key: q.key, Label: q.label, Href: q.href, Count: n})
		if n > 0 {
			currentIdx = i
		}
	}

	current := ""
	next := ""
	if currentIdx >= 0 {
		current = stages[currentIdx].Key
		if currentIdx+1 < len(stages) {
			next = stages[currentIdx+1].Key
		}
	}

	s.respondJSON(w, http.StatusOK, map[string]interface{}{
		"stages":        stages,
		"current_stage": current,
		"next_action":   next,
		"stage_count":   len(stages),
	})
}
