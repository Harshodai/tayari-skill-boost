package api

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func TestJobDescriptionImport_ValidatesAndForwardsURL(t *testing.T) {
	called := 0
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called++
		if r.Method != http.MethodPost || r.URL.Path != "/api/v1/job-descriptions/import" {
			t.Fatalf("unexpected upstream request: %s %s", r.Method, r.URL.Path)
		}
		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode upstream body: %v", err)
		}
		if payload["url"] != "https://jobs.example.com/role" {
			t.Fatalf("unexpected URL payload: %#v", payload)
		}
		_, _ = io.WriteString(w, `{"url":"https://jobs.example.com/role","title":"Backend Engineer","job_description":"Build reliable systems."}`)
	})
	defer upstream.Close()

	server := newHermesServer(t, upstream.URL)
	for _, path := range []string{"/api/v1/job-descriptions/import", "/api/job-descriptions/import"} {
		w := httptest.NewRecorder()
		server.Router.ServeHTTP(w, authReq(http.MethodPost, path, []byte(`{"url":" https://jobs.example.com/role "}`)))
		if w.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d: %s", path, w.Code, w.Body.String())
		}
	}

	if called != 2 {
		t.Fatalf("expected both import routes to be forwarded to Python, got %d calls", called)
	}
}

func TestJobDescriptionImport_RejectsMalformedOrBlankRequests(t *testing.T) {
	server := newHermesServer(t, "http://127.0.0.1:1")
	for _, body := range [][]byte{[]byte(`{`), []byte(`{"url":"   "}`)} {
		w := httptest.NewRecorder()
		server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/job-descriptions/import", body))
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
		}
	}
}

func TestAnalyzeText_RejectsMissingInputsInsteadOfUsingFallbacks(t *testing.T) {
	server := newHermesServer(t, "http://127.0.0.1:1")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/analyze", []byte(`{}`)))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	var response map[string]string
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response["error"] == "" {
		t.Fatal("expected a clear missing-input error")
	}
}

func TestAnalyzeText_ForwardsCustomInstructions(t *testing.T) {
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode upstream body: %v", err)
		}
		if payload["custom_instructions"] != "Prioritize leadership impact." {
			t.Fatalf("custom instructions were not forwarded: %#v", payload)
		}
		_, _ = io.WriteString(w, `{}`)
	})
	defer upstream.Close()

	server := newHermesServer(t, upstream.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/analyze", []byte(`{
        "resume_text":"Experienced backend engineer.",
        "job_description":"Build distributed systems.",
        "custom_instructions":"Prioritize leadership impact."
    }`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

// -------------------------------------------------------------------
// handleOptimizeResume field forwarding
// -------------------------------------------------------------------

// optimizeResumeFakeConn is a stdlib-only driver stub that answers the
// handler's resume lookup with a canned original_text row and errors on
// every other statement. Like fakeSQLDriver (handlers_smoke_test.go) it
// keeps the suite dependency-free; it only implements the query surface
// handleOptimizeResume actually touches.
type optimizeResumeFakeConn struct{}

func (optimizeResumeFakeConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("fake driver")
}
func (optimizeResumeFakeConn) Close() error { return nil }
func (optimizeResumeFakeConn) Begin() (driver.Tx, error) {
	return nil, errors.New("fake driver")
}

func (c optimizeResumeFakeConn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if strings.Contains(query, "SELECT original_text FROM resumes") {
		return newOptimizeResumeFakeRows(), nil
	}
	return nil, errors.New("fake driver: unexpected query")
}

func (optimizeResumeFakeConn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	// Update/insert statements after a successful optimization are best-effort;
	// the handler tolerates their failure (it only logs), so erroring is fine.
	return nil, errors.New("fake driver")
}

// optimizeResumeFakeRows yields a single row containing the resume text.
type optimizeResumeFakeRows struct {
	done bool
}

func newOptimizeResumeFakeRows() *optimizeResumeFakeRows { return &optimizeResumeFakeRows{} }

func (r *optimizeResumeFakeRows) Columns() []string { return []string{"original_text"} }
func (r *optimizeResumeFakeRows) Close() error      { return nil }
func (r *optimizeResumeFakeRows) Next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	r.done = true
	dest[0] = "Experienced backend engineer."
	return nil
}

var optimizeResumeFakeDriverOnce sync.Once

// optimizeResumeFakeDB returns a *sql.DB backed by the canned-row driver.
func optimizeResumeFakeDB() *sql.DB {
	optimizeResumeFakeDriverOnce.Do(func() {
		sql.Register("fake-optimize-resume", optimizeResumeFakeDriver{})
	})
	db, _ := sql.Open("fake-optimize-resume", "")
	return db
}

type optimizeResumeFakeDriver struct{}

func (optimizeResumeFakeDriver) Open(string) (driver.Conn, error) {
	return optimizeResumeFakeConn{}, nil
}

// TestOptimizeResumeForwardsCustomInstructions verifies the Go gateway accepts
// custom_instructions, target_role, and jd_url on the optimize request and
// forwards all of them to the Python engine, not just job_description.
func TestOptimizeResumeForwardsCustomInstructions(t *testing.T) {
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/optimizer/optimize" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode upstream body: %v", err)
		}
		if payload["custom_instructions"] != "Prioritize leadership impact." {
			t.Fatalf("custom_instructions not forwarded: %#v", payload)
		}
		if payload["target_role"] != "Senior Engineer" {
			t.Fatalf("target_role not forwarded: %#v", payload)
		}
		if payload["jd_url"] != "https://boards.greenhouse.io/example" {
			t.Fatalf("jd_url not forwarded: %#v", payload)
		}
		if payload["job_description"] != "Build distributed systems." {
			t.Fatalf("job_description not forwarded: %#v", payload)
		}
		if payload["resume_text"] != "Experienced backend engineer." {
			t.Fatalf("resume_text not forwarded from DB row: %#v", payload)
		}
		_, _ = io.WriteString(w, `{"optimized_text":"Optimized resume text."}`)
	})
	defer upstream.Close()

	server := NewServer(&hermesMockAuth{}, &config.Config{PythonAIURL: upstream.URL}, &database.DB{Conn: optimizeResumeFakeDB()})
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/resumes/42/optimize", []byte(`{
        "job_description":"Build distributed systems.",
        "custom_instructions":"Prioritize leadership impact.",
        "target_role":"Senior Engineer",
        "jd_url":"https://boards.greenhouse.io/example"
    }`)))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["optimized_text"] != "Optimized resume text." {
		t.Fatalf("expected passthrough body, got %s", w.Body.String())
	}
}

// TestOptimizeResume_RejectsMalformedBodyButAcceptsEmptyBody verifies the
// handler 400s on any non-empty-body decode/validation error instead of
// optimizing with a half-decoded request, while an empty body (JD optional)
// still succeeds.
func TestOptimizeResume_RejectsMalformedBodyButAcceptsEmptyBody(t *testing.T) {
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/optimizer/optimize" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		_, _ = io.WriteString(w, `{"optimized_text":"Optimized resume text."}`)
	})
	defer upstream.Close()

	server := NewServer(&hermesMockAuth{}, &config.Config{PythonAIURL: upstream.URL}, &database.DB{Conn: optimizeResumeFakeDB()})

	// Invalid JSON body -> 400, no upstream call.
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/resumes/42/optimize", []byte(`{`)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("malformed body: expected 400, got %d: %s", w.Code, w.Body.String())
	}

	// Empty body (JSON decode hits io.EOF) -> 200, upstream returns
	// optimized_text which the handler passes through.
	w = httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/resumes/42/optimize", []byte(``)))
	if w.Code != http.StatusOK {
		t.Fatalf("empty body: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp["optimized_text"] != "Optimized resume text." {
		t.Fatalf("expected passthrough body, got %s", w.Body.String())
	}
}
