from unittest import mock

import pytest

from app.services import approval_gate as gate


USER_ID = "00000000-0000-0000-0000-000000000001"
JOB = {
    "url": "https://jobs.example.test/roles/backend-engineer?ref=tayari#tracking",
    "title": "Backend Engineer",
    "company": "Example Test Co",
}
RESUME = "Alice Example\nPython | PostgreSQL\nBuilt safe systems."


class _Conn:
    def __init__(self, *fetchrow_results):
        self.fetchrow_results = list(fetchrow_results)
        self.fetches = []
        self.executes = []

    async def fetchrow(self, sql, *args):
        self.fetches.append((sql, args))
        if self.fetchrow_results:
            return self.fetchrow_results.pop(0)
        return None

    async def execute(self, sql, *args):
        self.executes.append((sql, args))
        return "INSERT 0 1"


class _Acquire:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *exc):
        return False


class _Pool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return _Acquire(self.conn)


@pytest.mark.asyncio
async def test_approval_without_job_url_fails_closed_without_database_lookup():
    with mock.patch("app.services.approval_gate.get_pool", new=mock.AsyncMock()) as get_pool:
        allowed = await gate.is_approved(USER_ID, "run-1", gate.resume_fingerprint(RESUME), job={})

    assert allowed is False
    get_pool.assert_not_awaited()


@pytest.mark.asyncio
async def test_expired_approval_is_rejected():
    conn = _Conn(None)
    pool = _Pool(conn)
    with mock.patch("app.services.approval_gate.get_pool", new=mock.AsyncMock(return_value=pool)):
        allowed = await gate.is_approved(
            USER_ID, "run-2", gate.resume_fingerprint(RESUME), job=JOB
        )

    assert allowed is False
    sql, args = conn.fetches[0]
    assert "expires_at > NOW()" in sql
    assert args[3] == gate.job_fingerprint(JOB["url"])
    assert args[4] == gate.cover_fingerprint(None)
    assert args[5] == gate.form_fields_fingerprint({})


@pytest.mark.asyncio
async def test_wrong_job_url_is_rejected_even_when_resume_hash_matches():
    conn = _Conn(None)
    pool = _Pool(conn)
    wrong_job = {**JOB, "url": "https://jobs.example.test/roles/other-role"}
    with mock.patch("app.services.approval_gate.get_pool", new=mock.AsyncMock(return_value=pool)):
        allowed = await gate.is_approved(
            USER_ID, "run-3", gate.resume_fingerprint(RESUME), job=wrong_job
        )

    assert allowed is False
    _, args = conn.fetches[0]
    assert args[2] == gate.resume_fingerprint(RESUME)
    assert args[3] == gate.job_fingerprint(wrong_job["url"])
    assert args[3] != gate.job_fingerprint(JOB["url"])
    assert args[4] == gate.cover_fingerprint(None)
    assert args[5] == gate.form_fields_fingerprint({})


@pytest.mark.asyncio
async def test_valid_approval_is_consumed_atomically():
    conn = _Conn({"id": "approval-1"})
    pool = _Pool(conn)
    with mock.patch("app.services.approval_gate.get_pool", new=mock.AsyncMock(return_value=pool)):
        consumed = await gate.is_approved(
            USER_ID,
            "run-4",
            gate.resume_fingerprint(RESUME),
            job=JOB,
            consume=True,
        )

    assert consumed is True
    sql, args = conn.fetches[0]
    assert "UPDATE application_approvals" in sql
    assert "SET decision = 'consumed'" in sql
    assert "RETURNING id" in sql
    assert "decision = 'approved'" in sql
    assert "consumed_at IS NULL" in sql
    assert args[:3] == (USER_ID, "run-4", gate.resume_fingerprint(RESUME))


@pytest.mark.asyncio
async def test_consumed_approval_cannot_be_replayed():
    conn = _Conn({"id": "approval-1"}, None)
    pool = _Pool(conn)
    with mock.patch("app.services.approval_gate.get_pool", new=mock.AsyncMock(return_value=pool)):
        first = await gate.is_approved(
            USER_ID,
            "run-5",
            gate.resume_fingerprint(RESUME),
            job=JOB,
            consume=True,
        )
        replay = await gate.is_approved(
            USER_ID,
            "run-5",
            gate.resume_fingerprint(RESUME),
            job=JOB,
            consume=True,
        )

    assert first is True
    assert replay is False
    assert len(conn.fetches) == 2
    assert all("UPDATE application_approvals" in sql for sql, _ in conn.fetches)


@pytest.mark.asyncio
async def test_request_approval_persists_exact_job_binding_and_expiry():
    conn = _Conn()
    pool = _Pool(conn)
    with mock.patch("app.services.approval_gate.get_pool", new=mock.AsyncMock(return_value=pool)):
        fingerprint = await gate.request_approval(USER_ID, "run-6", RESUME, JOB)

    assert fingerprint == gate.resume_fingerprint(RESUME)
    sql, args = conn.executes[0]
    assert "job_url_sha256" in sql
    assert "NOW() + INTERVAL '15 minutes'" in sql
    assert args[0:2] == (USER_ID, "run-6")
    assert args[2] == JOB["url"]
    assert args[7] == gate.job_fingerprint(JOB["url"])
    assert args[8] == gate.cover_fingerprint(None)
    assert args[9] == gate.form_fields_fingerprint({})
