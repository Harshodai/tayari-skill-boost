from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
WORKER = REPO_ROOT / "backend" / "python" / "app" / "tasks" / "task_control.py"
GO_ROUTES = REPO_ROOT / "backend" / "go" / "internal" / "api" / "routes_tasks.go"
LEASE_MIGRATION = REPO_ROOT / "backend" / "db" / "migrations" / "20260821_03_task_control_leases.sql"
CLOUD_TASK_MIGRATION = REPO_ROOT / "supabase" / "migrations" / "20260821000000_task_control_plane.sql"


def test_worker_has_expiring_owner_lease_and_reclaim_event():
    source = WORKER.read_text(encoding="utf-8")
    assert "LEASE_SECONDS = 900" in source
    assert "lease_expires_at < now()" in source
    assert "task.execution.reclaimed" in source
    assert "lease_owner=NULL" in source
    assert "lease_expires_at=NULL" in source


def test_plan_route_rejects_tools_outside_candidate_runtime():
    source = GO_ROUTES.read_text(encoding="utf-8")
    assert 'step.Tool != "candidate_context.read"' in source
    assert "candidate_context.read must use risk_tier read" in source


def test_cloud_task_control_schema_precedes_artifacts_and_leases():
    sql = CLOUD_TASK_MIGRATION.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS public.task_runs" in sql
    assert "CREATE TABLE IF NOT EXISTS public.task_plans" in sql
    assert "ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY" in sql


def test_lease_migration_is_idempotent_and_indexed():
    sql = LEASE_MIGRATION.read_text(encoding="utf-8")
    assert "ADD COLUMN IF NOT EXISTS lease_owner" in sql
    assert "ADD COLUMN IF NOT EXISTS lease_expires_at" in sql
    assert "ADD COLUMN IF NOT EXISTS attempt_count" in sql
    assert "idx_task_runs_lease_recovery" in sql
