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
	"time"

	"github.com/google/uuid"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
)

// Global test fixture IDs
var (
	testUserA = &models.User{ID: uuid.MustParse("11111111-1111-1111-1111-111111111111"), Email: "user-a@example.com"}
	testUserB = &models.User{ID: uuid.MustParse("22222222-2222-2222-2222-222222222222"), Email: "user-b@example.com"}
	appOwnedByB = uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
)

// --- Fake SQL Driver for Two-User Negative Testing ---

type twoUserFakeConn struct{}

func (twoUserFakeConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("two-user fake driver: no prepared statements")
}
func (twoUserFakeConn) Close() error { return nil }
func (twoUserFakeConn) Begin() (driver.Tx, error) {
	return &accountTx{}, nil
}

func extractArgStr(v interface{}) string {
	switch val := v.(type) {
	case uuid.UUID:
		return val.String()
	case string:
		return val
	case []byte:
		return string(val)
	default:
		return ""
	}
}

func extractAppAndUserArgs(args []driver.NamedValue) (appIDStr, uidStr string) {
	if len(args) == 0 {
		return "", ""
	}
	arg0 := extractArgStr(args[0].Value)
	if len(args) == 1 {
		return arg0, ""
	}
	arg1 := extractArgStr(args[1].Value)

	if arg0 == testUserA.ID.String() || arg0 == testUserB.ID.String() {
		return arg1, arg0
	}
	return arg0, arg1
}

func unwrapParens(s string) string {
	s = strings.TrimSpace(s)
	for strings.HasPrefix(s, "(") && strings.HasSuffix(s, ")") {
		depth := 0
		matched := false
		for i := 0; i < len(s); i++ {
			if s[i] == '(' {
				depth++
			} else if s[i] == ')' {
				depth--
				if depth == 0 {
					matched = (i == len(s)-1)
					break
				}
			}
		}
		if matched {
			s = strings.TrimSpace(s[1 : len(s)-1])
		} else {
			break
		}
	}
	return s
}

func hasTopLevelToken(s, token string) bool {
	depth := 0
	lower := strings.ToLower(s)
	tokenLower := strings.ToLower(token)
	tLen := len(tokenLower)

	for i := 0; i < len(lower); i++ {
		if lower[i] == '(' {
			depth++
		} else if lower[i] == ')' {
			depth--
		} else if depth == 0 && i+tLen <= len(lower) && lower[i:i+tLen] == tokenLower {
			beforeOk := i == 0 || lower[i-1] == ' ' || lower[i-1] == ')' || lower[i-1] == '\t' || lower[i-1] == '\n'
			afterOk := i+tLen == len(lower) || lower[i+tLen] == ' ' || lower[i+tLen] == '(' || lower[i+tLen] == '\t' || lower[i+tLen] == '\n'
			if beforeOk && afterOk {
				return true
			}
		}
	}
	return false
}

func splitTopLevel(s, token string) []string {
	var parts []string
	depth := 0
	lower := strings.ToLower(s)
	tokenLower := strings.ToLower(token)
	tLen := len(tokenLower)
	lastIdx := 0

	for i := 0; i < len(lower); i++ {
		if lower[i] == '(' {
			depth++
		} else if lower[i] == ')' {
			depth--
		} else if depth == 0 && i+tLen <= len(lower) && lower[i:i+tLen] == tokenLower {
			beforeOk := i == 0 || lower[i-1] == ' ' || lower[i-1] == ')' || lower[i-1] == '\t' || lower[i-1] == '\n'
			afterOk := i+tLen == len(lower) || lower[i+tLen] == ' ' || lower[i+tLen] == '(' || lower[i+tLen] == '\t' || lower[i+tLen] == '\n'
			if beforeOk && afterOk {
				part := strings.TrimSpace(s[lastIdx:i])
				if part != "" {
					parts = append(parts, part)
				}
				i += tLen
				lastIdx = i
			}
		}
	}
	if lastIdx < len(s) {
		part := strings.TrimSpace(s[lastIdx:])
		if part != "" {
			parts = append(parts, part)
		}
	}
	return parts
}

// isStrictOwnershipQuery verifies that the SQL query enforces tenant ownership
// by strictly combining the application identifier predicate and the user_id
// predicate with AND, and rejecting queries that combine them with OR or lack
// either predicate.
func isStrictOwnershipQuery(query string) bool {
	lower := strings.ToLower(query)
	whereIdx := strings.Index(lower, "where ")
	if whereIdx == -1 {
		return false
	}
	whereClause := strings.TrimSpace(lower[whereIdx+len("where "):])
	for _, clause := range []string{" order by", " group by", " limit", " having"} {
		if idx := strings.Index(whereClause, clause); idx != -1 {
			whereClause = strings.TrimSpace(whereClause[:idx])
		}
	}

	if !strings.Contains(whereClause, "user_id") || !strings.Contains(whereClause, "application_id") {
		return false
	}

	conjuncts := splitTopLevel(whereClause, "and")
	if len(conjuncts) < 2 {
		return false
	}

	hasAppID := false
	hasUserID := false

	for _, c := range conjuncts {
		c = strings.TrimSpace(c)
		if hasTopLevelToken(c, "or") {
			return false
		}
		inner := unwrapParens(c)
		if strings.Contains(inner, "user_id") {
			if hasTopLevelToken(inner, "or") {
				return false
			}
		}
		if strings.Contains(c, "application_id") {
			hasAppID = true
		}
		if strings.Contains(c, "user_id") {
			hasUserID = true
		}
	}

	return hasAppID && hasUserID
}

// isOROwnershipQuery checks if a query contains both application_id and user_id
// but combines them insecurely with OR instead of requiring a strict AND.
func isOROwnershipQuery(query string) bool {
	lower := strings.ToLower(query)
	whereIdx := strings.Index(lower, "where ")
	if whereIdx == -1 {
		return false
	}
	whereClause := strings.TrimSpace(lower[whereIdx+len("where "):])
	if !strings.Contains(whereClause, "user_id") || !strings.Contains(whereClause, "application_id") {
		return false
	}
	return !isStrictOwnershipQuery(query)
}

func (twoUserFakeConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if strings.Contains(query, "tenants") {
		return &twoUserEmptyRows{}, nil
	}

	appIDStr, uidStr := extractAppAndUserArgs(args)

	// If the query insecurely combines application_id and user_id with OR,
	// simulate real SQL behavior: a row owned by User B matches if either
	// application_id or user_id matches. In a two-user negative test where User A
	// requests User B's application ID, this returns User B's row (causing the test to fail
	// with HTTP 200 instead of 404), rejecting OR-based queries.
	if isOROwnershipQuery(query) {
		if appIDStr == appOwnedByB.String() || uidStr == testUserB.ID.String() {
			return &twoUserFakeRows{
				cols: []string{
					"id", "application_id", "run_id", "job", "tailored_resume_text",
					"cover_letter", "changes", "keywords_added", "ats_score_before",
					"ats_score_after", "is_dream_company", "status", "submission_mode",
					"apply_url", "created_at", "updated_at",
				},
				done: false,
			}, nil
		}
		return &twoUserEmptyRows{}, nil
	}

	// Strict SQL expectation: requires application_id and user_id predicates
	// to be combined with AND, while validating the expected owner and application arguments.
	if isStrictOwnershipQuery(query) && len(args) >= 2 {
		if uidStr == testUserB.ID.String() && appIDStr == appOwnedByB.String() {
			return &twoUserFakeRows{
				cols: []string{
					"id", "application_id", "run_id", "job", "tailored_resume_text",
					"cover_letter", "changes", "keywords_added", "ats_score_before",
					"ats_score_after", "is_dream_company", "status", "submission_mode",
					"apply_url", "created_at", "updated_at",
				},
				done: false,
			}, nil
		}
	}
	return &twoUserEmptyRows{}, nil
}

func (twoUserFakeConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	if strings.Contains(query, "tenants") {
		return twoUserResult{rowsAffected: 0}, nil
	}

	appIDStr, uidStr := extractAppAndUserArgs(args)

	// Insecure OR query: simulate real SQL OR behavior to reject OR-based deletion
	if isOROwnershipQuery(query) {
		if appIDStr == appOwnedByB.String() || uidStr == testUserB.ID.String() {
			return twoUserResult{rowsAffected: 1}, nil
		}
		return twoUserResult{rowsAffected: 0}, nil
	}

	// Strict SQL expectation: requires application_id and user_id predicates
	// to be combined with AND, while validating the expected owner and application arguments.
	if isStrictOwnershipQuery(query) && len(args) >= 2 {
		if uidStr == testUserB.ID.String() && appIDStr == appOwnedByB.String() {
			return twoUserResult{rowsAffected: 1}, nil
		}
	}
	return twoUserResult{rowsAffected: 0}, nil
}

type twoUserResult struct {
	rowsAffected int64
}

func (r twoUserResult) LastInsertId() (int64, error) { return 0, nil }
func (r twoUserResult) RowsAffected() (int64, error) { return r.rowsAffected, nil }

type twoUserSingleValueRows struct {
	val  string
	done bool
}

func (r *twoUserSingleValueRows) Columns() []string { return []string{"id"} }
func (r *twoUserSingleValueRows) Close() error      { return nil }
func (r *twoUserSingleValueRows) Next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	r.done = true
	dest[0] = r.val
	return nil
}

type twoUserEmptyRows struct{}

func (twoUserEmptyRows) Columns() []string              { return []string{"id"} }
func (twoUserEmptyRows) Close() error                   { return nil }
func (twoUserEmptyRows) Next([]driver.Value) error      { return io.EOF }

type twoUserFakeRows struct {
	cols []string
	done bool
}

func (r *twoUserFakeRows) Columns() []string { return r.cols }
func (r *twoUserFakeRows) Close() error      { return nil }
func (r *twoUserFakeRows) Next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	r.done = true
	now := time.Now()
	// 16 columns matching handleGetApplication
	dest[0] = int64(1)
	dest[1] = appOwnedByB.String()
	dest[2] = "run-123"
	dest[3] = `{"title":"Staff Engineer"}`
	dest[4] = "Tailored text"
	dest[5] = "Cover letter text"
	dest[6] = `{}`
	dest[7] = `[]`
	dest[8] = 75
	dest[9] = 92
	dest[10] = false
	dest[11] = "review"
	dest[12] = "manual"
	dest[13] = "https://example.com/apply"
	dest[14] = now
	dest[15] = now
	return nil
}

type twoUserFakeDriver struct{}

func (twoUserFakeDriver) Open(string) (driver.Conn, error) {
	return twoUserFakeConn{}, nil
}

var twoUserDriverOnce sync.Once

func twoUserFakeDB() *sql.DB {
	twoUserDriverOnce.Do(func() {
		sql.Register("two-user-fake-driver", twoUserFakeDriver{})
	})
	db, _ := sql.Open("two-user-fake-driver", "")
	return db
}

type twoUserMockAuth struct{}

func (m *twoUserMockAuth) VerifyToken(token string) (*models.User, error) {
	switch token {
	case "token-a":
		return testUserA, nil
	case "token-b":
		return testUserB, nil
	default:
		return nil, errors.New("invalid token")
	}
}
func (m *twoUserMockAuth) Login(ctx context.Context, email, password string) (string, error) {
	return "tok", nil
}
func (m *twoUserMockAuth) Register(ctx context.Context, email, password string) (*models.User, error) {
	return testUserA, nil
}
func (m *twoUserMockAuth) SocialLogin(w http.ResponseWriter, r *http.Request)    {}
func (m *twoUserMockAuth) SocialCallback(w http.ResponseWriter, r *http.Request) {}

func newTwoUserTestServer(t *testing.T) *Server {
	t.Helper()
	cfg := &config.Config{
		SupabaseURL:            "http://127.0.0.1:8000",
		SupabaseKey:            "anon-key",
		SupabaseServiceRoleKey: "",
		JWTSecret:              "test-secret",
	}
	srv := NewServer(&twoUserMockAuth{}, cfg, &database.DB{Conn: twoUserFakeDB()})
	srv.AI = nil // bypass AI proxy
	return srv
}

// ─── Tests ───────────────────────────────────────────────────────────────────

func TestTwoUserIsolation_GetApplicationNegative(t *testing.T) {
	srv := newTwoUserTestServer(t)
	path := "/api/v1/applications/" + appOwnedByB.String()

	// 1. User A (attacker/other user) tries to get User B's application
	reqA := httptest.NewRequest(http.MethodGet, path, nil)
	reqA.Header.Set("Authorization", "Bearer token-a")
	reqA = reqA.WithContext(auth.WithUserContext(reqA.Context(), testUserA))
	wA := httptest.NewRecorder()

	srv.Router.ServeHTTP(wA, reqA)

	if wA.Code != http.StatusNotFound {
		t.Fatalf("User A reading User B's application: want 404 Not Found, got %d (body=%s)", wA.Code, wA.Body.String())
	}

	// 2. User B (legitimate owner) fetches the same application
	reqB := httptest.NewRequest(http.MethodGet, path, nil)
	reqB.Header.Set("Authorization", "Bearer token-b")
	reqB = reqB.WithContext(auth.WithUserContext(reqB.Context(), testUserB))
	wB := httptest.NewRecorder()

	srv.Router.ServeHTTP(wB, reqB)

	if wB.Code != http.StatusOK {
		t.Fatalf("User B reading own application: want 200 OK, got %d (body=%s)", wB.Code, wB.Body.String())
	}

	var app models.Application
	if err := json.Unmarshal(wB.Body.Bytes(), &app); err != nil {
		t.Fatalf("Invalid JSON response for User B: %v", err)
	}
	if app.ApplicationID != appOwnedByB.String() {
		t.Fatalf("Unexpected application ID returned: %s", app.ApplicationID)
	}

	// 3. User B querying an application ID that does not exist or belongs to another -> must fail with 404
	unownedPath := "/api/v1/applications/" + uuid.New().String()
	reqBUnowned := httptest.NewRequest(http.MethodGet, unownedPath, nil)
	reqBUnowned.Header.Set("Authorization", "Bearer token-b")
	reqBUnowned = reqBUnowned.WithContext(auth.WithUserContext(reqBUnowned.Context(), testUserB))
	wBUnowned := httptest.NewRecorder()

	srv.Router.ServeHTTP(wBUnowned, reqBUnowned)

	if wBUnowned.Code != http.StatusNotFound {
		t.Fatalf("User B reading unowned application: want 404 Not Found, got %d (body=%s)", wBUnowned.Code, wBUnowned.Body.String())
	}
}

func TestTwoUserIsolation_DeleteApplicationNegative(t *testing.T) {
	srv := newTwoUserTestServer(t)
	path := "/api/v1/applications/" + appOwnedByB.String()

	// 1. User A tries to delete User B's application -> must fail with 404 (0 rows affected)
	reqA := httptest.NewRequest(http.MethodDelete, path, nil)
	reqA.Header.Set("Authorization", "Bearer token-a")
	reqA = reqA.WithContext(auth.WithUserContext(reqA.Context(), testUserA))
	wA := httptest.NewRecorder()

	srv.Router.ServeHTTP(wA, reqA)

	if wA.Code != http.StatusNotFound {
		t.Fatalf("User A deleting User B's application: want 404 Not Found, got %d (body=%s)", wA.Code, wA.Body.String())
	}

	// 2. User B deletes their own application -> succeeds with 200 OK
	reqB := httptest.NewRequest(http.MethodDelete, path, nil)
	reqB.Header.Set("Authorization", "Bearer token-b")
	reqB = reqB.WithContext(auth.WithUserContext(reqB.Context(), testUserB))
	wB := httptest.NewRecorder()

	srv.Router.ServeHTTP(wB, reqB)

	if wB.Code != http.StatusOK {
		t.Fatalf("User B deleting own application: want 200 OK, got %d (body=%s)", wB.Code, wB.Body.String())
	}

	// 3. User B deleting an unowned application -> must fail with 404
	unownedPath := "/api/v1/applications/" + uuid.New().String()
	reqBUnowned := httptest.NewRequest(http.MethodDelete, unownedPath, nil)
	reqBUnowned.Header.Set("Authorization", "Bearer token-b")
	reqBUnowned = reqBUnowned.WithContext(auth.WithUserContext(reqBUnowned.Context(), testUserB))
	wBUnowned := httptest.NewRecorder()

	srv.Router.ServeHTTP(wBUnowned, reqBUnowned)

	if wBUnowned.Code != http.StatusNotFound {
		t.Fatalf("User B deleting unowned application: want 404 Not Found, got %d (body=%s)", wBUnowned.Code, wBUnowned.Body.String())
	}
}

func TestStrictOwnershipPredicate_RequiresAND(t *testing.T) {
	validQueries := []string{
		"SELECT id, application_id FROM applications WHERE (application_id::text=$1 OR id::text=$1) AND user_id=$2",
		"DELETE FROM applications WHERE application_id=$1 AND user_id=$2",
		"SELECT * FROM applications WHERE user_id=$2 AND (application_id::text=$1 OR id::text=$1)",
		"SELECT * FROM applications WHERE application_id=$1 AND user_id=$2",
		"SELECT * FROM applications WHERE user_id=$2 AND application_id=$1",
		"SELECT * FROM applications WHERE (application_id::text=$1 OR id::text=$1) AND user_id=$2 AND status='review'",
	}

	for _, q := range validQueries {
		if !isStrictOwnershipQuery(q) {
			t.Errorf("expected isStrictOwnershipQuery to accept valid query: %s", q)
		}
		if isOROwnershipQuery(q) {
			t.Errorf("expected isOROwnershipQuery to be false for valid query: %s", q)
		}
	}

	insecureQueries := []string{
		"SELECT * FROM applications WHERE application_id=$1 OR user_id=$2",
		"SELECT * FROM applications WHERE user_id=$2 OR application_id=$1",
		"SELECT * FROM applications WHERE (application_id::text=$1 OR id::text=$1) OR user_id=$2",
		"SELECT * FROM applications WHERE application_id::text=$1 OR id::text=$1 AND user_id=$2",
		"SELECT * FROM applications WHERE (application_id=$1 OR user_id=$2)",
		"SELECT * FROM applications WHERE (application_id=$1 OR user_id=$2) AND status='review'",
		"SELECT * FROM applications WHERE (user_id=$1 OR user_id=$2) AND application_id=$3",
		"SELECT * FROM applications WHERE application_id=$1",
		"SELECT * FROM applications WHERE user_id=$2",
		"DELETE FROM applications WHERE application_id=$1 OR user_id=$2",
	}

	for _, q := range insecureQueries {
		if isStrictOwnershipQuery(q) {
			t.Errorf("expected isStrictOwnershipQuery to reject insecure query: %s", q)
		}
		if !isOROwnershipQuery(q) && (strings.Contains(q, "application_id") && strings.Contains(q, "user_id")) {
			t.Errorf("expected isOROwnershipQuery to detect insecure OR query: %s", q)
		}
	}
}

func TestTwoUserIsolation_FakeDriverRejectsORQuery(t *testing.T) {
	conn := twoUserFakeConn{}
	insecureQuery := "SELECT id, application_id FROM applications WHERE (application_id::text=$1 OR id::text=$1) OR user_id=$2"

	// User A attempts to access User B's application via insecure OR query
	args := []driver.NamedValue{
		{Ordinal: 1, Value: appOwnedByB.String()},
		{Ordinal: 2, Value: testUserA.ID.String()},
	}

	rows, err := conn.QueryContext(context.Background(), insecureQuery, args)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer rows.Close()

	dest := make([]driver.Value, 16)
	if err := rows.Next(dest); err != nil {
		t.Fatalf("insecure OR query should have matched User B's row for User A, simulating real SQL leak: %v", err)
	}
	if dest[1] != appOwnedByB.String() {
		t.Fatalf("expected application ID %s, got %v", appOwnedByB.String(), dest[1])
	}
}
