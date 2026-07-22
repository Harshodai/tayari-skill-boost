package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
)

// -------------------------------------------------------------------
// Hermes proxy route tests (WS-E).
//
// Strategy: stand up a fake Python AI service (httptest.Server) that returns
// canned JSON, point a real ai.Client at it via NewServer, and drive the
// protected Hermes routes with a Bearer token. A dedicated mock auth service
// returns a valid user so authMiddleware lets the request through.
// -------------------------------------------------------------------

// hermesMockAuth returns a fixed user for any token so the protected group
// accepts requests carrying a Bearer token.
type hermesMockAuth struct{}

func (m *hermesMockAuth) VerifyToken(token string) (*models.User, error) {
	if token == "" {
		return nil, io.ErrUnexpectedEOF
	}
	return &models.User{ID: uuid.New(), Email: "tester@example.com", Role: "user"}, nil
}
func (m *hermesMockAuth) Login(ctx context.Context, email, password string) (string, error) {
	return "tok", nil
}
func (m *hermesMockAuth) Register(ctx context.Context, email, password string) (*models.User, error) {
	return &models.User{ID: uuid.New(), Email: email}, nil
}
func (m *hermesMockAuth) SocialLogin(w http.ResponseWriter, r *http.Request)    {}
func (m *hermesMockAuth) SocialCallback(w http.ResponseWriter, r *http.Request) {}

// fakeAIServer returns an httptest.Server whose handler is driven by the
// provided function. Each test wires its own canned responses / status codes.
func fakeAIServer(t *testing.T, handler http.HandlerFunc) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(handler))
}

// newHermesServer builds a Server whose ai.Client points at the fake Python
// service. The DB is nil (Hermes routes never touch the Go DB — they only
// proxy).
func newHermesServer(t *testing.T, pythonURL string) *Server {
	t.Helper()
	cfg := &config.Config{PythonAIURL: pythonURL}
	return NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: nil})
}

// authReq builds a request with a Bearer token so it passes authMiddleware.
func authReq(method, target string, body []byte) *http.Request {
	req := httptest.NewRequest(method, target, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("Content-Type", "application/json")
	return req
}

// -------------------------------------------------------------------
// handleHermesScrape
// -------------------------------------------------------------------

func TestHermesScrape_ProxiesToPythonAndReturns200(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		if r.Method != http.MethodPost || r.URL.Path != "/api/v1/hermes/scrape" {
			t.Errorf("unexpected upstream call: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"run_id":"r-1","status":"queued","task_id":"t-1"}`)
	})
	defer srv.Close()

	server := newHermesServer(t, srv.URL)
	body := []byte(`{"query":"backend engineer","sync":false}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/hermes/scrape", body))

	if !called {
		t.Fatal("expected the upstream Python service to be called")
	}
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if resp["status"] != "queued" || resp["run_id"] != "r-1" {
		t.Errorf("unexpected body: %s", w.Body.String())
	}
}

func TestHermesScrape_AliasRouteAlsoProxies(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"run_id":"r-2","status":"queued"}`)
	})
	defer srv.Close()

	server := newHermesServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/hermes/scrape",
		[]byte(`{"query":"x"}`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on alias route, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHermesScrape_400OnEmptyBody(t *testing.T) {
	server := newHermesServer(t, "http://unreachable.invalid")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/hermes/scrape", nil))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty body, got %d", w.Code)
	}
}

func TestHermesScrape_502WhenPythonUnreachable(t *testing.T) {
	// Point at a closed port: httptest.NewServer then immediately Close() it.
	srv := fakeAIServer(t, func(http.ResponseWriter, *http.Request) {})
	srv.Close()
	server := newHermesServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/hermes/scrape",
		[]byte(`{"query":"x"}`)))
	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 when Python is down, got %d: %s", w.Code, w.Body.String())
	}
}

// -------------------------------------------------------------------
// handleHermesJobsBoard
// -------------------------------------------------------------------

func TestHermesJobsBoard_ProxiesAndReturnsCachedJobs(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/hermes/jobs/greenhouse" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("limit") != "40" {
			t.Errorf("expected limit=40, got %q", r.URL.Query().Get("limit"))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"board":"greenhouse","count":1,"jobs":[{"id":"j1"}]}`)
	})
	defer srv.Close()

	server := newHermesServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/hermes/jobs/greenhouse", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if resp["board"] != "greenhouse" || resp["count"] != float64(1) {
		t.Errorf("unexpected body: %s", w.Body.String())
	}
}

// -------------------------------------------------------------------
// handleHermesRunsList
// -------------------------------------------------------------------

func TestHermesRunsList_ForwardsQueryParams(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/hermes/runs" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		if r.URL.RawQuery != "run_type=scrape&status=completed&limit=10" {
			t.Errorf("unexpected upstream query: %q", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"runs":[{"run_id":"r1"}]}`)
	})
	defer srv.Close()

	server := newHermesServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet,
		"/api/v1/hermes/runs?run_type=scrape&status=completed&limit=10", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// -------------------------------------------------------------------
// handleHermesRunDetail
// -------------------------------------------------------------------

func TestHermesRunDetail_200WhenPythonReturnsRun(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/hermes/runs/r-abc" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"run_id":"r-abc","status":"running","progress":42}`)
	})
	defer srv.Close()

	server := newHermesServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/hermes/runs/r-abc", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestHermesRunDetail_404WhenPythonReturnsNotFound(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = io.WriteString(w, `{"detail":"Run not found"}`)
	})
	defer srv.Close()

	server := newHermesServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/hermes/runs/missing", nil))
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 to pass through, got %d: %s", w.Code, w.Body.String())
	}
}

// -------------------------------------------------------------------
// isPythonNotFound helper
// -------------------------------------------------------------------

func TestIsPythonNotFound_Detects404(t *testing.T) {
	if isPythonNotFound(nil) {
		t.Error("nil error should not be treated as 404")
	}
	err404 := &upstreamError{msg: "AI service returned 404: <body>"}
	if !isPythonNotFound(err404) {
		t.Error("error containing ' 404:' should be detected as not-found")
	}
	err500 := &upstreamError{msg: "AI service returned 500: oops"}
	if isPythonNotFound(err500) {
		t.Error("500 error should not be treated as 404")
	}
}

// upstreamError is a tiny error type for the helper test so we do not depend
// on the ai package internals.
type upstreamError struct{ msg string }

func (e *upstreamError) Error() string { return e.msg }

// -------------------------------------------------------------------
// Routing / 404
// -------------------------------------------------------------------

func TestHermesUnknownRoute_404(t *testing.T) {
	server := newHermesServer(t, "http://unreachable.invalid")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/hermes/unknown", nil))
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unknown Hermes route, got %d", w.Code)
	}
}

func TestHermesUnauthenticated_401(t *testing.T) {
	// No Bearer token → authMiddleware rejects before the proxy is hit.
	server := newHermesServer(t, "http://unreachable.invalid")
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/hermes/runs", nil)
	server.Router.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without auth, got %d", w.Code)
	}
}

// -------------------------------------------------------------------
// sanity: guard against accidental import drift
// -------------------------------------------------------------------

func TestHermesImportsCompile(t *testing.T) {
	// Ensure strings is used (isPythonNotFound relies on it).
	if !strings.Contains("AI service returned 404: x", " 404:") {
		t.Fatal("strings.Contains sanity check failed")
	}
}
