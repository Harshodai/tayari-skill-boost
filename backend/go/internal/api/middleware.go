package api

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"tayari-backend/internal/models"
)

// ------------------------------------------------------------------------------
// Request Logging Middleware
// ------------------------------------------------------------------------------

type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}

func (rr *responseRecorder) Write(b []byte) (int, error) {
	if rr.statusCode == 0 {
		rr.statusCode = http.StatusOK
	}
	return rr.ResponseWriter.Write(b)
}

func (s *Server) requestLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rr := &responseRecorder{ResponseWriter: w}
		next.ServeHTTP(rr, r)
		duration := time.Since(start)

		userID := "anonymous"
		if user, ok := r.Context().Value(contextKeyUser).(*models.User); ok && user != nil {
			userID = user.ID.String()
		}

		log.Printf("[REQUEST] %s %s %s %d %s user=%s",
			start.Format(time.RFC3339),
			r.Method,
			r.URL.Path,
			rr.statusCode,
			duration,
			userID,
		)
	})
}

// ------------------------------------------------------------------------------
// Rate Limiting Middleware
// ------------------------------------------------------------------------------

type clientLimiter struct {
	requests    int
	windowStart time.Time
}

type rateLimiter struct {
	mu        sync.RWMutex
	clients   map[string]*clientLimiter
	limit     int
	useUserID bool
}

func newRateLimiter(limit int, useUserID bool) *rateLimiter {
	return &rateLimiter{
		clients:   make(map[string]*clientLimiter),
		limit:     limit,
		useUserID: useUserID,
	}
}

func (rl *rateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for id, client := range rl.clients {
		if now.Sub(client.windowStart) > time.Minute {
			delete(rl.clients, id)
		}
	}
}

func (rl *rateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientID := rl.getClientID(r)
		if rl.useUserID {
			if user, ok := r.Context().Value(contextKeyUser).(*models.User); ok && user != nil {
				clientID = user.ID.String()
			}
		}

		rl.mu.Lock()
		client, exists := rl.clients[clientID]
		now := time.Now()
		if !exists || now.Sub(client.windowStart) > time.Minute {
			rl.clients[clientID] = &clientLimiter{
				requests:    1,
				windowStart: now,
			}
		} else {
			client.requests++
			if client.requests > rl.limit {
				rl.mu.Unlock()
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				json.NewEncoder(w).Encode(map[string]string{"error": "Rate limit exceeded"})
				return
			}
		}
		rl.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}

func (rl *rateLimiter) getClientID(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if ip == "" {
		ip = r.Header.Get("X-Real-IP")
	}
	if ip == "" {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err == nil && host != "" {
			ip = host
		}
	}
	if ip == "" {
		ip = r.RemoteAddr
	}
	return ip
}
