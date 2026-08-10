package api

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
)

func newVerificationServer(t *testing.T, pythonURL string) *Server {
	t.Helper()
	cfg := &config.Config{PythonAIURL: pythonURL}
	return NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: nil})
}

// newVerificationServerWithDB is the same but with a non-nil (fake) DB so the
// database guard passes and the handler reaches the upstream AI call.
func newVerificationServerWithDB(t *testing.T, pythonURL string) *Server {
	t.Helper()
	cfg := &config.Config{PythonAIURL: pythonURL}
	return NewServer(&hermesMockAuth{}, cfg, &database.DB{Conn: fakeDB()})
}

const scoringResponse = `{"truthful_score":84.0,"red_flags":["X"],"screening_score":73.0,"strengths":["Y"],"gaps":["Z"],"sample_questions":["Q1"]}`

func TestComputeVerification_AboveThresholdsIsVerified(t *testing.T) {
	row := computeVerification(map[string]interface{}{
		"truthful_score": 84.0, "red_flags": []interface{}{"X"},
		"screening_score": 73.0, "strengths": []interface{}{"Y"},
		"gaps": []interface{}{"Z"}, "sample_questions": []interface{}{"Q1"},
		"evidence": "independent_check",
	})
	if row.Status != "verified" {
		t.Errorf("expected verified, got %s", row.Status)
	}
	if row.TruthfulScore == nil || *row.TruthfulScore != 84.0 {
		t.Errorf("expected truthful_score 84, got %v", row.TruthfulScore)
	}
	if row.VerifiedAt == nil {
		t.Error("expected verified_at set")
	}
	if len(row.RedFlags) != 1 || row.RedFlags[0] != "X" {
		t.Errorf("unexpected red_flags: %v", row.RedFlags)
	}
}

func TestComputeVerification_ResumeOnlyEvidenceVerifiesOnScores(t *testing.T) {
	row := computeVerification(map[string]interface{}{
		"truthful_score": 95.0, "red_flags": []interface{}{},
		"screening_score": 90.0, "strengths": []interface{}{},
		"gaps": []interface{}{}, "sample_questions": []interface{}{},
		"evidence": "resume_only",
	})
	if row.Status != "verified" {
		t.Errorf("expected verified from scores alone (evidence is resume_only), got %s", row.Status)
	}
	if row.VerifiedAt == nil {
		t.Error("expected verified_at set for score-satisfied resume_only evidence")
	}
}

func TestComputeVerification_MissingEvidenceVerifiesOnScores(t *testing.T) {
	row := computeVerification(map[string]interface{}{
		"truthful_score": 95.0, "red_flags": []interface{}{},
		"screening_score": 90.0, "strengths": []interface{}{},
		"gaps": []interface{}{}, "sample_questions": []interface{}{},
	})
	if row.Status != "verified" {
		t.Errorf("expected verified from scores alone, got %s", row.Status)
	}
	if row.VerifiedAt == nil {
		t.Error("expected verified_at set when scores satisfy thresholds")
	}
}

func TestComputeVerification_LowScoreStaysUnverified(t *testing.T) {
	row := computeVerification(map[string]interface{}{
		"truthful_score": 40.0, "red_flags": []interface{}{},
		"screening_score": 55.0, "strengths": []interface{}{},
		"gaps": []interface{}{}, "sample_questions": []interface{}{},
	})
	if row.Status != "unverified" {
		t.Errorf("expected unverified, got %s", row.Status)
	}
	if row.VerifiedAt != nil {
		t.Error("expected nil verified_at")
	}
}

func TestComputeVerification_MissingScoresStaysUnverified(t *testing.T) {
	row := computeVerification(map[string]interface{}{})
	if row.Status != "unverified" {
		t.Errorf("expected unverified, got %s", row.Status)
	}
	if row.TruthfulScore != nil || row.ScreeningScore != nil {
		t.Errorf("expected nil scores, got %v / %v", row.TruthfulScore, row.ScreeningScore)
	}
	if len(row.RedFlags) != 0 {
		t.Errorf("expected empty red_flags, got %v", row.RedFlags)
	}
}

func TestVerificationSubmit_ProxiesResumeTextUpstream(t *testing.T) {
	upstreamHit := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		upstreamHit = true
		if r.URL.Path != "/api/v1/verification/submit" {
			t.Errorf("unexpected upstream path: %s", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), "resume_text") {
			t.Errorf("expected resume_text forwarded, got %s", string(body))
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, scoringResponse)
	})
	defer srv.Close()

	server := newVerificationServerWithDB(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/verification/submit",
		[]byte(`{"resume_text":"Jane Doe\nSenior Engineer at Acme."}`)))

	if !upstreamHit {
		t.Fatal("expected upstream AI call")
	}
	// Fake DB: the guard passes, the AI round-trip happens, and the persist
	// step fails against the fake driver → 500 proves the proxy path ran.
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 (fake DB persist failure after proxy), got %d: %s", w.Code, w.Body.String())
	}
}

func TestVerificationSubmit_AliasRouteAlsoProxies(t *testing.T) {
	upstreamHit := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		upstreamHit = true
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, scoringResponse)
	})
	defer srv.Close()

	server := newVerificationServerWithDB(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/verification/submit",
		[]byte(`{"resume_text":"Jane"}`)))

	if !upstreamHit {
		t.Fatal("expected upstream AI call via alias route")
	}
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 (fake DB persist failure after proxy), got %d: %s", w.Code, w.Body.String())
	}
}

func TestVerificationSubmit_RejectsEmptyResumeText(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	server := newVerificationServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/verification/submit",
		[]byte(`{"resume_text":""}`)))

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", w.Code, w.Body.String())
	}
	if called {
		t.Error("expected no upstream call for empty resume_text")
	}
}

// TestVerificationSubmit_NilDBRejectsBeforeAI verifies the database guard
// fires BEFORE the AI call: with a nil DB the request must return 503 without
// ever reaching the upstream AI service.
func TestVerificationSubmit_NilDBRejectsBeforeAI(t *testing.T) {
	upstreamHit := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		upstreamHit = true
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, scoringResponse)
	})
	defer srv.Close()

	server := newVerificationServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/verification/submit",
		[]byte(`{"resume_text":"Jane Doe"}`)))

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 Database unavailable (nil DB), got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "Database unavailable") {
		t.Errorf("expected database guard message, got %s", w.Body.String())
	}
	if upstreamHit {
		t.Error("expected no upstream AI call when the database is nil")
	}
}

func TestVerificationSubmit_RejectsOversizedResumeText(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	server := newVerificationServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/verification/submit",
		[]byte(`{"resume_text":"`+strings.Repeat("a", 65537)+`"}`)))

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", w.Code, w.Body.String())
	}
	if called {
		t.Error("expected no upstream call for oversized resume_text")
	}
}

func TestVerificationSubmit_ForwardsPython503(t *testing.T) {
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = io.WriteString(w, `{"error":"ai_service_unavailable"}`)
	})
	defer srv.Close()

	server := newVerificationServerWithDB(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/verification/submit",
		[]byte(`{"resume_text":"Jane"}`)))

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "ai_service_unavailable") {
		t.Errorf("expected ai_service_unavailable error code, got %s", w.Body.String())
	}
}

func TestVerificationSubmit_RejectsWhitespaceOnlyResumeText(t *testing.T) {
	called := false
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	server := newVerificationServer(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/verification/submit",
		[]byte(`{"resume_text":"   \n\t  "}`)))

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d: %s", w.Code, w.Body.String())
	}
	if called {
		t.Error("expected no upstream call for whitespace-only resume_text")
	}
}

func TestVerificationSubmit_TrimsAndForwardsNormalizedText(t *testing.T) {
	upstreamBody := ""
	srv := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		upstreamBody = string(body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, scoringResponse)
	})
	defer srv.Close()

	server := newVerificationServerWithDB(t, srv.URL)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodPost, "/api/v1/verification/submit",
		[]byte(`{"resume_text":"  Jane Doe\nSenior Engineer at Acme.  "}`)))

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 (fake DB persist failure after proxy), got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(upstreamBody, `"resume_text":"Jane Doe\nSenior Engineer at Acme."`) {
		t.Errorf("expected trimmed resume_text forwarded, got %s", upstreamBody)
	}
}

func TestVerificationStatus_AliasRouteReturns503OnNilDB(t *testing.T) {
	server := newVerificationServer(t, "http://127.0.0.1:1")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, authReq(http.MethodGet, "/api/verification/status", nil))

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "database_unavailable") {
		t.Errorf("expected database_unavailable error code, got %s", w.Body.String())
	}
}