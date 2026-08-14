package api

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
)

type voiceMockAuth struct {
	userID uuid.UUID
}

func (m *voiceMockAuth) VerifyToken(token string) (*models.User, error) {
	if token == "" {
		return nil, io.ErrUnexpectedEOF
	}
	return &models.User{ID: m.userID, Email: "voice@example.com", Role: "user"}, nil
}
func (m *voiceMockAuth) Login(context.Context, string, string) (string, error) {
	return "token", nil
}
func (m *voiceMockAuth) Register(context.Context, string, string) (*models.User, error) {
	return &models.User{ID: m.userID, Email: "voice@example.com", Role: "user"}, nil
}
func (m *voiceMockAuth) SocialLogin(http.ResponseWriter, *http.Request)    {}
func (m *voiceMockAuth) SocialCallback(http.ResponseWriter, *http.Request) {}

func newVoiceTestServer(t *testing.T) *Server {
	t.Helper()
	return NewServer(
		&voiceMockAuth{userID: uuid.MustParse("00000000-0000-0000-0000-000000000001")},
		&config.Config{PythonAIURL: "http://127.0.0.1:1"},
		&database.DB{Conn: nil},
	)
}

func voiceRequest(origin string, authenticated bool) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/interview/stream", bytes.NewReader(nil))
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	if authenticated {
		req.Header.Set("Authorization", "Bearer voice-token")
	}
	return req
}

func TestVoiceStreamRejectsUnauthenticatedUpgradeBeforeDial(t *testing.T) {
	server := newVoiceTestServer(t)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, voiceRequest("http://localhost:5173", false))

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthenticated voice upgrade to return 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestVoiceStreamRejectsUntrustedOriginBeforeDial(t *testing.T) {
	server := newVoiceTestServer(t)
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, voiceRequest("https://attacker.example", true))

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected untrusted voice origin to return 403, got %d: %s", w.Code, w.Body.String())
	}
}

func TestVoiceStreamQuotaBlocksThirdUpgradeBeforeBackendDial(t *testing.T) {
	server := newVoiceTestServer(t)
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		server.Router.ServeHTTP(w, voiceRequest("http://localhost:5173", true))
		if w.Code != http.StatusBadGateway {
			t.Fatalf("expected backend dial failure for allowed attempt %d, got %d: %s", i+1, w.Code, w.Body.String())
		}
	}

	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, voiceRequest("http://localhost:5173", true))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected third voice upgrade to be rate limited before dialing, got %d: %s", w.Code, w.Body.String())
	}
}

func TestVoiceStreamRequiresWebsocketUpgradeAfterAuth(t *testing.T) {
	server := newVoiceTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/interview/stream", nil)
	req.Header.Set("Authorization", "Bearer voice-token")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected non-websocket request to return 400, got %d: %s", w.Code, w.Body.String())
	}
}
