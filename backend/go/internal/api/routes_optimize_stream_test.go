package api

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"tayari-backend/internal/ai"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func TestOptimizeResumeStream_ForwardsInternalToken(t *testing.T) {
	var gotToken, gotUser, gotCT string
	upstream := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		gotToken = r.Header.Get("X-Internal-Token")
		gotUser = r.Header.Get("X-User-Id")
		gotCT = r.Header.Get("Content-Type")
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(w, "data: done\n\n")
	})
	defer upstream.Close()

	cfg := &config.Config{PythonAIURL: upstream.URL, AIInternalToken: "test-internal-token"}
	server := NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: nil})
	server.AI = ai.NewClientWithToken(upstream.URL, "test-internal-token")

	form := url.Values{}
	form.Set("resume_text", "experienced gopher")
	form.Set("job_description", "backend role")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/resumes/1/optimize-stream", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	server.handleOptimizeResumeStream(rec, req)

	if gotToken != "test-internal-token" {
		t.Fatalf("X-Internal-Token=%q, want test-internal-token", gotToken)
	}
	if !strings.HasPrefix(gotCT, "multipart/form-data") {
		t.Fatalf("Content-Type=%q, want multipart passthrough", gotCT)
	}
	_ = gotUser
}
