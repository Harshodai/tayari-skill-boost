package api

import (
	"bytes"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

// fakeSQLDriver is a stdlib-only no-op driver registered so sql.Open returns a
// *sql.DB whose queries return errors instead of panicking. tenantMiddleware
// runs on every request and calls s.DB.Conn.QueryRowContext unconditionally,
// so the server needs a live *sql.DB even when no real database is involved.
//
// ponytail: no new deps — database/sql + database/sql/driver from stdlib are
// enough; the driver intentionally implements none of the optional query
// interfaces, so QueryRowContext returns a driver-error (not a panic).
type fakeSQLDriver struct{}

func (fakeSQLDriver) Open(string) (driver.Conn, error) { return fakeConn{}, nil }

type fakeConn struct{}

func (fakeConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("fake driver") }
func (fakeConn) Close() error                        { return nil }
func (fakeConn) Begin() (driver.Tx, error)           { return nil, errors.New("fake driver") }

var fakeDriverOnce sync.Once

// fakeDB returns a *sql.DB backed by the fake driver; safe to call repeatedly.
func fakeDB() *sql.DB {
	fakeDriverOnce.Do(func() { sql.Register("fake-smoke", fakeSQLDriver{}) })
	db, _ := sql.Open("fake-smoke", "")
	return db
}

// newSmokeServer builds a Server with a fake *sql.DB and a mock auth that
// accepts any non-empty Bearer token. The fake DB lets tenantMiddleware pass
// (it logs a tenant-resolution error and continues) so handlers are reachable;
// handler-level DB calls then return errors, exercising their error paths.
func newSmokeServer(t *testing.T) *Server {
	t.Helper()
	return NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: fakeDB()})
}

// TestSmoke_Health verifies the public health endpoints respond 200 with a
// JSON status payload on both archive and v1 aliases.
func TestSmoke_Health(t *testing.T) {
	srv := newSmokeServer(t)
	cases := []struct {
		name, path, wantStatus string
	}{
		{"archive health", "/api/health", "ok"},
		{"v1 health", "/api/v1/health", "ok"},
		{"archive detailed", "/api/health/detailed", "ok"},
		{"v1 detailed", "/api/v1/health/detailed", "ok"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			srv.Router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, tc.path, nil))
			if w.Code != http.StatusOK {
				t.Fatalf("GET %s: want 200, got %d (body=%s)", tc.path, w.Code, w.Body.String())
			}
			var body map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatalf("GET %s: invalid JSON: %v (body=%s)", tc.path, err, w.Body.String())
			}
			if body["status"] != tc.wantStatus {
				t.Errorf("GET %s: status=%v want %q (body=%s)", tc.path, body["status"], tc.wantStatus, w.Body.String())
			}
		})
	}
}

// TestSmoke_AuthLimiterIsolated verifies public traffic cannot exhaust the
// separate registration/login limiter. The handler may fail against the fake DB,
// but it must not be rejected by the public bucket with HTTP 429.
func TestSmoke_AuthLimiterIsolated(t *testing.T) {
	srv := newSmokeServer(t)
	for i := 0; i < 120; i++ {
		w := httptest.NewRecorder()
		srv.Router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/health", nil))
	}

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(`{"email":"rate-isolation@example.com","password":"DockerSmokePass123!"}`))
	req.Header.Set("Content-Type", "application/json")
	srv.Router.ServeHTTP(w, req)
	if w.Code == http.StatusTooManyRequests {
		t.Fatalf("registration was starved by public traffic: got 429 (body=%s)", w.Body.String())
	}
}

// TestSmoke_Capabilities verifies the capabilities endpoint responds 200 with
// a JSON status payload on both archive and v1 aliases.
func TestSmoke_Capabilities(t *testing.T) {
	srv := newSmokeServer(t)
	for _, path := range []string{"/api/capabilities", "/api/v1/capabilities"} {
		w := httptest.NewRecorder()
		srv.Router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != http.StatusOK {
			t.Fatalf("GET %s: want 200, got %d (body=%s)", path, w.Code, w.Body.String())
		}
		var body map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("GET %s: invalid JSON: %v", path, err)
		}
		if body["status"] != "ok" {
			t.Fatalf("GET %s: want status ok, got %v", path, body["status"])
		}
	}
}

// TestSmoke_Provenance verifies provenance routes are registered and do not
// 404/500. Unauthenticated requests may return 200 or 401 depending on route
// configuration.
func TestSmoke_Provenance(t *testing.T) {
	srv := newSmokeServer(t)
	for _, path := range []string{"/api/v1/provenance/export", "/api/v1/provenance/artifacts"} {
		w := httptest.NewRecorder()
		srv.Router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		// Accept 200 or 401; smoke test only proves route is registered and does not 404/500.
		if w.Code != http.StatusOK && w.Code != http.StatusUnauthorized {
			t.Fatalf("GET %s: want 200 or 401, got %d (body=%s)", path, w.Code, w.Body.String())
		}
	}
}

// TestSmoke_Computer verifies computer routes are registered and behave within
// expected unauthenticated/auth boundaries (200, 401, or 403).
func TestSmoke_Computer(t *testing.T) {
	srv := newSmokeServer(t)
	for _, path := range []string{"/api/v1/computer/runs"} {
		w := httptest.NewRecorder()
		srv.Router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, path, nil))
		if w.Code != http.StatusOK && w.Code != http.StatusUnauthorized && w.Code != http.StatusForbidden {
			t.Fatalf("POST %s: want 200/401/403, got %d (body=%s)", path, w.Code, w.Body.String())
		}
	}
}

// TestSmoke_Profile checks the profile handler is wired behind auth on both
// prefixes: unauthenticated -> 401, authenticated -> 200 with a default
// profile (the fake DB returns an error, which handleGetProfile maps to an
// empty profile rather than 500 — proving the handler is reachable and auth
// passes).
func TestSmoke_Profile(t *testing.T) {
	srv := newSmokeServer(t)
	cases := []struct {
		name, path string
		token      string
		wantCode   int
	}{
		{"archive unauth", "/api/profile", "", http.StatusUnauthorized},
		{"v1 unauth", "/api/v1/profile", "", http.StatusUnauthorized},
		{"archive authed default-profile", "/api/profile", "tok", http.StatusOK},
		{"v1 authed default-profile", "/api/v1/profile", "tok", http.StatusOK},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			if tc.token != "" {
				req.Header.Set("Authorization", "Bearer "+tc.token)
			}
			w := httptest.NewRecorder()
			srv.Router.ServeHTTP(w, req)
			if w.Code != tc.wantCode {
				t.Fatalf("GET %s: want %d, got %d (body=%s)", tc.path, tc.wantCode, w.Code, w.Body.String())
			}
			if tc.token != "" {
				var body map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
					t.Fatalf("GET %s: invalid JSON: %v (body=%s)", tc.path, err, w.Body.String())
				}
				// ponytail: the fallback profile must mirror the success
				// schema — these keys must exist even on the error path.
				for _, key := range []string{"current_title", "target_level", "current_industry", "target_industry", "transition_type"} {
					if _, ok := body[key]; !ok {
						t.Errorf("GET %s: fallback profile missing key %q (body=%s)", tc.path, key, w.Body.String())
					}
				}
				if ct, ok := body["current_title"].(string); !ok || ct != "" {
					t.Errorf("GET %s: current_title=%v want \"\" (body=%s)", tc.path, body["current_title"], w.Body.String())
				}
			}
		})
	}
}

// TestSmoke_ResumeUpload checks the multipart resume-upload handler on both
// prefixes: unauth -> 401, authed missing "file" field -> 400, authed valid
// text file -> 500 (fake DB returns an error on the INSERT, which the handler
// maps to 500). The 400 path exercises the multipart parser without touching
// the DB, so it is a clean wiring check.
func TestSmoke_ResumeUpload(t *testing.T) {
	srv := newSmokeServer(t)

	multipartBody := func(t *testing.T, filename, content string) (*bytes.Buffer, string) {
		t.Helper()
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		fw, err := w.CreateFormFile("file", filename)
		if err != nil {
			t.Fatalf("create form file: %v", err)
		}
		_, _ = io.WriteString(fw, content)
		_ = w.Close()
		return &buf, w.FormDataContentType()
	}

	type reqCase struct {
		name, path string
		token      string
		body       *bytes.Buffer
		content    string
		wantCode   int
	}
	validBody, validCT := multipartBody(t, "resume.txt", "Jane Doe\nPython developer\n")
	cases := []reqCase{
		{"archive unauth", "/api/resumes/upload", "", nil, "", http.StatusUnauthorized},
		{"v1 unauth", "/api/v1/resumes/upload", "", nil, "", http.StatusUnauthorized},
		{"archive missing file field", "/api/resumes/upload", "tok", &bytes.Buffer{}, "application/json", http.StatusBadRequest},
		{"v1 missing file field", "/api/v1/resumes/upload", "tok", &bytes.Buffer{}, "application/json", http.StatusBadRequest},
		{"archive valid txt nil-db", "/api/resumes/upload", "tok", validBody, validCT, http.StatusInternalServerError},
		// ponytail: reuse same multipart body for v1 — bytes.Buffer is consumed
		// by the first POST, so rebuild for the second.
	}
	// Rebuild a fresh multipart body for the v1 valid case (the archive case
	// consumed the first buffer's bytes).
	v1Body, v1CT := multipartBody(t, "resume.txt", "Jane Doe\nPython developer\n")
	cases = append(cases, reqCase{"v1 valid txt nil-db", "/api/v1/resumes/upload", "tok", v1Body, v1CT, http.StatusInternalServerError})

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var req *http.Request
			if tc.body != nil {
				req = httptest.NewRequest(http.MethodPost, tc.path, tc.body)
				req.Header.Set("Content-Type", tc.content)
			} else {
				req = httptest.NewRequest(http.MethodPost, tc.path, strings.NewReader(""))
			}
			if tc.token != "" {
				req.Header.Set("Authorization", "Bearer "+tc.token)
			}
			w := httptest.NewRecorder()
			srv.Router.ServeHTTP(w, req)
			if w.Code != tc.wantCode {
				t.Fatalf("POST %s: want %d, got %d (body=%s)", tc.path, tc.wantCode, w.Code, w.Body.String())
			}
		})
	}
}
