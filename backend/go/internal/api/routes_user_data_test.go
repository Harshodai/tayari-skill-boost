package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"
)

func TestDeleteUserData_TwinsExistAndNeedAuth(t *testing.T) {
	srv := newAccountServerNoAI(t, accountFakeDB(), "", "")
	for _, path := range []string{"/api/v1/user/data", "/api/user/data"} {
		w := httptest.NewRecorder()
		srv.Router.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, path, nil))
		if w.Code == http.StatusNotFound {
			t.Fatalf("DELETE %s: not registered (404); want 401 without auth", path)
		}
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("DELETE %s: want 401 without auth, got %d (body=%s)", path, w.Code, w.Body.String())
		}
	}
}

func TestDeleteUserData_CallsSameErasureHandler(t *testing.T) {
	srv := newAccountServerNoAI(t, accountFakeDB(), "", "")
	user := &models.User{ID: uuid.New(), Email: "gdpr-alias@example.com"}
	for _, path := range []string{"/api/v1/user/data", "/api/user/data"} {
		req := httptest.NewRequest(http.MethodDelete, path, nil)
		req.Header.Set("Authorization", "Bearer test-token")
		req = req.WithContext(auth.WithUserContext(req.Context(), user))
		w := httptest.NewRecorder()
		srv.Router.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("DELETE %s authed: want 200, got %d (body=%s)", path, w.Code, w.Body.String())
		}
		var body map[string]string
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("DELETE %s authed: invalid JSON: %v", path, err)
		}
		if body["status"] != "data_deleted" {
			t.Fatalf("DELETE %s authed: want status=data_deleted, got %q", path, body["status"])
		}
		if body["status"] == "deleted" {
			t.Fatalf("DELETE %s authed: data-only wipe must never return account-deleted semantics", path)
		}
	}
}
