package api

import (
	"bytes"
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

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
)

// -------------------------------------------------------------------
// PATCH /api/v1/watches/{id} (handleUpdateJobWatch) tests.
//
// Strategy mirrors routes_profile_test.go: a stdlib-only fake
// database/sql/driver that pattern-matches the UPDATE query, captures its
// bound args (to prove the user_id ownership predicate and only-the-changed-
// column semantics), and answers with a canned RETURNING row. A second mode
// answers zero rows, to prove a watch that isn't the caller's own (or
// doesn't exist) surfaces as 404, not a silent no-op 200.
// -------------------------------------------------------------------

var watchesFixedUserID = uuid.MustParse("00000000-0000-0000-0000-0000000000aa")

type watchesMockAuth struct{ userID uuid.UUID }

func (m *watchesMockAuth) VerifyToken(token string) (*models.User, error) {
	if token == "" {
		return nil, io.ErrUnexpectedEOF
	}
	return &models.User{ID: m.userID, Email: "watches@example.com", Role: "user"}, nil
}
func (m *watchesMockAuth) Login(context.Context, string, string) (string, error) {
	return "token", nil
}
func (m *watchesMockAuth) Register(context.Context, string, string) (*models.User, error) {
	return &models.User{ID: m.userID, Email: "watches@example.com", Role: "user"}, nil
}
func (m *watchesMockAuth) SocialLogin(http.ResponseWriter, *http.Request)    {}
func (m *watchesMockAuth) SocialCallback(http.ResponseWriter, *http.Request) {}

func watchesAuthReq(method, target string, body []byte) *http.Request {
	req := httptest.NewRequest(method, target, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("Content-Type", "application/json")
	return req
}

var (
	watchUpdateArgsMu sync.Mutex
	watchUpdateArgs   []driver.NamedValue
	watchUpdateRowsFound = true // toggled per-test to simulate a 0-row match
)

type watchesFakeConn struct{}

func (watchesFakeConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("fake driver") }
func (watchesFakeConn) Close() error                        { return nil }
func (watchesFakeConn) Begin() (driver.Tx, error)            { return nil, errors.New("fake driver") }

func (c watchesFakeConn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if !strings.Contains(query, "UPDATE public.job_watches") {
		return nil, errors.New("fake driver: unexpected query: " + query)
	}
	watchUpdateArgsMu.Lock()
	watchUpdateArgs = args
	found := watchUpdateRowsFound
	watchUpdateArgsMu.Unlock()
	if !found {
		return &watchesFakeRows{done: true}, nil
	}
	return &watchesFakeRows{}, nil
}

// watchesFakeRows answers the RETURNING clause with one canned row (unless
// pre-marked done, which simulates zero rows matched by the WHERE clause).
type watchesFakeRows struct{ done bool }

func (r *watchesFakeRows) Columns() []string {
	return []string{"id", "watch_id", "user_id", "query_title", "location", "salary_floor", "schedule_tier", "is_active", "last_run_at", "created_at"}
}
func (r *watchesFakeRows) Close() error { return nil }
func (r *watchesFakeRows) Next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	r.done = true
	dest[0] = int64(1)
	dest[1] = "11111111-1111-1111-1111-111111111111"
	dest[2] = watchesFixedUserID.String()
	dest[3] = "Backend Engineer"
	dest[4] = "Remote"
	dest[5] = float64(120000)
	dest[6] = "daily"
	dest[7] = false // reflects the PATCH toggling is_active -> false
	dest[8] = time.Date(2026, 8, 27, 10, 0, 0, 0, time.UTC)
	dest[9] = time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	return nil
}

var watchesFakeDriverOnce sync.Once

func watchesFakeDB() *sql.DB {
	watchesFakeDriverOnce.Do(func() {
		sql.Register("fake-watches", watchesFakeDriver{})
	})
	db, _ := sql.Open("fake-watches", "")
	return db
}

type watchesFakeDriver struct{}

func (watchesFakeDriver) Open(string) (driver.Conn, error) { return watchesFakeConn{}, nil }

func newWatchesTestServer(t *testing.T) *Server {
	t.Helper()
	return NewServer(
		&watchesMockAuth{userID: watchesFixedUserID},
		&config.Config{},
		&database.DB{Conn: watchesFakeDB()},
	)
}

// TestUpdateJobWatch_TogglesActiveScopedToOwner verifies PATCH binds the
// caller's own user_id (not a client-supplied one - there is no such field)
// alongside the watch id, and that only the requested field is included in
// the SET clause the fake driver received.
func TestUpdateJobWatch_TogglesActiveScopedToOwner(t *testing.T) {
	watchUpdateArgsMu.Lock()
	watchUpdateArgs = nil
	watchUpdateRowsFound = true
	watchUpdateArgsMu.Unlock()

	server := newWatchesTestServer(t)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, watchesAuthReq(http.MethodPatch, "/api/v1/watches/11111111-1111-1111-1111-111111111111", []byte(`{"is_active":false}`)))

	if w.Code != http.StatusOK {
		t.Fatalf("PATCH /api/v1/watches/{id}: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	watchUpdateArgsMu.Lock()
	args := watchUpdateArgs
	watchUpdateArgsMu.Unlock()
	if args == nil {
		t.Fatal("update did not reach the fake driver")
	}
	// SET is_active=$1, updated_at=NOW() is a literal -> only is_active is a
	// bound arg before user_id/watch_id, so args = [is_active, user_id, watch_id].
	if len(args) != 3 {
		t.Fatalf("expected 3 bound args (is_active, user_id, watch_id), got %d: %#v", len(args), args)
	}
	if args[0].Value != false {
		t.Errorf("arg[0] (is_active) = %#v, want false", args[0].Value)
	}
	if args[1].Value != watchesFixedUserID.String() {
		t.Errorf("arg[1] (user_id) = %#v, want the authenticated caller's own id %s", args[1].Value, watchesFixedUserID.String())
	}
	if args[2].Value != "11111111-1111-1111-1111-111111111111" {
		t.Errorf("arg[2] (watch id) = %#v, want the path param", args[2].Value)
	}

	var got JobWatch
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("response is not valid JobWatch JSON: %v", err)
	}
	if got.IsActive != false {
		t.Errorf("response is_active = %v, want false", got.IsActive)
	}
}

// TestUpdateJobWatch_NotFoundWhenNoRowMatches proves that a watch id that
// doesn't exist -- or belongs to a different user, since the WHERE clause
// always includes the caller's own user_id -- returns 404, not a silent 200
// that would let a caller believe someone else's watch was changed.
func TestUpdateJobWatch_NotFoundWhenNoRowMatches(t *testing.T) {
	watchUpdateArgsMu.Lock()
	watchUpdateArgs = nil
	watchUpdateRowsFound = false
	watchUpdateArgsMu.Unlock()
	defer func() {
		watchUpdateArgsMu.Lock()
		watchUpdateRowsFound = true
		watchUpdateArgsMu.Unlock()
	}()

	server := newWatchesTestServer(t)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, watchesAuthReq(http.MethodPatch, "/api/v1/watches/not-mine", []byte(`{"is_active":true}`)))

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for a watch not owned by the caller, got %d: %s", w.Code, w.Body.String())
	}
}

// TestUpdateJobWatch_RejectsEmptyBody proves an empty PATCH body is rejected
// before ever reaching the database, rather than running a SET clause with
// nothing but "updated_at = NOW()".
func TestUpdateJobWatch_RejectsEmptyBody(t *testing.T) {
	watchUpdateArgsMu.Lock()
	watchUpdateArgs = nil
	watchUpdateArgsMu.Unlock()

	server := newWatchesTestServer(t)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, watchesAuthReq(http.MethodPatch, "/api/v1/watches/11111111-1111-1111-1111-111111111111", []byte(`{}`)))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for an empty update body, got %d: %s", w.Code, w.Body.String())
	}
	watchUpdateArgsMu.Lock()
	reached := watchUpdateArgs != nil
	watchUpdateArgsMu.Unlock()
	if reached {
		t.Error("empty-body PATCH should be rejected before it reaches the database")
	}
}
