package api

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"tayari-backend/internal/auth"
	dbwrap "tayari-backend/internal/database"
	"tayari-backend/internal/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestCheckAdvisorRoleRejectsMissingAuthorizationContext(t *testing.T) {
	s := &Server{}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/advisor/cohorts", nil)
	rec := httptest.NewRecorder()

	_, _, ok := s.checkAdvisorRole(rec, req)
	if ok {
		t.Fatal("missing authorization context must not authorize advisor access")
	}
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for missing authorization context, got %d", rec.Code)
	}
}

func TestCheckAdvisorRoleRejectsCrossTenantContextReplay(t *testing.T) {
	s := &Server{}
	userID := uuid.New()
	tenantA := uuid.New()
	tenantB := uuid.New()
	user := &models.User{ID: userID}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/advisor/cohorts", nil)
	ctx := auth.WithUserContext(req.Context(), user)
	ctx = auth.WithAuthorizationContext(ctx, &auth.AuthorizationContext{
		Subject:  userID,
		TenantID: tenantA,
		Roles:    []string{"advisor"},
	})
	ctx = contextWithTenant(ctx, &models.Tenant{ID: tenantB})
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	_, _, ok := s.checkAdvisorRole(rec, req)
	if ok {
		t.Fatal("a tenant context different from the verified authorization context must not authorize")
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for cross-tenant replay, got %d", rec.Code)
	}
}

func TestCheckAdvisorRoleRejectsRevokedMembership(t *testing.T) {
	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlDB.Close()
	s := &Server{DB: &dbwrap.DB{Conn: sqlDB}}
	userID := uuid.New()
	tenantID := uuid.New()
	user := &models.User{ID: userID}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/advisor/cohorts", nil)
	ctx := auth.WithUserContext(req.Context(), user)
	ctx = auth.WithAuthorizationContext(ctx, &auth.AuthorizationContext{
		Subject:  userID,
		TenantID: tenantID,
		Roles:    []string{"advisor"},
	})
	ctx = contextWithTenant(ctx, &models.Tenant{ID: tenantID})
	req = req.WithContext(ctx)

	mock.ExpectQuery(`SELECT role FROM memberships WHERE tenant_id = \$1 AND user_id = \$2`).
		WithArgs(tenantID, userID).
		WillReturnError(errors.New("membership revoked"))
	rec := httptest.NewRecorder()

	_, _, ok := s.checkAdvisorRole(rec, req)
	if ok {
		t.Fatal("revoked membership must not authorize advisor access")
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for revoked membership, got %d", rec.Code)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}

// contextWithTenant keeps these tests independent of the legacy context-key
// type while using the same middleware value consumed by tenant routes.
func contextWithTenant(ctx context.Context, tenant *models.Tenant) context.Context {
	return context.WithValue(ctx, contextKeyTenant, tenant)
}
