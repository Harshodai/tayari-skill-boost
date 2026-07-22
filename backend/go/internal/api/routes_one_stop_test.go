package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOneStopRoutes_RadarCheck(t *testing.T) {
	fakePython := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/radar/check" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"status":"success","companies_scanned":1,"total_matches_found":1}`)
	})
	defer fakePython.Close()

	server := newHermesServer(t, fakePython.URL)
	ts := httptest.NewServer(server.Router)
	defer ts.Close()

	payload := map[string]interface{}{
		"companies": []string{"stripe"},
		"keywords":  []string{"engineer"},
	}
	bodyBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/v1/radar/check", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	var res map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if res["status"] != "success" {
		t.Fatalf("expected status success, got %v", res["status"])
	}
}

func TestOneStopRoutes_VoiceFeedback(t *testing.T) {
	fakePython := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/interview/voice-feedback" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"wpm":135.0,"wpm_status":"OPTIMAL","overall_score":85.0}`)
	})
	defer fakePython.Close()

	server := newHermesServer(t, fakePython.URL)
	ts := httptest.NewServer(server.Router)
	defer ts.Close()

	payload := map[string]interface{}{
		"transcript":       "In my previous project at Google, I led the redesign of the user microservice.",
		"duration_seconds": 30.0,
	}
	bodyBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/v1/interview/voice-feedback", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}
}

func TestOneStopRoutes_AnalyticsFunnel(t *testing.T) {
	fakePython := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/analytics/funnel" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"total_applied":10,"response_rate":20.0}`)
	})
	defer fakePython.Close()

	server := newHermesServer(t, fakePython.URL)
	ts := httptest.NewServer(server.Router)
	defer ts.Close()

	payload := map[string]interface{}{
		"applications": []interface{}{},
	}
	bodyBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/v1/analytics/funnel", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}
}

func TestOneStopRoutes_PrivacyCheck(t *testing.T) {
	fakePython := fakeAIServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/privacy/check" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"privacy_mode":"LOCAL_FIRST_ZERO_DATA_LEAKAGE","self_hosted":true}`)
	})
	defer fakePython.Close()

	server := newHermesServer(t, fakePython.URL)
	ts := httptest.NewServer(server.Router)
	defer ts.Close()

	payload := map[string]interface{}{}
	bodyBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/v1/privacy/check", bytes.NewReader(bodyBytes))
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}
}
