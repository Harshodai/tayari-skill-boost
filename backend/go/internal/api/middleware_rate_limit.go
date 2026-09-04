package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"tayari-backend/internal/ai"
	"tayari-backend/internal/models"

	"github.com/go-chi/chi/v5"
)

const (
	aiRateLimitWindow   = time.Minute
	aiRateLimitKeySpace = "tayari:rl:ai:"
	redisDialTimeout    = 200 * time.Millisecond
	redisIOTimeout      = 500 * time.Millisecond
	// fallbackMaxKeys bounds the in-memory window: past this the next
	// allowance opportunistically sweeps expired idle keys.
	fallbackMaxKeys = 10000
)

// perUserAILimiter is a sliding-window per-user rate limiter for LLM-heavy AI
// proxy endpoints. It uses Redis when REDIS_URL/REDIS_ADDR is set and fails
// open to a process-local in-memory window when Redis is unavailable, so a
// Redis outage never blocks legitimate AI traffic.
type perUserAILimiter struct {
	limit     int
	redisAddr string
	now       func() time.Time
	counter   int64

	mu       sync.Mutex
	fallback map[string][]int64
}

func newPerUserAILimiter() *perUserAILimiter {
	return newPerUserAILimiterWithConfig(rateLimitPerUserPerMin(), redisAddrFromEnv(), time.Now)
}

func newPerUserAILimiterWithConfig(limit int, redisAddr string, now func() time.Time) *perUserAILimiter {
	if limit < 1 {
		limit = 1
	}
	if now == nil {
		now = time.Now
	}
	return &perUserAILimiter{
		limit:     limit,
		redisAddr: redisAddr,
		now:       now,
		fallback:  make(map[string][]int64),
	}
}

func rateLimitPerUserPerMin() int {
	if v := strings.TrimSpace(os.Getenv("RATE_LIMIT_PER_USER_PER_MIN")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return 30
}

func redisAddrFromEnv() string {
	if raw := strings.TrimSpace(os.Getenv("REDIS_URL")); raw != "" {
		if strings.HasPrefix(strings.ToLower(raw), "rediss://") {
			// ponytail: no TLS client here on purpose — failing open to the
			// in-memory window beats hand-rolling TLS session handling in
			// the gateway for a best-effort rate-limit counter.
			return ""
		}
		if addr, ok := parseRedisURL(raw); ok {
			return addr
		}
	}
	if addr := strings.TrimSpace(os.Getenv("REDIS_ADDR")); addr != "" {
		if strings.Contains(addr, ":") {
			return addr
		}
		return net.JoinHostPort(addr, "6379")
	}
	return ""
}

func parseRedisURL(raw string) (string, bool) {
	s := raw
	if i := strings.Index(s, "://"); i != -1 {
		s = s[i+3:]
	}
	if i := strings.LastIndex(s, "@"); i != -1 {
		s = s[i+1:]
	}
	if i := strings.Index(s, "/"); i != -1 {
		s = s[:i]
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return "", false
	}
	if !strings.Contains(s, ":") {
		s += ":6379"
	}
	return s, true
}

// resolveAIUserID follows the existing useUserID pattern: prefer the
// authenticated user, then the API-key owner. Empty means unauthenticated —
// the outer auth middleware owns that decision, so the limiter passes through.
func resolveAIUserID(r *http.Request) string {
	if user, ok := r.Context().Value(contextKeyUser).(*models.User); ok && user != nil {
		return user.ID.String()
	}
	if ak, ok := r.Context().Value(apiKeyContextKey{}).(*models.ApiKey); ok && ak != nil && ak.UserID != "" {
		return ak.UserID
	}
	return ""
}

func (l *perUserAILimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if l == nil {
			next.ServeHTTP(w, r)
			return
		}
		userID := resolveAIUserID(r)
		if userID == "" {
			next.ServeHTTP(w, r)
			return
		}
		ok, retryAfter := l.allow(userID)
		if !ok {
			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":       "rate_limit_exceeded",
				"retry_after": retryAfter,
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (l *perUserAILimiter) allow(userID string) (bool, int) {
	now := l.now()
	if l.redisAddr != "" {
		ok, retry, err := redisSlidingAllow(l.redisAddr, aiRateLimitKeySpace+userID, l.limit, aiRateLimitWindow, now, l.member())
		if err == nil {
			return ok, retry
		}
		// ponytail: any Redis error fails open to the in-memory window —
		// rate limiting is best-effort, AI availability is not.
	}
	return l.fallbackAllow(userID, now)
}

func (l *perUserAILimiter) member() string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), atomic.AddInt64(&l.counter, 1))
}

func (l *perUserAILimiter) fallbackAllow(userID string, now time.Time) (bool, int) {
	cutoff := now.Add(-aiRateLimitWindow).UnixMilli()
	nowMs := now.UnixMilli()
	l.mu.Lock()
	defer l.mu.Unlock()
	var kept []int64
	var oldest int64
	for _, ts := range l.fallback[userID] {
		if ts > cutoff {
			if oldest == 0 || ts < oldest {
				oldest = ts
			}
			kept = append(kept, ts)
		}
	}
	if len(kept) >= l.limit {
		retry := int((oldest + aiRateLimitWindow.Milliseconds() - nowMs) / 1000)
		if retry < 1 {
			retry = 1
		}
		l.fallback[userID] = kept
		return false, retry
	}
	if len(kept) == 0 {
		// ponytail: drop the key instead of leaving a stale entry — idle
		// users otherwise pin memory forever until they return.
		delete(l.fallback, userID)
	}
	l.fallback[userID] = append(kept, nowMs)
	if len(l.fallback) > fallbackMaxKeys {
		l.sweepFallback(nowMs)
	}
	return true, 0
}

// sweepFallback drops sub-cutoff entries map-wide so one-shot users cannot
// grow the fallback window without bound. Caller holds l.mu.
func (l *perUserAILimiter) sweepFallback(nowMs int64) {
	cutoff := nowMs - aiRateLimitWindow.Milliseconds()
	for key, stamps := range l.fallback {
		kept := stamps[:0]
		for _, ts := range stamps {
			if ts > cutoff {
				kept = append(kept, ts)
			}
		}
		if len(kept) == 0 {
			delete(l.fallback, key)
			continue
		}
		l.fallback[key] = kept
	}
}

// redisSlidingLua runs the ZSET sliding window atomically: evict expired,
// count, conditionally add, expire, and report allowed+retry in one step.
const redisSlidingLua = `local key = KEYS[1]
local cutoff = ARGV[1]
local nowMs = ARGV[2]
local limit = tonumber(ARGV[3])
local windowMs = tonumber(ARGV[4])
local member = ARGV[5]
local ttlMs = tonumber(ARGV[6])
redis.call('ZREMRANGEBYSCORE', key, '0', cutoff)
local count = redis.call('ZCARD', key)
if count >= limit then
  local r = redis.call('ZRANGE', key, '0', '0', 'WITHSCORES')
  local oldest = 0
  if #r >= 2 then oldest = tonumber(r[2]) end
  local retry = math.floor((oldest + windowMs - tonumber(nowMs)) / 1000)
  if retry < 1 then retry = 1 end
  return {0, retry}
end
redis.call('ZADD', key, nowMs, member)
redis.call('PEXPIRE', key, ttlMs)
return {1, 0}`

// redisSlidingAllow implements a ZSET sliding window over a raw RESP
// connection so the gateway needs no Redis client dependency. It sends the
// check+add as one atomic EVAL and falls back to the legacy multi-step
// pipeline when the server errors on EVAL (no scripting support).
func redisSlidingAllow(addr, key string, limit int, window time.Duration, now time.Time, member string) (bool, int, error) {
	conn, err := net.DialTimeout("tcp", addr, redisDialTimeout)
	if err != nil {
		return false, 0, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(redisIOTimeout))
	rw := bufio.NewReader(conn)
	nowMs := now.UnixMilli()
	windowMs := window.Milliseconds()
	cutoff := nowMs - windowMs

	ttlMs := strconv.FormatInt(windowMs+5000, 10)
	if err := writeRESP(conn, "EVAL", redisSlidingLua, "1", key,
		strconv.FormatInt(cutoff, 10), strconv.FormatInt(nowMs, 10),
		strconv.Itoa(limit), strconv.FormatInt(windowMs, 10), member, ttlMs); err != nil {
		return false, 0, err
	}
	ok, retry, err := readEvalAllow(rw)
	if err == nil {
		return ok, retry, nil
	}
	if !strings.HasPrefix(err.Error(), "redis error:") {
		return false, 0, err
	}
	// ponytail: EVAL unsupported — fall back to the legacy pipeline.
	return redisSlidingPipeline(conn, rw, key, limit, window, nowMs, cutoff, member)
}

func redisSlidingPipeline(conn net.Conn, rw *bufio.Reader, key string, limit int, window time.Duration, nowMs, cutoff int64, member string) (bool, int, error) {
	if err := writeRESP(conn, "ZREMRANGEBYSCORE", key, "0", strconv.FormatInt(cutoff, 10)); err != nil {
		return false, 0, err
	}
	if err := writeRESP(conn, "ZRANGE", key, "0", "0", "WITHSCORES"); err != nil {
		return false, 0, err
	}
	if err := writeRESP(conn, "ZCARD", key); err != nil {
		return false, 0, err
	}
	if _, err := readRESP(rw); err != nil {
		return false, 0, err
	}
	oldest, err := readOldestScore(rw)
	if err != nil {
		return false, 0, err
	}
	count, err := readRESPInt(rw)
	if err != nil {
		return false, 0, err
	}
	if count >= int64(limit) {
		retry := int((oldest + window.Milliseconds() - nowMs) / 1000)
		if retry < 1 {
			retry = 1
		}
		return false, retry, nil
	}
	if err := writeRESP(conn, "ZADD", key, strconv.FormatInt(nowMs, 10), member); err != nil {
		return false, 0, err
	}
	if err := writeRESP(conn, "EXPIRE", key, strconv.Itoa(int(window.Seconds())+5)); err != nil {
		return false, 0, err
	}
	if _, err := readRESP(rw); err != nil {
		return false, 0, err
	}
	if _, err := readRESP(rw); err != nil {
		return false, 0, err
	}
	return true, 0, nil
}

func readEvalAllow(r *bufio.Reader) (bool, int, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return false, 0, err
	}
	if len(line) < 3 {
		return false, 0, fmt.Errorf("short RESP reply")
	}
	if line[0] == '-' {
		return false, 0, fmt.Errorf("redis error: %s", strings.TrimSuffix(line[1:], "\r\n"))
	}
	if line[0] != '*' {
		return false, 0, fmt.Errorf("unexpected EVAL reply %q", strings.TrimSpace(line))
	}
	n, err := strconv.Atoi(strings.TrimSpace(line[1:]))
	if err != nil || n != 2 {
		return false, 0, fmt.Errorf("unexpected EVAL arity %q", strings.TrimSpace(line))
	}
	allowed, err := readRESPInt(r)
	if err != nil {
		return false, 0, err
	}
	retry, err := readRESPInt(r)
	if err != nil {
		return false, 0, err
	}
	return allowed == 1, int(retry), nil
}

func writeRESP(conn net.Conn, args ...string) error {
	var sb strings.Builder
	sb.WriteString("*" + strconv.Itoa(len(args)) + "\r\n")
	for _, a := range args {
		sb.WriteString("$" + strconv.Itoa(len(a)) + "\r\n" + a + "\r\n")
	}
	_, err := conn.Write([]byte(sb.String()))
	return err
}

type respValue struct {
	isNil bool
	intV  int64
	bulks []string
}

func readRESP(r *bufio.Reader) (respValue, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return respValue{}, err
	}
	if len(line) < 3 {
		return respValue{}, fmt.Errorf("short RESP reply")
	}
	typ, payload := line[0], strings.TrimSuffix(line[1:], "\r\n")
	switch typ {
	case '+', ':':
		if typ == ':' {
			n, err := strconv.ParseInt(strings.TrimSpace(payload), 10, 64)
			if err != nil {
				return respValue{}, err
			}
			return respValue{intV: n}, nil
		}
		return respValue{bulks: []string{payload}}, nil
	case '-':
		return respValue{}, fmt.Errorf("redis error: %s", payload)
	case '$':
		n, err := strconv.Atoi(strings.TrimSpace(payload))
		if err != nil {
			return respValue{}, err
		}
		if n < 0 {
			return respValue{isNil: true}, nil
		}
		buf := make([]byte, n+2)
		for i := 0; i < n+2; {
			m, err := r.Read(buf[i:])
			if err != nil {
				return respValue{}, err
			}
			i += m
		}
		return respValue{bulks: []string{string(buf[:n])}}, nil
	case '*':
		n, err := strconv.Atoi(strings.TrimSpace(payload))
		if err != nil {
			return respValue{}, err
		}
		if n < 0 {
			return respValue{isNil: true}, nil
		}
		var out []string
		for i := 0; i < n; i++ {
			el, err := readRESP(r)
			if err != nil {
				return respValue{}, err
			}
			if !el.isNil && len(el.bulks) > 0 {
				out = append(out, el.bulks[0])
			}
		}
		return respValue{bulks: out}, nil
	default:
		return respValue{}, fmt.Errorf("unknown RESP type %q", typ)
	}
}

func readRESPInt(r *bufio.Reader) (int64, error) {
	v, err := readRESP(r)
	if err != nil {
		return 0, err
	}
	return v.intV, nil
}

// readOldestScore parses ZRANGE ... WITHSCORES into the smallest score (0 when empty).
func readOldestScore(r *bufio.Reader) (int64, error) {
	v, err := readRESP(r)
	if err != nil {
		return 0, err
	}
	if v.isNil || len(v.bulks) < 2 {
		return 0, nil
	}
	return strconv.ParseInt(v.bulks[1], 10, 64)
}

// respondAICircuitOpen writes the degraded 503 when the AI circuit is open.
// Returns true when handled so callers can return early without new imports.
func (s *Server) respondAICircuitOpen(w http.ResponseWriter, err error) bool {
	if ai.IsCircuitOpen(err) {
		s.respondJSON(w, http.StatusServiceUnavailable, ai.DegradedPayload())
		return true
	}
	return false
}

// respondAIGatewayError maps AI-client failures to gateway responses. An open
// circuit serves the structured degraded body; everything else keeps the
// caller's original BadGateway message so behavior is unchanged.
func (s *Server) respondAIGatewayError(w http.ResponseWriter, err error, fallbackMsg string) {
	if s.respondAICircuitOpen(w, err) {
		return
	}
	s.respondError(w, http.StatusBadGateway, fallbackMsg)
}

// routesAIProxy registers the LLM-heavy AI proxy endpoints under BOTH prefixes
// behind the per-user sliding-window limiter. CRUD and non-LLM routes stay on
// the shared auth limiter only.
func (s *Server) routesAIProxy(r chi.Router) {
	r.Group(func(r chi.Router) {
		if s.aiPerUserLimiter != nil {
			r.Use(s.aiPerUserLimiter.Middleware)
		}
		r.Post("/api/v1/analyze", s.handleAnalyzeText)
		r.Post("/api/analyze", s.handleAnalyzeText)
		r.Post("/api/v1/resumes/analyze-text", s.handleAnalyzeText)
		r.Post("/api/resumes/analyze-text", s.handleAnalyzeText)
		r.Post("/api/v1/resumes/{id}/optimize", s.handleOptimizeResume)
		r.Post("/api/resumes/{id}/optimize", s.handleOptimizeResume)
		r.Post("/api/v1/resumes/{id}/analyze", s.handleAnalyzeResume)
		r.Post("/api/resumes/{id}/analyze", s.handleAnalyzeResume)
		r.Post("/api/v1/verification/submit", s.handleVerificationSubmit)
		r.Post("/api/verification/submit", s.handleVerificationSubmit)
		r.Post("/api/v1/referral/draft", s.handleReferralDraft)
		r.Post("/api/referral/draft", s.handleReferralDraft)
		r.Post("/api/v1/interview/copilot-hint", s.handleInterviewCopilotHint)
		r.Post("/api/interview/copilot-hint", s.handleInterviewCopilotHint)
		r.Post("/api/v1/interview/voice-feedback", s.handleInterviewVoiceFeedback)
		r.Post("/api/interview/voice-feedback", s.handleInterviewVoiceFeedback)
		r.Post("/api/v1/interview/copilot/stream", s.handleInterviewCopilotStream)
		r.Post("/api/interview/copilot/stream", s.handleInterviewCopilotStream)
		r.Post("/api/v1/interview/evaluate-star", s.handleInterviewEvaluateSTAR)
		r.Post("/api/interview/evaluate-star", s.handleInterviewEvaluateSTAR)
	})
}
