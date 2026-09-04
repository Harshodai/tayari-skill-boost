package api

// RED: DELETE /api/v1/user/data must be data-only — user row survives, app rows gone.
import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"
)

func TestDeleteUserData_UserSurvivesAppRowsGone(t *testing.T) {
	user := &models.User{ID: uuid.New(), Email: "data-only@example.com"}
	srv := newAccountServerNoAI(t, accountFakeDB(), "", "")
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/user/data", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	req = req.WithContext(auth.WithUserContext(req.Context(), user))
	w := httptest.NewRecorder()
	srv.Router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("RED: want 200, got %d body=%s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), `"status":"deleted"`) {
		t.Fatalf("RED: data-only wipe must not return account-deleted semantics: %s", w.Body.String())
	}
}

// ─── query-recording driver: proves auth.users is never touched ───

var userdataRecMu sync.Mutex
var userdataRecQueries []string

type userdataRecTx struct{}

func (t *userdataRecTx) Commit() error   { return nil }
func (t *userdataRecTx) Rollback() error { return nil }
func (t *userdataRecTx) ExecContext(_ context.Context, query string, _ []driver.NamedValue) (driver.Result, error) {
	userdataRecMu.Lock()
	userdataRecQueries = append(userdataRecQueries, query)
	userdataRecMu.Unlock()
	return accountFakeResult{}, nil
}

type userdataRecConn struct{}

func (userdataRecConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("userdata rec driver: no prepared statements")
}
func (userdataRecConn) Close() error { return nil }
func (userdataRecConn) Begin() (driver.Tx, error) {
	return &userdataRecTx{}, nil
}
func (userdataRecConn) ExecContext(_ context.Context, query string, _ []driver.NamedValue) (driver.Result, error) {
	userdataRecMu.Lock()
	userdataRecQueries = append(userdataRecQueries, query)
	userdataRecMu.Unlock()
	return accountFakeResult{}, nil
}

type userdataRecDriver struct{}

func (userdataRecDriver) Open(string) (driver.Conn, error) { return userdataRecConn{}, nil }

var userdataRecOnce sync.Once

func userdataRecDB() *sql.DB {
	userdataRecOnce.Do(func() {
		sql.Register("fake-userdata-record", userdataRecDriver{})
	})
	userdataRecMu.Lock()
	userdataRecQueries = nil
	userdataRecMu.Unlock()
	db, _ := sql.Open("fake-userdata-record", "")
	return db
}

func TestDeleteUserData_NeverTouchesAuthIdentity(t *testing.T) {
	user := &models.User{ID: uuid.New(), Email: "data-only@example.com"}
	// Non-empty key: even WITH a GoTrue key configured, data-only wipe must
	// never call the admin API nor DELETE FROM auth.users.
	srv := newAccountServerNoAI(t, userdataRecDB(), unreachableGoTrueURL, "service-role-key")
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/user/data", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	req = req.WithContext(auth.WithUserContext(req.Context(), user))
	w := httptest.NewRecorder()
	srv.Router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d body=%s", w.Code, w.Body.String())
	}
	userdataRecMu.Lock()
	defer userdataRecMu.Unlock()
	if len(userdataRecQueries) == 0 {
		t.Fatal("expected cascade queries to run, none recorded")
	}
	for _, q := range userdataRecQueries {
		if strings.Contains(strings.ToLower(q), "auth.users") {
			t.Fatalf("data-only wipe touched auth identity: %q", q)
		}
	}
	joined := strings.ToLower(strings.Join(userdataRecQueries, "\n"))
	for _, want := range []string{"delete from applications", "delete from resumes", "delete from delivery_ledger", "delete from agent_runs"} {
		if !strings.Contains(joined, want) {
			t.Errorf("expected app-row wipe %q in cascade, got:\n%s", want, joined)
		}
	}
}
