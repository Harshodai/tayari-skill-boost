package api

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/config"
	"tayari-backend/internal/database"
	"tayari-backend/internal/models"
)

func whatsappAuthenticatedTenantRequest(method, target string, body []byte) *http.Request {
	userID := uuid.New()
	tenantID := uuid.New()
	ctx := context.Background()
	ctx = context.WithValue(ctx, contextKeyUser, &models.User{ID: userID, Email: "whatsapp-test@example.com"})
	ctx = context.WithValue(ctx, contextKeyTenant, &models.Tenant{ID: tenantID})
	ctx = auth.WithAuthorizationContext(ctx, &auth.AuthorizationContext{Subject: userID, TenantID: tenantID, Roles: []string{"member"}})
	req := httptest.NewRequest(method, target, bytes.NewReader(body)).WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestWhatsAppLinkHandlersFailClosedWhenCapabilityDisabled(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("CAPABILITY_WORKSPACE_NOTIFICATION_WHATSAPP", "false")
	server := NewServer(&hermesMockAuth{}, &config.Config{}, &database.DB{Conn: nil})

	for _, tc := range []struct {
		name    string
		handler http.HandlerFunc
		body    string
	}{
		{name: "start", handler: server.handleStartWhatsAppLink, body: `{"phone_e164":"+14155552671","consent":true}`},
		{name: "confirm", handler: server.handleConfirmWhatsAppLink, body: `{"code":"123456"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := whatsappAuthenticatedTenantRequest(http.MethodPost, "/api/v1/notification-preferences/whatsapp/"+tc.name, []byte(tc.body))
			rec := httptest.NewRecorder()
			tc.handler(rec, req)
			if rec.Code != http.StatusLocked {
				t.Fatalf("expected 423, got %d: %s", rec.Code, rec.Body.String())
			}
			if !containsAll(rec.Body.String(), `"code":"disabled_by_launch_scope"`, `"capability":"workspace.notification.whatsapp"`) {
				t.Fatalf("unexpected disabled response: %s", rec.Body.String())
			}
		})
	}
}
