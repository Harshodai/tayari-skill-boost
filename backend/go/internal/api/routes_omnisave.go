package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const (
	omniSaveMaxBodyBytes   = 8 << 20
	omniSaveUpstreamPrefix = "/api/v1"
)

func (s *Server) routesOmniSave(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)
		for _, prefix := range []string{"/api/v1", "/api"} {
			r.Get(prefix+"/saves/export", s.handleOmniSaveProxyGET(omniSaveUpstreamPrefix+"/saves/export"))
			r.Get(prefix+"/saves/activity", s.handleOmniSaveProxyGET(omniSaveUpstreamPrefix+"/saves/activity"))
			r.Get(prefix+"/brief", s.handleOmniSaveProxyGET(omniSaveUpstreamPrefix+"/brief"))
			r.Get(prefix+"/agent/omnisave/library", s.handleOmniSaveProxyGET(omniSaveUpstreamPrefix+"/agent/omnisave/library"))
			r.Get(prefix+"/agent/omnisave/brief", s.handleOmniSaveProxyGET(omniSaveUpstreamPrefix+"/agent/omnisave/brief"))
			r.Post(prefix+"/saves/import/seed", s.handleOmniSaveProxyPost(omniSaveUpstreamPrefix+"/saves/import/seed"))
			r.Get(prefix+"/saves/import/jobs", s.handleOmniSaveProxyGET(omniSaveUpstreamPrefix+"/saves/import/jobs"))
			r.Get(prefix+"/saves/import/jobs/{job_id}", s.handleOmniSaveProxyGETPath(omniSaveUpstreamPrefix+"/saves/import/jobs/", "job_id", ""))
			r.Post(prefix+"/saves/import/jobs/{job_id}/hydrate", s.handleOmniSaveProxyPostPath(omniSaveUpstreamPrefix+"/saves/import/jobs/", "job_id", "/hydrate"))
			r.Post(prefix+"/saves/sync", s.handleOmniSaveProxyPostOK(omniSaveUpstreamPrefix+"/saves/sync"))
			r.Get(prefix+"/saves/sync/settings", s.handleOmniSaveProxyGET(omniSaveUpstreamPrefix+"/saves/sync/settings"))
			r.Put(prefix+"/saves/sync/settings", s.handleOmniSaveProxyBody(omniSaveUpstreamPrefix+"/saves/sync/settings"))
			r.Get(prefix+"/saves/sync/runs", s.handleOmniSaveProxyGET(omniSaveUpstreamPrefix+"/saves/sync/runs"))
			r.Get(prefix+"/context/graph", s.handleOmniSaveProxyGET(omniSaveUpstreamPrefix+"/context/graph"))
			r.Get(prefix+"/saves/{source_id}/highlights", s.handleOmniSaveProxyGETPath(omniSaveUpstreamPrefix+"/saves/", "source_id", "/highlights"))
			r.Post(prefix+"/saves/{source_id}/highlights", s.handleOmniSaveProxyBodyPath(omniSaveUpstreamPrefix+"/saves/", "source_id", "/highlights"))
			r.Delete(prefix+"/saves/{source_id}/highlights/{highlight_id}", s.handleOmniSaveProxyDELETEPath(omniSaveUpstreamPrefix+"/saves/", "source_id", "/highlights/", "highlight_id"))
			r.Get(prefix+"/saves/{source_id}/context", s.handleOmniSaveProxyGETPath(omniSaveUpstreamPrefix+"/saves/", "source_id", "/context"))
			r.Post(prefix+"/saves/{source_id}/context", s.handleOmniSaveProxyBodyPath(omniSaveUpstreamPrefix+"/saves/", "source_id", "/context"))
		}
	})
}

// omniSavePathID validates a chi path parameter as a UUID and writes a 400
// response (with the given label) when it is missing or malformed, so
// non-UUID values are never concatenated into the upstream URL.
func omniSavePathID(w http.ResponseWriter, value, label string) (string, bool) {
	if value == "" {
		http.Error(w, "missing "+label, http.StatusBadRequest)
		return "", false
	}
	if _, err := uuid.Parse(value); err != nil {
		http.Error(w, "invalid "+label, http.StatusBadRequest)
		return "", false
	}
	return value, true
}

func readOmniSaveBody(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, omniSaveMaxBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		if _, tooLarge := err.(*http.MaxBytesError); tooLarge {
			http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, "invalid request body", http.StatusBadRequest)
		}
		return nil, false
	}
	defer r.Body.Close()
	return body, true
}

func (s *Server) handleOmniSaveProxyGET(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		target := endpoint
		if r.URL.RawQuery != "" {
			target += "?" + r.URL.RawQuery
		}
		result, err := s.AI.GetJSONWithHeaders(target, s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[OmniSaveProxy] GET %s failed: %v", target, err)
			writeOmniSaveProxyError(w)
			return
		}
		writeOmniSaveProxyJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleOmniSaveProxyPost(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, ok := readOmniSaveBody(w, r)
		if !ok {
			return
		}
		result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[OmniSaveProxy] POST %s failed: %v", endpoint, err)
			writeOmniSaveProxyError(w)
			return
		}
		writeOmniSaveProxyJSON(w, http.StatusCreated, result)
	}
}

func (s *Server) handleOmniSaveProxyPostOK(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, ok := readOmniSaveBody(w, r)
		if !ok {
			return
		}
		result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[OmniSaveProxy] POST %s failed: %v", endpoint, err)
			writeOmniSaveProxyError(w)
			return
		}
		writeOmniSaveProxyJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleOmniSaveProxyBody(endpoint string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, ok := readOmniSaveBody(w, r)
		if !ok {
			return
		}
		result, err := s.AI.PutJSONWithHeaders(endpoint, json.RawMessage(body), s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[OmniSaveProxy] PUT %s failed: %v", endpoint, err)
			writeOmniSaveProxyError(w)
			return
		}
		writeOmniSaveProxyJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleOmniSaveProxyGETPath(prefix, parameter, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		value, ok := omniSavePathID(w, chi.URLParam(r, parameter), "resource identifier")
		if !ok {
			return
		}
		endpoint := prefix + value + suffix
		if r.URL.RawQuery != "" {
			endpoint += "?" + r.URL.RawQuery
		}
		result, err := s.AI.GetJSONWithHeaders(endpoint, s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[OmniSaveProxy] GET %s failed: %v", endpoint, err)
			writeOmniSaveProxyError(w)
			return
		}
		writeOmniSaveProxyJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleOmniSaveProxyPostPath(prefix, parameter, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		value, ok := omniSavePathID(w, chi.URLParam(r, parameter), "seed job identifier")
		if !ok {
			return
		}
		endpoint := prefix + value + suffix
		result, err := s.AI.PostJSONWithHeaders(endpoint, nil, s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[OmniSaveProxy] POST %s failed: %v", endpoint, err)
			writeOmniSaveProxyError(w)
			return
		}
		writeOmniSaveProxyJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleOmniSaveProxyBodyPath(prefix, parameter, suffix string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		value, ok := omniSavePathID(w, chi.URLParam(r, parameter), "resource identifier")
		if !ok {
			return
		}
		body, ok := readOmniSaveBody(w, r)
		if !ok {
			return
		}
		endpoint := prefix + value + suffix
		result, err := s.AI.PostJSONWithHeaders(endpoint, json.RawMessage(body), s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[OmniSaveProxy] POST %s failed: %v", endpoint, err)
			writeOmniSaveProxyError(w)
			return
		}
		writeOmniSaveProxyJSON(w, http.StatusOK, result)
	}
}

func (s *Server) handleOmniSaveProxyDELETEPath(prefix, parameter, middle, childParameter string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		parentID, ok := omniSavePathID(w, chi.URLParam(r, parameter), "resource identifier")
		if !ok {
			return
		}
		childID, ok := omniSavePathID(w, chi.URLParam(r, childParameter), "child resource identifier")
		if !ok {
			return
		}
		endpoint := prefix + parentID + middle + childID
		result, err := s.AI.DeleteJSONWithHeaders(endpoint, s.getXUserHeaders(r))
		if err != nil {
			log.Printf("[OmniSaveProxy] DELETE %s failed: %v", endpoint, err)
			writeOmniSaveProxyError(w)
			return
		}
		writeOmniSaveProxyJSON(w, http.StatusOK, result)
	}
}

func writeOmniSaveProxyJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeOmniSaveProxyError(w http.ResponseWriter) {
	writeOmniSaveProxyJSON(w, http.StatusBadGateway, map[string]string{"error": "ai_service_unavailable"})
}
