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

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

var cannedUpdatedAt = time.Date(2026, 8, 10, 0, 0, 0, 0, time.UTC)

// profileFakeConn is a stdlib-only driver stub that answers the profile
// SELECT with a canned row (including the career-goal columns) and the
// profile upsert (RETURNING updated_at) with a canned timestamp. Like
// optimizeResumeFakeConn it only implements the query surface the profile
// handlers touch.
type profileFakeConn struct{}

func (profileFakeConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("fake driver")
}
func (profileFakeConn) Close() error { return nil }
func (profileFakeConn) Begin() (driver.Tx, error) {
	return nil, errors.New("fake driver")
}

var (
	profileUpsertArgsMu sync.Mutex
	profileUpsertArgs   []driver.NamedValue
)

func captureProfileUpsertArgs(args []driver.NamedValue) {
	profileUpsertArgsMu.Lock()
	defer profileUpsertArgsMu.Unlock()
	profileUpsertArgs = args
}

func (c profileFakeConn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	switch {
	case strings.Contains(query, "FROM profiles WHERE id=$1"):
		return newProfileFakeRows(), nil
	case strings.Contains(query, "INSERT INTO profiles"):
		captureProfileUpsertArgs(args)
		return newProfileUpsertRows(), nil
	case strings.Contains(query, "FROM tenants"):
		return nil, errors.New("fake driver: no tenant")
	default:
		return nil, errors.New("fake driver: unexpected query")
	}
}

func (profileFakeConn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	return nil, errors.New("fake driver")
}

// profileFakeRows yields one canned profile row. Columns must match the
// handleGetProfile SELECT/scan order exactly.
type profileFakeRows struct {
	done bool
}

func newProfileFakeRows() *profileFakeRows { return &profileFakeRows{} }

func (r *profileFakeRows) Columns() []string {
	return []string{
		"id", "full_name", "avatar_url", "email", "headline", "summary",
		"skills", "desired_roles", "locations", "experience_years", "open_to_remote",
		"links", "created_at", "updated_at",
		"transition_type", "current_title", "target_level", "current_industry",
		"target_industry", "transferable_skills",
	}
}
func (r *profileFakeRows) Close() error { return nil }
func (r *profileFakeRows) Next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	r.done = true
	dest[0] = "00000000-0000-0000-0000-000000000001"
	dest[1] = "Ada Lovelace"
	dest[2] = ""
	dest[3] = "ada@example.com"
	dest[4] = "Software Engineer"
	dest[5] = "Builds reliable systems."
	dest[6] = "{Go,PostgreSQL}"
	dest[7] = "{Staff Engineer}"
	dest[8] = "{London}"
	dest[9] = int64(8)
	dest[10] = true
	dest[11] = []byte(`{"github":"https://github.com/ada"}`)
	dest[12] = cannedUpdatedAt
	dest[13] = cannedUpdatedAt
	dest[14] = "cross_domain"
	dest[15] = "Senior Software Engineer"
	dest[16] = "Staff Architect"
	dest[17] = "Fintech"
	dest[18] = "AI / Machine Learning"
	dest[19] = "{Distributed Systems,High-Throughput APIs}"
	return nil
}

// profileUpsertRows yields the RETURNING updated_at row the upsert scans.
type profileUpsertRows struct {
	done bool
}

func newProfileUpsertRows() *profileUpsertRows { return &profileUpsertRows{} }

func (r *profileUpsertRows) Columns() []string { return []string{"updated_at"} }
func (r *profileUpsertRows) Close() error      { return nil }
func (r *profileUpsertRows) Next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	r.done = true
	dest[0] = cannedUpdatedAt
	return nil
}

var profileFakeDriverOnce sync.Once

// profileFakeDB returns a *sql.DB backed by the canned-row driver.
func profileFakeDB() *sql.DB {
	profileFakeDriverOnce.Do(func() {
		sql.Register("fake-profile", profileFakeDriver{})
	})
	db, _ := sql.Open("fake-profile", "")
	return db
}

type profileFakeDriver struct{}

func (profileFakeDriver) Open(string) (driver.Conn, error) {
	return profileFakeConn{}, nil
}

// TestProfileCareerGoalRoundTrip verifies the career-goal fields flow through
// the wire: PUT /api/v1/profile accepts them and GET /api/v1/profile returns
// them (the fake driver answers both sides with the same canned values).
func TestProfileCareerGoalRoundTrip(t *testing.T) {
	server := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: profileFakeDB()})

	profileUpsertArgsMu.Lock()
	profileUpsertArgs = nil
	profileUpsertArgsMu.Unlock()

	putBody := []byte(`{
		"full_name":"Ada Lovelace",
		"headline":"Software Engineer",
		"transition_type":"cross_domain",
		"current_title":"Senior Software Engineer",
		"target_level":"Staff Architect",
		"current_industry":"Fintech",
		"target_industry":"AI / Machine Learning",
		"transferable_skills":["Distributed Systems","High-Throughput APIs"]
	}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPut, "/api/v1/profile", putBody))
	if w.Code != http.StatusOK {
		t.Fatalf("PUT /api/v1/profile: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var putResp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &putResp); err != nil {
		t.Fatalf("PUT response is not JSON: %v", err)
	}
	if putResp["updated_at"] == nil {
		t.Fatalf("PUT response missing updated_at: %s", w.Body.String())
	}

	w = httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/v1/profile", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("GET /api/v1/profile: expected 200, got %d: %s", w.Code, w.Body.String())
	}
	var got map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("GET response is not JSON: %v", err)
	}
	// ponytail: the fake driver ignores the upsert's bound values and always
	// serves the canned GET row (newProfileFakeRows), so the GET assertions
	// above only prove the scan side. Assert the bound upsert args directly —
	// the only way this test proves the PUT values reached persistence.
	profileUpsertArgsMu.Lock()
	if profileUpsertArgs == nil {
		profileUpsertArgsMu.Unlock()
		t.Fatal("upsert did not reach the fake driver")
	}
	gotArgs := profileUpsertArgs
	profileUpsertArgsMu.Unlock()
	if gotArgs[12].Value != "cross_domain" {
		t.Errorf("upsert transition_type arg (13th) = %#v, want cross_domain", gotArgs[12].Value)
	}
	if gotArgs[13].Value != "Senior Software Engineer" {
		t.Errorf("upsert current_title arg (14th) = %#v, want Senior Software Engineer", gotArgs[13].Value)
	}
	if gotArgs[14].Value != "Staff Architect" {
		t.Errorf("upsert target_level arg (15th) = %#v, want Staff Architect", gotArgs[14].Value)
	}
	if gotArgs[15].Value != "Fintech" {
		t.Errorf("upsert current_industry arg (16th) = %#v, want Fintech", gotArgs[15].Value)
	}
	if gotArgs[16].Value != "AI / Machine Learning" {
		t.Errorf("upsert target_industry arg (17th) = %#v, want AI / Machine Learning", gotArgs[16].Value)
	}
	wantSkills := `{"Distributed Systems","High-Throughput APIs"}`
	if gotSkills, ok := gotArgs[17].Value.(string); !ok || gotSkills != wantSkills {
		t.Errorf("upsert transferable_skills arg (18th) = %#v, want %s", gotArgs[17].Value, wantSkills)
	}

	if got["transition_type"] != "cross_domain" {
		t.Errorf("GET transition_type = %v, want cross_domain", got["transition_type"])
	}
	if got["current_title"] != "Senior Software Engineer" {
		t.Errorf("GET current_title = %v, want Senior Software Engineer", got["current_title"])
	}
	if got["target_level"] != "Staff Architect" {
		t.Errorf("GET target_level = %v, want Staff Architect", got["target_level"])
	}
	if got["current_industry"] != "Fintech" {
		t.Errorf("GET current_industry = %v, want Fintech", got["current_industry"])
	}
	if got["target_industry"] != "AI / Machine Learning" {
		t.Errorf("GET target_industry = %v, want AI / Machine Learning", got["target_industry"])
	}
	skills, ok := got["transferable_skills"].([]interface{})
	if !ok || len(skills) != 2 || skills[0] != "Distributed Systems" || skills[1] != "High-Throughput APIs" {
		t.Errorf("GET transferable_skills = %#v, want [Distributed Systems High-Throughput APIs]", got["transferable_skills"])
	}
}

// TestProfileUpsertTransitionTypeNilBind verifies the upsert binds NULL for
// transition_type when the request omits it — "" violates the CHECK
// constraint (no DEFAULT) and would 500 the whole profile save. The fake
// driver ignores the CHECK, so assert the bound arg value directly.
func TestProfileUpsertTransitionTypeNilBind(t *testing.T) {
	server := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: profileFakeDB()})

	profileUpsertArgsMu.Lock()
	profileUpsertArgs = nil
	profileUpsertArgsMu.Unlock()

	putBody := []byte(`{"full_name":"Ada Lovelace","headline":"Software Engineer"}`)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPut, "/api/v1/profile", putBody))
	if w.Code != http.StatusOK {
		t.Fatalf("PUT /api/v1/profile without transition_type: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	profileUpsertArgsMu.Lock()
	if profileUpsertArgs == nil {
		profileUpsertArgsMu.Unlock()
		t.Fatal("upsert did not reach the fake driver")
	}
	got := profileUpsertArgs[12].Value
	profileUpsertArgsMu.Unlock()
	if got != nil {
		t.Errorf("transition_type arg (13th) = %#v, want nil (NULL) so the CHECK passes", got)
	}

	w = httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPut, "/api/v1/profile", []byte(`{"full_name":"Ada Lovelace","transition_type":"same_domain"}`)))
	if w.Code != http.StatusOK {
		t.Fatalf("PUT /api/v1/profile with transition_type: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	profileUpsertArgsMu.Lock()
	got = profileUpsertArgs[12].Value
	profileUpsertArgsMu.Unlock()
	if got != "same_domain" {
		t.Errorf("transition_type arg (13th) = %#v, want same_domain", got)
	}
}
