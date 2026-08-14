from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
RLS_SQL = ROOT / "supabase-local/volumes/db/init/29-20260814_tenant_rls_hardening.sql"
APPROVAL_SQL = ROOT / "supabase-local/volumes/db/init/23-20260811_audit_tables.sql"
ACCOUNT_GO = ROOT / "backend/go/internal/api/routes_account.go"


def test_rls_migration_covers_tenant_and_user_owned_tables():
    sql = RLS_SQL.read_text()
    for table in (
        "tenants",
        "cohorts",
        "memberships",
        "push_subscriptions",
        "agent_runs",
        "application_attempts",
        "user_sessions",
        "tailored_resumes",
        "platform_configs",
        "runtime_approvals",
        "digital_employees",
        "agent_tasks",
        "agent_task_attempts",
        "agent_router_events",
        "application_approvals",
        "submission_receipts",
        "agent_questions",
    ):
        assert table in sql
    assert "FOREACH table_name IN ARRAY" in sql
    assert "ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY" in sql
    assert "auth.uid() = user_id" in sql
    assert "is_tenant_member(tenant_id)" in sql
    assert "is_tenant_admin(tenant_id)" in sql
    assert "GRANT ALL ON public." in sql
    assert "TO PUBLIC" not in sql


def test_approval_schema_binds_expiry_and_all_submission_content():
    sql = APPROVAL_SQL.read_text()
    for column in ("job_url_sha256", "cover_letter_sha256", "form_fields_sha256", "expires_at", "consumed_at"):
        assert column in sql
    assert "decision = 'approved'" in sql
    assert "consumed_at IS NULL" in sql
    assert "expires_at TIMESTAMPTZ" in sql
    assert "expires_at > NOW()" in (ROOT / "backend/python/app/services/approval_gate.py").read_text()


def test_account_erasure_and_export_are_explicitly_bounded():
    source = ACCOUNT_GO.read_text()
    for table in (
        "agent_runs",
        "run_events",
        "run_controls",
        "delivery_ledger",
        "application_attempts",
        "user_sessions",
        "tailored_resumes",
        "platform_configs",
        "runtime_approvals",
        "digital_employees",
        "agent_tasks",
        "agent_task_attempts",
        "agent_router_events",
        "application_approvals",
        "submission_receipts",
        "agent_questions",
        "privacy_audit_log",
        "push_subscriptions",
    ):
        assert f"FROM {table}" in source or f"{table} WHERE" in source
    assert "schema_version" in source
    assert "maxExportRows" in source
    assert "maxExportBytes" in source
    assert "StatusRequestEntityTooLarge" in source
    main_source = (ROOT / "backend/python/app/main.py").read_text()
    assert "/api/v1/internal/account/purge" in main_source
    assert "control.revoke" in main_source
    assert "cancel_run" in main_source
    assert "scan_iter" in main_source
    assert "screenshot_paths" in main_source
