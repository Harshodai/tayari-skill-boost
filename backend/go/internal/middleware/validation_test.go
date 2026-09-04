package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type validateTestBody struct {
	Name string `json:"name" validate:"required,min=2"`
	Age  int    `json:"age" validate:"omitempty,gte=0"`
}

func serveValidate(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})
	h := ValidateBody[validateTestBody]()(next)
	var reader *strings.Reader
	if body == "<nil>" {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		return w
	}
	reader = strings.NewReader(body)
	req := httptest.NewRequest(http.MethodPost, "/", reader)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

func TestValidateBody(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantSub    string
	}{
		{"valid passes", `{"name":"amy","age":3}`, http.StatusOK, "OK"},
		{"valid omitempty passes", `{"name":"amy"}`, http.StatusOK, "OK"},
		{"empty name fails", `{"name":""}`, http.StatusBadRequest, "Validation failed"},
		{"short name fails", `{"name":"a"}`, http.StatusBadRequest, "Validation failed"},
		{"missing name fails", `{}`, http.StatusBadRequest, "Validation failed"},
		{"negative age fails", `{"name":"amy","age":-1}`, http.StatusBadRequest, "Validation failed"},
		{"invalid json fails", `{bad`, http.StatusBadRequest, "Invalid JSON"},
		{"empty body fails", ``, http.StatusBadRequest, "Invalid JSON"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := serveValidate(t, tc.body)
			if w.Code != tc.wantStatus {
				t.Fatalf("want %d, got %d body=%s", tc.wantStatus, w.Code, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), tc.wantSub) {
				t.Fatalf("want body containing %q, got %s", tc.wantSub, w.Body.String())
			}
		})
	}
}

func TestValidateBody_TooLarge(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := ValidateBody[validateTestBody]()(next)
	big := `{"name":"` + strings.Repeat("x", (1<<20)+10) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(big))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "too large") {
		t.Fatalf("want too-large error, got %s", w.Body.String())
	}
}

func TestValidateBody_ForwardsJSONFieldNames(t *testing.T) {
	w := serveValidate(t, `{"name":""}`)
	if !strings.Contains(w.Body.String(), "name") {
		t.Fatalf("want json field name in details, got %s", w.Body.String())
	}
}
