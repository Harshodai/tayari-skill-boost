package api

import (
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
)

const (
	voiceDialTimeout    = 5 * time.Second
	voiceHandshakeLimit = 10 * time.Second
	voiceStreamLimit    = 10 * time.Minute
)

// routesVoice must be mounted inside the authenticated route group. The handler
// also performs a defense-in-depth context check so an accidental future public
// registration fails closed before dialing the Python AI service.
func (s *Server) routesVoice(r chi.Router) {
	r.Group(func(r chi.Router) {
		r.Use(s.voiceRateLimiter.Middleware)
		r.HandleFunc("/api/v1/interview/stream", s.handleVoiceStream)
		r.HandleFunc("/api/interview/stream", s.handleVoiceStream)
	})
}

func (s *Server) voiceOriginAllowed(origin string) bool {
	if origin == "" {
		return true // native clients and same-origin non-browser upgrades
	}

	allowed := map[string]struct{}{
		"http://localhost:8080": {},
		"http://localhost:8083": {},
		"http://localhost:8085": {},
		"http://localhost:5173": {},
		"http://127.0.0.1:8080": {},
		"http://127.0.0.1:8083": {},
		"http://127.0.0.1:8085": {},
		"http://127.0.0.1:5173": {},
	}
	if s.Config != nil {
		for _, configured := range append(s.Config.AllowedOrigins, s.Config.CORSAllowedOrigins...) {
			configured = strings.TrimSpace(configured)
			if configured != "" && configured != "*" {
				allowed[configured] = struct{}{}
			}
		}
	}
	_, ok := allowed[origin]
	return ok
}

func (s *Server) handleVoiceStream(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(contextKeyUser).(*models.User)
	if !ok || user == nil {
		s.respondError(w, http.StatusUnauthorized, "Authentication required")
		return
	}
	if !s.voiceOriginAllowed(r.Header.Get("Origin")) {
		s.respondError(w, http.StatusForbidden, "Origin not allowed")
		return
	}
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		s.respondError(w, http.StatusBadRequest, "Websocket upgrade required")
		return
	}

	u, err := url.Parse(s.Config.PythonAIURL)
	if err != nil {
		log.Printf("handleVoiceStream: failed to parse Python AI URL actor=%s: %v", user.ID, err)
		s.respondError(w, http.StatusInternalServerError, "Internal configuration error")
		return
	}

	host := u.Host
	if host == "" {
		host = u.Path
	}
	if !strings.Contains(host, ":") {
		host += ":8000"
	}

	backendConn, err := net.DialTimeout("tcp", host, voiceDialTimeout)
	if err != nil {
		log.Printf("handleVoiceStream: backend dial failed actor=%s host=%s: %v", user.ID, host, err)
		s.respondError(w, http.StatusBadGateway, "AI service is offline")
		return
	}
	defer backendConn.Close()

	hj, ok := w.(http.Hijacker)
	if !ok {
		log.Printf("handleVoiceStream: response writer does not support hijacking actor=%s", user.ID)
		s.respondError(w, http.StatusInternalServerError, "Webserver doesn't support hijacking")
		return
	}

	clientConn, _, err := hj.Hijack()
	if err != nil {
		log.Printf("handleVoiceStream: hijack failed actor=%s: %v", user.ID, err)
		return
	}
	defer clientConn.Close()

	// Bound the initial handshake separately from the long-lived stream.
	_ = clientConn.SetDeadline(time.Now().Add(voiceHandshakeLimit))
	_ = backendConn.SetDeadline(time.Now().Add(voiceHandshakeLimit))
	r.URL.Path = "/api/v1/interview/stream"
	r.URL.Scheme = "ws"
	r.URL.Host = host
	if err := r.Write(backendConn); err != nil {
		log.Printf("handleVoiceStream: backend handshake failed actor=%s: %v", user.ID, err)
		return
	}
	_ = clientConn.SetDeadline(time.Time{})
	_ = backendConn.SetDeadline(time.Time{})

	errChan := make(chan error, 2)
	go func() {
		_, copyErr := io.Copy(clientConn, backendConn)
		errChan <- copyErr
	}()
	go func() {
		_, copyErr := io.Copy(backendConn, clientConn)
		errChan <- copyErr
	}()

	timer := time.NewTimer(voiceStreamLimit)
	defer timer.Stop()
	select {
	case copyErr := <-errChan:
		if copyErr != nil {
			log.Printf("handleVoiceStream: stream ended actor=%s: %v", user.ID, copyErr)
		}
	case <-timer.C:
		log.Printf("handleVoiceStream: maximum duration reached actor=%s", user.ID)
	}
}
