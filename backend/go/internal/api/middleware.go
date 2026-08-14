package api

import (
	"context"
	"encoding/json"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"tayari-backend/internal/models"

	"github.com/google/uuid"
	"golang.org/x/time/rate"
)

// ------------------------------------------------------------------------------
// Request Logging Middleware
// ------------------------------------------------------------------------------

type responseRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (rr *responseRecorder) Unwrap() http.ResponseWriter { return rr.ResponseWriter }

func (rr *responseRecorder) WriteHeader(code int) {
	if rr.statusCode != 0 {
		return
	}
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}

func (rr *responseRecorder) Write(b []byte) (int, error) {
	if rr.statusCode == 0 {
		rr.WriteHeader(http.StatusOK)
	}
	return rr.ResponseWriter.Write(b)
}

var requestLogger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

func requestTraceID(r *http.Request) string {
	traceID := strings.TrimSpace(r.Header.Get("X-Request-ID"))
	if traceID == "" || len(traceID) > 128 || strings.ContainsAny(traceID, "\r\n") {
		return uuid.NewString()
	}
	return traceID
}

func (s *Server) requestLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		traceID := requestTraceID(r)
		w.Header().Set("X-Request-ID", traceID)
		rr := &responseRecorder{ResponseWriter: w}
		next.ServeHTTP(rr, r)
		duration := time.Since(start)
		status := rr.statusCode
		if status == 0 {
			status = http.StatusOK
		}

		userID := "anonymous"
		if user, ok := r.Context().Value(contextKeyUser).(*models.User); ok && user != nil {
			userID = user.ID.String()
		}
		if s.metrics != nil {
			s.metrics.ObserveRequest(r.Method, r.URL.Path, status, duration)
		}

		requestLogger.Info("http_request",
			"timestamp", start.UTC().Format(time.RFC3339Nano),
			"method", r.Method,
			"path", r.URL.Path,
			"status", status,
			"duration_ms", float64(duration.Microseconds())/1000,
			"user_id", userID,
			"trace_id", traceID,
		)
	})
}

// ------------------------------------------------------------------------------
// Rate Limiting Middleware (Robust with penalty backoff)
// ------------------------------------------------------------------------------

type clientLimiter struct {
	limiter    *rate.Limiter
	lastSeen   time.Time
	strikes    int
	penaltyEnd time.Time
}

type rateLimiter struct {
	mu        sync.RWMutex
	clients   map[string]*clientLimiter
	rate      rate.Limit
	burst     int
	useUserID bool
}

func newRateLimiter(r rate.Limit, burst int, useUserID bool) *rateLimiter {
	rl := &rateLimiter{
		clients:   make(map[string]*clientLimiter),
		rate:      r,
		burst:     burst,
		useUserID: useUserID,
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *rateLimiter) cleanupLoop() {
	for {
		time.Sleep(5 * time.Minute)
		rl.cleanup()
	}
}

func (rl *rateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for id, client := range rl.clients {
		if now.Sub(client.lastSeen) > 10*time.Minute {
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
		if !exists {
			client = &clientLimiter{
				limiter:  rate.NewLimiter(rl.rate, rl.burst),
				lastSeen: now,
			}
			rl.clients[clientID] = client
		}
		client.lastSeen = now

		// Check penalty
		if now.Before(client.penaltyEnd) {
			rl.mu.Unlock()
			w.Header().Set("Retry-After", "60")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{"error": "Too Many Requests", "message": "You are temporarily blocked. Try again later."})
			return
		}

		if !client.limiter.Allow() {
			client.strikes++
			// If blocked > 5 times quickly, apply a penalty backoff (exponential)
			if client.strikes > 5 {
				penaltyDuration := time.Duration(client.strikes) * time.Minute
				client.penaltyEnd = now.Add(penaltyDuration)
				log.Printf("[RATE LIMIT] Penalty applied to %s for %v", clientID, penaltyDuration)
			}
			rl.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{"error": "Rate limit exceeded"})
			return
		}

		// Reset strikes if allowed
		if client.strikes > 0 {
			client.strikes = 0
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

// tenantMiddleware resolves the active tenant from Host header or X-Tenant-Domain
func (s *Server) tenantMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		domain := r.Header.Get("X-Tenant-Domain")
		if domain == "" {
			domain = r.URL.Query().Get("tenant_domain")
		}
		if domain == "" {
			domain = r.Host
			if h, _, err := net.SplitHostPort(domain); err == nil {
				domain = h
			}
		}

		domain = strings.ToLower(strings.TrimSpace(domain))

		if s.DB == nil || s.DB.Conn == nil {
			next.ServeHTTP(w, r)
			return
		}

		var tenant models.Tenant
		query := `SELECT id, name, domain, logo_url, primary_color, secondary_color, created_at 
		          FROM tenants 
		          WHERE domain = $1 OR SUBSTRING(domain FROM '([^.]+)') = $2`

		subdomain := domain
		if idx := strings.Index(domain, "."); idx != -1 {
			subdomain = domain[:idx]
		}

		err := s.DB.Conn.QueryRowContext(r.Context(), query, domain, subdomain).Scan(
			&tenant.ID, &tenant.Name, &tenant.Domain, &tenant.LogoURL, &tenant.PrimaryColor, &tenant.SecondaryColor, &tenant.CreatedAt,
		)

		if err == nil {
			ctx := context.WithValue(r.Context(), contextKeyTenant, &tenant)
			r = r.WithContext(ctx)
		} else {
			log.Printf("[TENANT] Could not resolve tenant for domain '%s' (subdomain '%s'): %v", domain, subdomain, err)
		}

		next.ServeHTTP(w, r)
	})
}
