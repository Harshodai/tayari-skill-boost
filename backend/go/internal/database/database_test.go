package database

import (
	"context"
	"database/sql"
	"testing"
)

func TestSyntheticIdentityRejection(t *testing.T) {
	synthetics := []string{"default_user", "candidate", "unknown", "anonymous", "system"}
	for _, s := range synthetics {
		if !isSyntheticIdentity(s) {
			t.Errorf("expected %s to be recognized as synthetic identity", s)
		}
	}

	valids := []string{"user_123", "usr_abc-456", "00000000-0000-0000-0000-000000000001"}
	for _, v := range valids {
		if isSyntheticIdentity(v) {
			t.Errorf("expected %s to NOT be recognized as synthetic identity", v)
		}
	}
}

func TestWithTenantTx_RejectsInvalidUser(t *testing.T) {
	db := &DB{}
	ctx := context.Background()

	err := db.WithTenantTx(ctx, "", func(tx *sql.Tx) error {
		return nil
	})
	if err == nil {
		t.Fatal("expected error for empty userID")
	}

	err = db.WithTenantTx(ctx, "default_user", func(tx *sql.Tx) error {
		return nil
	})
	if err == nil {
		t.Fatal("expected error for synthetic default_user")
	}
}
