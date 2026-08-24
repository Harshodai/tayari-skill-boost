package api

// routes_account_test.go — unit tests for handleDeleteAccount (DATA-006).
//
// Sandbox note: this test environment blocks outbound TCP connections even to
// localhost (EPERM on connect), so we cannot use httptest.Server for GoTrue or
// the AI engine. Instead:
//
//  - The AI purge gate (s.AI.PurgeUserRuntime) is bypassed by setting s.AI=nil
//    after construction — the handler guards with `if s.AI != nil`.
//  - GoTrue failure is simulated by pointing SupabaseURL at an unreachable host
//    ("http://192.0.2.1:1" — TEST-NET-1, RFC 5737) so deleteSupabaseUser
//    returns a network error, which is identical in behaviour to a GoTrue 5xx.
//  - GoTrue success is simulated by setting SupabaseServiceRoleKey="" so the
//    code path that calls deleteSupabaseUser is never entered; auth.users is
//    instead deleted in the cascade SQL transaction, which the fake DB handles.
//
// The three cases mirror the branching in handleDeleteAccount exactly:
//
//  1. Happy path (no GoTrue key) → cascade SQL succeeds → HTTP 200 "deleted"
//  2. GoTrue fails + SQL fallback succeeds → HTTP 200 "deleted"
//  3. GoTrue fails + SQL fallback also fails → must NOT be 2xx
//     (DATA-006 regression: previously returned 200 "deleted")

import (
	"archive/zip"
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/google/uuid"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
)

// ─── fake SQL driver that supports transactions ───────────────────────────────

// accountTx is a no-op transaction. ExecContext always succeeds so the cascade
// queries inside the tx pass without a real DB.
type accountTx struct{}

func (t *accountTx) Commit() error   { return nil }
func (t *accountTx) Rollback() error { return nil }
func (t *accountTx) ExecContext(_ context.Context, _ string, _ []driver.NamedValue) (driver.Result, error) {
	return accountFakeResult{}, nil
}

// accountFakeConn is the per-connection object. fallbackExecFails controls
// whether the post-commit ExecContext (the direct auth.users delete on the
// *sql.DB connection, not the tx) should fail.
type accountFakeConn struct {
	fallbackExecFails bool
}

func (accountFakeConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("account fake driver: no prepared statements")
}
func (accountFakeConn) Close() error { return nil }
func (c accountFakeConn) Begin() (driver.Tx, error) {
	return &accountTx{}, nil
}

// ExecContext handles the post-commit fallback:
//
//	s.DB.Conn.ExecContext(ctx, `DELETE FROM auth.users WHERE id=$1`, uid)
func (c accountFakeConn) ExecContext(_ context.Context, _ string, _ []driver.NamedValue) (driver.Result, error) {
	if c.fallbackExecFails {
		return nil, errors.New("account fake driver: auth.users delete failed")
	}
	return accountFakeResult{}, nil
}

type accountFakeResult struct{}

func (accountFakeResult) LastInsertId() (int64, error) { return 0, nil }
func (accountFakeResult) RowsAffected() (int64, error) { return 1, nil }

type accountFakeDriver struct{ fallbackFails bool }

func (d accountFakeDriver) Open(string) (driver.Conn, error) {
	return accountFakeConn{fallbackExecFails: d.fallbackFails}, nil
}

var (
	accountFakeDriverOnce sync.Once
	accountFakeFailOnce   sync.Once
)

// accountFakeDB returns a *sql.DB where the post-commit fallback ExecContext succeeds.
func accountFakeDB() *sql.DB {
	accountFakeDriverOnce.Do(func() {
		sql.Register("fake-account-ok", accountFakeDriver{fallbackFails: false})
	})
	db, _ := sql.Open("fake-account-ok", "")
	return db
}

// accountFakeDBFallbackFails returns a *sql.DB where the post-commit fallback
// ExecContext always errors, exercising the double-failure branch.
func accountFakeDBFallbackFails() *sql.DB {
	accountFakeFailOnce.Do(func() {
		sql.Register("fake-account-fail", accountFakeDriver{fallbackFails: true})
	})
	db, _ := sql.Open("fake-account-fail", "")
	return db
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// authedDeleteRequest builds a DELETE /api/v1/account request with the given
// user already in context, bypassing authMiddleware.
func authedDeleteRequest(user *models.User) *http.Request {
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/account", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	ctx := auth.WithUserContext(req.Context(), user)
	return req.WithContext(ctx)
}

// newAccountServerNoAI builds a minimal Server and sets s.AI = nil so the
// PurgeUserRuntime gate is skipped (the handler guards with `if s.AI != nil`).
func newAccountServerNoAI(t *testing.T, db *sql.DB, supabaseURL, serviceRoleKey string) *Server {
	t.Helper()
	cfg := &config.Config{
		SupabaseURL:            supabaseURL,
		SupabaseServiceRoleKey: serviceRoleKey,
	}
	srv := NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: db})
	srv.AI = nil // bypass AI purge gate (no Python service in unit tests)
	return srv
}

// unreachableGoTrueURL returns a URL that will always produce a network error
// without blocking (TEST-NET-1 per RFC 5737 — guaranteed non-routable).
const unreachableGoTrueURL = "http://192.0.2.1:1"

// ─── tests ───────────────────────────────────────────────────────────────────

// TestDeleteAccount_HappyPath_NoGoTrue exercises the path where
// SupabaseServiceRoleKey is empty: no GoTrue call is made, auth.users is
// deleted inside the cascade SQL transaction, and the handler returns
// HTTP 200 {"status":"deleted"}.
//
// This is the happy path for self-hosted / no-GoTrue deployments and also
// serves as the positive control for the other tests.
func TestDeleteAccount_HappyPath_NoGoTrue(t *testing.T) {
	user := &models.User{ID: uuid.New(), Email: "delete-me@example.com"}
	// Empty service role key → SupabaseServiceRoleKey="" → no GoTrue call.
	srv := newAccountServerNoAI(t, accountFakeDB(), "", "")

	w := httptest.NewRecorder()
	srv.Router.ServeHTTP(w, authedDeleteRequest(user))

	if w.Code != http.StatusOK {
		t.Fatalf("happy path: want 200, got %d (body=%s)", w.Code, w.Body.String())
	}
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("happy path: invalid JSON: %v (body=%s)", err, w.Body.String())
	}
	if body["status"] != "deleted" {
		t.Errorf("happy path: want status=deleted, got %q (body=%s)", body["status"], w.Body.String())
	}
}

// TestDeleteAccount_GoTrueFails_FallbackSucceeds: GoTrue returns an error
// (unreachable host) but the direct SQL fallback (DELETE FROM auth.users)
// succeeds. The auth user IS gone → handler returns HTTP 200 {"status":"deleted"}.
func TestDeleteAccount_GoTrueFails_FallbackSucceeds(t *testing.T) {
	user := &models.User{ID: uuid.New(), Email: "delete-me@example.com"}
	// serviceRoleKey non-empty → GoTrue path is attempted.
	// unreachableGoTrueURL guarantees deleteSupabaseUser fails immediately.
	// accountFakeDB has fallbackExecFails=false → direct SQL delete succeeds.
	srv := newAccountServerNoAI(t, accountFakeDB(), unreachableGoTrueURL, "service-role-key")

	w := httptest.NewRecorder()
	srv.Router.ServeHTTP(w, authedDeleteRequest(user))

	if w.Code != http.StatusOK {
		t.Fatalf("fallback-ok path: want 200, got %d (body=%s)", w.Code, w.Body.String())
	}
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("fallback-ok path: invalid JSON: %v (body=%s)", err, w.Body.String())
	}
	if body["status"] != "deleted" {
		t.Errorf("fallback-ok path: want status=deleted, got %q (body=%s)", body["status"], w.Body.String())
	}
}

// TestDeleteAccount_BothFail_MustNotReturn200 is the DATA-006 regression test.
//
// GoTrue is unreachable (network error) AND the direct SQL fallback also fails.
// The auth identity is NOT revoked. The handler must NOT return HTTP 2xx with
// {"status":"deleted"}.
//
// Before the fix: both failure paths fell through to the 200 "deleted" response,
// telling the user their account was deleted when their sign-in access still
// existed.
func TestDeleteAccount_BothFail_MustNotReturn200(t *testing.T) {
	user := &models.User{ID: uuid.New(), Email: "delete-me@example.com"}
	// accountFakeDBFallbackFails: direct auth.users delete also fails.
	srv := newAccountServerNoAI(t, accountFakeDBFallbackFails(), unreachableGoTrueURL, "service-role-key")

	w := httptest.NewRecorder()
	srv.Router.ServeHTTP(w, authedDeleteRequest(user))

	if w.Code >= 200 && w.Code < 300 {
		t.Fatalf("DATA-006 regression: double-failure path returned 2xx (%d), body=%s; "+
			"a user was told their account is deleted when it was not", w.Code, w.Body.String())
	}

	// The response body status must not be "deleted".
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err == nil {
		if body["status"] == "deleted" {
			t.Errorf("DATA-006 regression: body.status is \"deleted\" on double-failure path "+
				"(body=%s)", w.Body.String())
		}
	}
}

// TestDeleteAccount_Unauthenticated: no auth → 401.
func TestDeleteAccount_Unauthenticated(t *testing.T) {
	srv := newAccountServerNoAI(t, accountFakeDB(), "", "")
	w := httptest.NewRecorder()
	srv.Router.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/api/v1/account", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauth: want 401, got %d (body=%s)", w.Code, w.Body.String())
	}
}

// ─── DATA-007: export manifest tests ─────────────────────────────────────────
//
// The export tests verify that handleExportAccount:
//   1. Surfaces query failures in manifest.json (not silently as [])
//   2. Sets X-Export-Status: partial when any category failed
//   3. Sets X-Export-Status: complete when all categories succeed
//   4. Requires authentication
//
// DB-layer note: the existing accountFakeConn only implements ExecContext and
// Begin (for handleDeleteAccount). QueryRowContext / QueryContext calls fall
// through to Prepare() which returns an error — meaning every exportJSONRows
// call will fail. This is the intended behaviour for TestExportAccount_QueryFailure_NotSilent.
//
// For TestExportAccount_AllSuccess we need a driver that returns valid JSON for
// every QueryRowContext call, so we register a separate driver that implements
// driver.QueryerContext returning `[]` for every query.

// exportSuccessRows is a minimal driver.Rows that returns a single column
// with value `[]` (valid empty JSON array) and then io.EOF.
type exportSuccessRows struct {
	done bool
}

func (r *exportSuccessRows) Columns() []string                   { return []string{"json_agg"} }
func (r *exportSuccessRows) Close() error                        { return nil }
func (r *exportSuccessRows) Next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	r.done = true
	dest[0] = []byte("[]")
	return nil
}

// exportSuccessConn returns [] for every query and succeeds on every Exec.
type exportSuccessConn struct{}

func (exportSuccessConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("export success driver: no prepared statements")
}
func (exportSuccessConn) Close() error { return nil }
func (exportSuccessConn) Begin() (driver.Tx, error) {
	return &accountTx{}, nil
}
func (exportSuccessConn) ExecContext(_ context.Context, _ string, _ []driver.NamedValue) (driver.Result, error) {
	return accountFakeResult{}, nil
}
func (exportSuccessConn) QueryContext(_ context.Context, _ string, _ []driver.NamedValue) (driver.Rows, error) {
	return &exportSuccessRows{}, nil
}

type exportSuccessDriver struct{}

func (exportSuccessDriver) Open(string) (driver.Conn, error) {
	return exportSuccessConn{}, nil
}

var exportSuccessDriverOnce sync.Once

func exportSuccessDB() *sql.DB {
	exportSuccessDriverOnce.Do(func() {
		sql.Register("fake-export-success", exportSuccessDriver{})
	})
	db, _ := sql.Open("fake-export-success", "")
	return db
}

// authedExportRequest builds a GET /api/v1/account/export request with the
// user injected into context, bypassing authMiddleware.
func authedExportRequest(user *models.User) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/account/export", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	ctx := auth.WithUserContext(req.Context(), user)
	return req.WithContext(ctx)
}

// TestExportAccount_QueryFailure_NotSilent is the DATA-007 regression test.
//
// With the old exportJSONRows that returned json.RawMessage (no error), a
// failed DB query was silently substituted with [] and the export looked
// complete. This test verifies:
//   - The ZIP contains manifest.json
//   - manifest.json marks at least one category as "error"
//   - The overall_status in manifest.json is NOT "complete"
//   - The X-Export-Status response header is "partial" (not "complete")
//   - The HTTP status is still 200 (partial export is downloadable)
//
// The accountFakeDB driver's Prepare() always returns an error, so every
// QueryRowContext / QueryContext call fails — all categories will be "error".
func TestExportAccount_QueryFailure_NotSilent(t *testing.T) {
	user := &models.User{ID: uuid.New(), Email: "export-test@example.com"}
	// accountFakeDB: Prepare returns error → every query fails.
	srv := newAccountServerNoAI(t, accountFakeDB(), "", "")

	w := httptest.NewRecorder()
	srv.Router.ServeHTTP(w, authedExportRequest(user))

	if w.Code != http.StatusOK {
		t.Fatalf("DATA-007: query-failure export: want 200, got %d (body=%s)", w.Code, w.Body.String())
	}

	// The X-Export-Status header must be "partial", not "complete".
	exportStatus := w.Header().Get("X-Export-Status")
	if exportStatus == "complete" {
		t.Fatalf("DATA-007 regression: X-Export-Status is %q on all-failure export; "+
			"partial exports must NOT claim to be complete", exportStatus)
	}
	if exportStatus != "partial" {
		t.Errorf("DATA-007: X-Export-Status: want %q, got %q", "partial", exportStatus)
	}

	// The response body must be a valid ZIP containing manifest.json.
	body := w.Body.Bytes()
	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatalf("DATA-007: response is not a valid ZIP: %v", err)
	}

	var manifestFile *zip.File
	for _, f := range zr.File {
		if f.Name == "manifest.json" {
			manifestFile = f
			break
		}
	}
	if manifestFile == nil {
		t.Fatal("DATA-007: manifest.json missing from export ZIP")
	}

	rc, err := manifestFile.Open()
	if err != nil {
		t.Fatalf("DATA-007: cannot open manifest.json: %v", err)
	}
	defer rc.Close()

	var manifest struct {
		OverallStatus string `json:"overall_status"`
		Categories    []struct {
			Name   string `json:"name"`
			Status string `json:"status"`
			Error  string `json:"error"`
		} `json:"categories"`
	}
	if err := json.NewDecoder(rc).Decode(&manifest); err != nil {
		t.Fatalf("DATA-007: manifest.json is not valid JSON: %v", err)
	}

	if manifest.OverallStatus == "complete" {
		t.Errorf("DATA-007 regression: manifest.overall_status=%q on all-failure export; "+
			"must be \"partial\" or \"error\"", manifest.OverallStatus)
	}

	// At least one category must have status "error" with a non-empty error message.
	errorCount := 0
	for _, cat := range manifest.Categories {
		if cat.Status == "error" {
			errorCount++
			if cat.Error == "" {
				t.Errorf("DATA-007: category %q has status=error but empty error field", cat.Name)
			}
		}
	}
	if errorCount == 0 {
		t.Errorf("DATA-007: manifest has no error categories despite all DB queries failing")
	}
}

// TestExportAccount_AllSuccess verifies that when all categories succeed the
// manifest.json shows overall_status="complete", every category has status="ok",
// and the X-Export-Status header is "complete".
func TestExportAccount_AllSuccess(t *testing.T) {
	user := &models.User{ID: uuid.New(), Email: "export-success@example.com"}
	srv := newAccountServerNoAI(t, exportSuccessDB(), "", "")

	w := httptest.NewRecorder()
	srv.Router.ServeHTTP(w, authedExportRequest(user))

	if w.Code != http.StatusOK {
		t.Fatalf("all-success export: want 200, got %d (body=%s)", w.Code, w.Body.String())
	}

	exportStatus := w.Header().Get("X-Export-Status")
	if exportStatus != "complete" {
		t.Errorf("all-success export: X-Export-Status: want %q, got %q", "complete", exportStatus)
	}

	body := w.Body.Bytes()
	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatalf("all-success export: response is not a valid ZIP: %v", err)
	}

	var manifestFile *zip.File
	for _, f := range zr.File {
		if f.Name == "manifest.json" {
			manifestFile = f
			break
		}
	}
	if manifestFile == nil {
		t.Fatal("all-success export: manifest.json missing from export ZIP")
	}

	rc, err := manifestFile.Open()
	if err != nil {
		t.Fatalf("all-success export: cannot open manifest.json: %v", err)
	}
	defer rc.Close()

	var manifest struct {
		OverallStatus string `json:"overall_status"`
		Categories    []struct {
			Name   string `json:"name"`
			Status string `json:"status"`
		} `json:"categories"`
	}
	if err := json.NewDecoder(rc).Decode(&manifest); err != nil {
		t.Fatalf("all-success export: manifest.json is not valid JSON: %v", err)
	}

	if manifest.OverallStatus != "complete" {
		t.Errorf("all-success export: manifest.overall_status=%q, want \"complete\"", manifest.OverallStatus)
	}
	for _, cat := range manifest.Categories {
		if cat.Status != "ok" {
			t.Errorf("all-success export: category %q has status=%q, want \"ok\"", cat.Name, cat.Status)
		}
	}
}

// TestExportAccount_Unauthenticated: no auth on export endpoint → 401.
func TestExportAccount_Unauthenticated(t *testing.T) {
	srv := newAccountServerNoAI(t, accountFakeDB(), "", "")
	w := httptest.NewRecorder()
	srv.Router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/account/export", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("export unauth: want 401, got %d (body=%s)", w.Code, w.Body.String())
	}
}

