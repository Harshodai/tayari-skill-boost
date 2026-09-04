package api

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"tayari-backend/internal/models"
)

func ailimitTestLimiter(limit int, now *time.Time) *perUserAILimiter {
	clock := time.Now
	if now != nil {
		clock = func() time.Time { return *now }
	}
	return newPerUserAILimiterWithConfig(limit, "", clock)
}

func ailimitReqWithUser(userID uuid.UUID) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", nil)
	user := &models.User{ID: userID}
	return req.WithContext(context.WithValue(req.Context(), contextKeyUser, user))
}

func ailimitServe(l *perUserAILimiter, r *http.Request) *httptest.ResponseRecorder {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	w := httptest.NewRecorder()
	l.Middleware(next).ServeHTTP(w, r)
	return w
}

func TestPerUserAILimiterAllowsUnderLimit(t *testing.T) {
	l := ailimitTestLimiter(2, nil)
	user := uuid.New()
	for i := 0; i < 2; i++ {
		if w := ailimitServe(l, ailimitReqWithUser(user)); w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, w.Code)
		}
	}
	w := ailimitServe(l, ailimitReqWithUser(user))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 over limit, got %d", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header on 429")
	}
	if n, err := strconv.Atoi(w.Header().Get("Retry-After")); err != nil || n < 1 {
		t.Fatalf("Retry-After must be a positive integer, got %q", w.Header().Get("Retry-After"))
	}
}

func TestPerUserAILimiterIsPerUser(t *testing.T) {
	l := ailimitTestLimiter(1, nil)
	if w := ailimitServe(l, ailimitReqWithUser(uuid.New())); w.Code != http.StatusOK {
		t.Fatalf("first user: expected 200, got %d", w.Code)
	}
	if w := ailimitServe(l, ailimitReqWithUser(uuid.New())); w.Code != http.StatusOK {
		t.Fatalf("second user must have an independent bucket, got %d", w.Code)
	}
}

func TestPerUserAILimiterFailsOpenWithoutRedis(t *testing.T) {
	t.Setenv("REDIS_URL", "")
	t.Setenv("REDIS_ADDR", "")
	t.Setenv("RATE_LIMIT_PER_USER_PER_MIN", "2")
	l := newPerUserAILimiter()
	if l.redisAddr != "" {
		t.Fatal("no Redis env means no Redis addr")
	}
	user := uuid.New()
	for i := 0; i < 2; i++ {
		if w := ailimitServe(l, ailimitReqWithUser(user)); w.Code != http.StatusOK {
			t.Fatalf("fail-open without Redis: expected 200, got %d", w.Code)
		}
	}
	w := ailimitServe(l, ailimitReqWithUser(user))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("in-memory fallback must enforce the limit without Redis, got %d", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header on fallback 429")
	}
}

func TestPerUserAILimiterWindowSlides(t *testing.T) {
	now := time.Now()
	l := ailimitTestLimiter(1, &now)
	user := uuid.New()
	if w := ailimitServe(l, ailimitReqWithUser(user)); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if w := ailimitServe(l, ailimitReqWithUser(user)); w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w.Code)
	}
	now = now.Add(61 * time.Second)
	if w := ailimitServe(l, ailimitReqWithUser(user)); w.Code != http.StatusOK {
		t.Fatalf("window should slide after 60s, got %d", w.Code)
	}
}

func TestPerUserAILimiterPassesThroughUnauthenticated(t *testing.T) {
	l := ailimitTestLimiter(1, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/analyze", nil)
	if w := ailimitServe(l, req); w.Code != http.StatusOK {
		t.Fatalf("no user in context must pass through, got %d", w.Code)
	}
}

func TestRedisAddrFromEnv(t *testing.T) {
	t.Setenv("REDIS_URL", "")
	t.Setenv("REDIS_ADDR", "")
	if got := redisAddrFromEnv(); got != "" {
		t.Fatalf("expected empty addr, got %q", got)
	}
	t.Setenv("REDIS_ADDR", "redis:6379")
	if got := redisAddrFromEnv(); got != "redis:6379" {
		t.Fatalf("expected redis:6379, got %q", got)
	}
	t.Setenv("REDIS_ADDR", "")
	t.Setenv("REDIS_URL", "redis://cache:6380/0")
	if got := redisAddrFromEnv(); got != "cache:6380" {
		t.Fatalf("expected cache:6380, got %q", got)
	}
	t.Setenv("REDIS_URL", "rediss://cache:6380/0")
	t.Setenv("REDIS_ADDR", "")
	if got := redisAddrFromEnv(); got != "" {
		t.Fatalf("TLS redis must fall back to in-memory, got %q", got)
	}
}

// fakeRedis is a minimal in-memory RESP server supporting the ZSET commands
// used by redisSlidingAllow, so the Redis path is tested without a real Redis.
type fakeRedis struct {
	mu   sync.Mutex
	sets map[string]map[string]int64
}

func newFakeRedis(t *testing.T) (addr string, close func()) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	fr := &fakeRedis{sets: map[string]map[string]int64{}}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go fr.serve(conn)
		}
	}()
	return ln.Addr().String(), func() { _ = ln.Close() }
}

func (fr *fakeRedis) serve(conn net.Conn) {
	defer conn.Close()
	r := bufio.NewReader(conn)
	for {
		args, err := readArgs(r)
		if err != nil {
			return
		}
		if len(args) == 0 {
			return
		}
		fr.mu.Lock()
		var resp string
		switch strings.ToUpper(args[0]) {
		case "ZREMRANGEBYSCORE":
			key, min, max := args[1], args[2], args[3]
			n := 0
			for m, s := range fr.sets[key] {
				if inRange(s, min, max) {
					delete(fr.sets[key], m)
					n++
				}
			}
			resp = fmt.Sprintf(":%d\r\n", n)
		case "ZRANGE":
			key := args[1]
			type kv struct {
				m string
				s int64
			}
			var kvs []kv
			for m, s := range fr.sets[key] {
				kvs = append(kvs, kv{m, s})
			}
			sort.Slice(kvs, func(i, j int) bool { return kvs[i].s < kvs[j].s })
			if len(kvs) == 0 {
				resp = "*0\r\n"
			} else {
				resp = fmt.Sprintf("*2\r\n$%d\r\n%s\r\n$%d\r\n%d\r\n",
					len(kvs[0].m), kvs[0].m, len(strconv.FormatInt(kvs[0].s, 10)), kvs[0].s)
			}
		case "ZCARD":
			resp = fmt.Sprintf(":%d\r\n", len(fr.sets[args[1]]))
		case "ZADD":
			key := args[1]
			if fr.sets[key] == nil {
				fr.sets[key] = map[string]int64{}
			}
			n, _ := strconv.ParseInt(args[2], 10, 64)
			fr.sets[key][args[3]] = n
			resp = ":1\r\n"
		case "EXPIRE":
			resp = ":1\r\n"
		default:
			resp = "-ERR unknown command\r\n"
		}
		fr.mu.Unlock()
		if _, err := conn.Write([]byte(resp)); err != nil {
			return
		}
	}
}

func inRange(s int64, min, max string) bool {
	if min != "0" && min != "-inf" {
		if lo, err := strconv.ParseInt(min, 10, 64); err == nil && s < lo {
			return false
		}
	}
	if hi, err := strconv.ParseInt(max, 10, 64); err == nil && s > hi {
		return false
	}
	return true
}

func readArgs(r *bufio.Reader) ([]string, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return nil, err
	}
	line = strings.TrimSpace(line)
	if !strings.HasPrefix(line, "*") {
		return nil, fmt.Errorf("expected array")
	}
	n, _ := strconv.Atoi(line[1:])
	var out []string
	for i := 0; i < n; i++ {
		hdr, err := r.ReadString('\n')
		if err != nil {
			return nil, err
		}
		hdr = strings.TrimSpace(hdr)
		if !strings.HasPrefix(hdr, "$") {
			return nil, fmt.Errorf("expected bulk")
		}
		size, _ := strconv.Atoi(hdr[1:])
		buf := make([]byte, size+2)
		for i := 0; i < size+2; {
			m, err := r.Read(buf[i:])
			if err != nil {
				return nil, err
			}
			i += m
		}
		out = append(out, string(buf[:size]))
	}
	return out, nil
}

func TestRedisSlidingAllowSendsLuaScript(t *testing.T) {
	var mu sync.Mutex
	var cmds []string
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				r := bufio.NewReader(c)
				sets := map[string]map[string]int64{}
				for {
					args, err := readArgs(r)
					if err != nil {
						return
					}
					if len(args) == 0 {
						return
					}
					mu.Lock()
					cmds = append(cmds, strings.ToUpper(args[0]))
					mu.Unlock()
					if strings.ToUpper(args[0]) != "EVAL" {
						_, _ = c.Write([]byte("-ERR expected EVAL for atomic sliding window\r\n"))
						return
					}
					if len(args) < 9 {
						_, _ = c.Write([]byte("-ERR wrong number of args\r\n"))
						return
					}
					key := args[3]
					cutoff, _ := strconv.ParseInt(args[4], 10, 64)
					nowMs, _ := strconv.ParseInt(args[5], 10, 64)
					limit, _ := strconv.Atoi(args[6])
					windowMs, _ := strconv.ParseInt(args[7], 10, 64)
					member := args[8]
					if sets[key] == nil {
						sets[key] = map[string]int64{}
					}
					for m, s := range sets[key] {
						if s <= cutoff {
							delete(sets[key], m)
						}
					}
					if len(sets[key]) >= limit {
						var oldest int64
						first := true
						for _, s := range sets[key] {
							if first || s < oldest {
								oldest = s
								first = false
							}
						}
						retry := int((oldest + windowMs - nowMs) / 1000)
						if retry < 1 {
							retry = 1
						}
						_, _ = fmt.Fprintf(c, "*2\r\n:0\r\n:%d\r\n", retry)
						continue
					}
					sets[key][member] = nowMs
					_, _ = c.Write([]byte("*2\r\n:1\r\n:0\r\n"))
				}
			}(conn)
		}
	}()
	now := time.Now()
	ok, _, err := redisSlidingAllow(ln.Addr().String(), "test:lua", 2, time.Minute, now, "m1")
	if err != nil || !ok {
		t.Fatalf("EVAL path must allow first hit: ok=%v err=%v cmds=%v", ok, err, cmds)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(cmds) == 0 || cmds[0] != "EVAL" {
		t.Fatalf("sliding window must be one atomic EVAL, first cmd=%v all=%v", cmds, cmds)
	}
}

func TestRedisSlidingAllowEndToEnd(t *testing.T) {
	addr, close := newFakeRedis(t)
	defer close()
	now := time.Now()
	ok, _, err := redisSlidingAllow(addr, "test:key", 2, time.Minute, now, "m1")
	if err != nil || !ok {
		t.Fatalf("first hit must allow: ok=%v err=%v", ok, err)
	}
	ok, _, err = redisSlidingAllow(addr, "test:key", 2, time.Minute, now, "m2")
	if err != nil || !ok {
		t.Fatalf("second hit must allow: ok=%v err=%v", ok, err)
	}
	ok, retry, err := redisSlidingAllow(addr, "test:key", 2, time.Minute, now, "m3")
	if err != nil || ok {
		t.Fatalf("third hit must deny: ok=%v err=%v", ok, err)
	}
	if retry < 1 {
		t.Fatalf("denial must carry positive retry, got %d", retry)
	}
}

func TestLimiterUsesRedisWhenConfigured(t *testing.T) {
	addr, close := newFakeRedis(t)
	defer close()
	l := newPerUserAILimiterWithConfig(1, addr, time.Now)
	user := uuid.New()
	if w := ailimitServe(l, ailimitReqWithUser(user)); w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if w := ailimitServe(l, ailimitReqWithUser(user)); w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected Redis-backed 429, got %d", w.Code)
	}
}

func TestLimiterFailsOpenOnDeadRedis(t *testing.T) {
	l := newPerUserAILimiterWithConfig(1, "127.0.0.1:1", time.Now)
	user := uuid.New()
	if w := ailimitServe(l, ailimitReqWithUser(user)); w.Code != http.StatusOK {
		t.Fatalf("dead Redis must fail open on first hit, got %d", w.Code)
	}
	w := ailimitServe(l, ailimitReqWithUser(user))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("in-memory fallback must enforce the limit, got %d", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header on fallback 429")
	}
}
