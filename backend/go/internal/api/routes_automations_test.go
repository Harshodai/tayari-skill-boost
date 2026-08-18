package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"tayari-backend/internal/auth"
	"tayari-backend/internal/models"
)

func automationTenantRequest(method, target string, userID, tenantID uuid.UUID) *http.Request {
	req := httptest.NewRequest(method, target, nil)
	ctx := auth.WithUserContext(req.Context(), &models.User{ID: userID})
	ctx = auth.WithAuthorizationContext(ctx, &auth.AuthorizationContext{Subject: userID, TenantID: tenantID, Roles: []string{"member"}})
	ctx = context.WithValue(ctx, contextKeyTenant, &models.Tenant{ID: tenantID})
	return req.WithContext(ctx)
}

func TestAutomationRoutesFailClosedInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("CAPABILITY_WORKSPACE_AUTOMATIONS", "")
	server := newHermesServer(t, "")
	userID, tenantID := uuid.New(), uuid.New()
	req := automationTenantRequest(http.MethodPost, "/api/v1/automations", userID, tenantID)
	rec := httptest.NewRecorder()
	server.handleCreateAutomation(rec, req)
	if rec.Code != http.StatusLocked {
		t.Fatalf("expected 423, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAutomationOwnerRejectsCrossTenantContextReplay(t *testing.T) {
	userID, tenantA, tenantB := uuid.New(), uuid.New(), uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/automations", nil)
	ctx := auth.WithUserContext(req.Context(), &models.User{ID: userID})
	ctx = auth.WithAuthorizationContext(ctx, &auth.AuthorizationContext{Subject: userID, TenantID: tenantA, Roles: []string{"member"}})
	ctx = context.WithValue(ctx, contextKeyTenant, &models.Tenant{ID: tenantB})
	_, _, ok := automationOwner(req.WithContext(ctx))
	if ok {
		t.Fatal("cross-tenant authorization context must be rejected")
	}
}

func TestCanonicalApprovalHashBindsPayloadAndPolicy(t *testing.T) {
	first := automationApprovalRequest{ActionType: "send_email", RiskTier: "external_write", Summary: "Send draft", Payload: []byte(`{"body":"one"}`), PolicyVersion: "v1"}
	second := automationApprovalRequest{ActionType: "send_email", RiskTier: "external_write", Summary: "Send draft", Payload: []byte(`{"body":"two"}`), PolicyVersion: "v1"}
	if canonicalApprovalHash(first) == canonicalApprovalHash(second) {
		t.Fatal("approval hash must change when payload changes")
	}
}

func TestRandomApprovalTokenReturnsOnlyDigestableSecret(t *testing.T) {
	token, digest, err := randomApprovalToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(token) != 64 || len(digest) != 64 || token == digest {
		t.Fatalf("unexpected token/digest lengths or equality: %d/%d", len(token), len(digest))
	}
}
