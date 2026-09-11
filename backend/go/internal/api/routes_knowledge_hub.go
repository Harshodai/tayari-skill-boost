package api

import (
	"github.com/go-chi/chi/v5"
)

// routesKnowledgeHub registers Knowledge Hub (Omni-Save) routes with both
// archive-compatible and versioned aliases.
//
// ponytail: this file used to also register a legacy DB-backed /saves CRUD
// trio (handleCreateSave/handleListSaves/handleDeleteSave, backed by a
// saved_posts table) at both /api/saves and /api/v1/saves. routes_one_stop.go
// registers GET and DELETE on those same exact paths — proxying to Python's
// real saved_sources store — and is registered AFTER this file in router.go,
// so chi silently let it win: GET/DELETE /saves were dead code here for an
// unknown period (found by TestNoDuplicateRouteRegistrations). POST /saves
// wasn't collided but was already confirmed dead separately — the frontend
// (src/api/dashboard.ts's createSave) deliberately calls /saves/import
// instead, per a comment there describing the exact same split-brain this
// file created. Removed the whole dead trio; routes_one_stop.go's comment
// ("Omnisave is URL-import-first... no legacy saved_posts table
// participates") already documented this as the intended state.
func (s *Server) routesKnowledgeHub(r chi.Router) {
	// Knowledge Hub RAG query — proxies to the Python engine's citation-backed
	// answer endpoint. Was never registered here, so both the frontend
	// (src/api/ai.ts) and the jobtheory MCP server called a dead route.
	r.Post("/api/v1/knowledge-hub/query", s.handleOneStopProxy("/api/v1/knowledge-hub/query"))
	r.Post("/api/knowledge-hub/query", s.handleOneStopProxy("/api/v1/knowledge-hub/query"))
}
