package api

import (
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/chi/v5"
)

func (s *Server) routesVoice(r chi.Router) {
	r.HandleFunc("/api/v1/interview/stream", s.handleVoiceStream)
	r.HandleFunc("/api/interview/stream", s.handleVoiceStream)
}

func (s *Server) handleVoiceStream(w http.ResponseWriter, r *http.Request) {
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		s.respondError(w, http.StatusBadRequest, "Websocket upgrade required")
		return
	}

	u, err := url.Parse(s.Config.PythonAIURL)
	if err != nil {
		log.Printf("handleVoiceStream: failed to parse Python AI URL: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Internal configuration error")
		return
	}

	host := u.Host
	if host == "" {
		host = u.Path
	}
	if !strings.Contains(host, ":") {
		host = host + ":8000"
	}

	backendConn, err := net.Dial("tcp", host)
	if err != nil {
		log.Printf("handleVoiceStream: failed to connect to Python AI backend (%s): %v", host, err)
		s.respondError(w, http.StatusBadGateway, "AI service is offline")
		return
	}
	defer backendConn.Close()

	hj, ok := w.(http.Hijacker)
	if !ok {
		log.Printf("handleVoiceStream: response writer does not support hijacking")
		s.respondError(w, http.StatusInternalServerError, "Webserver doesn't support hijacking")
		return
	}

	clientConn, _, err := hj.Hijack()
	if err != nil {
		log.Printf("handleVoiceStream: hijack failed: %v", err)
		s.respondError(w, http.StatusInternalServerError, "Connection hijack failed")
		return
	}
	defer clientConn.Close()

	// Adjust headers and path
	r.URL.Path = "/api/v1/interview/stream"
	r.URL.Scheme = "ws"
	r.URL.Host = host

	err = r.Write(backendConn)
	if err != nil {
		log.Printf("handleVoiceStream: failed to write handshake to backend: %v", err)
		return
	}

	errChan := make(chan error, 2)
	go func() {
		_, err := io.Copy(clientConn, backendConn)
		errChan <- err
	}()
	go func() {
		_, err := io.Copy(backendConn, clientConn)
		errChan <- err
	}()

	<-errChan
}
