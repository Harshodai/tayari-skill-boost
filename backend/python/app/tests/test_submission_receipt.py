"""Tests for submission receipts: prepared receipts must not claim a
submission, and failed receipts carry a sanitized, persisted failure_reason."""
import json
from unittest import mock

import pytest

from app.services import submission_receipt as sr

JOB = {
    "url": "https://boards.greenhouse.io/acme/jobs/123",
    "title": "Senior Engineer",
    "company": "Acme",
}


def test_build_prepared_receipt_does_not_claim_submission():
    receipt = sr.build_prepared_receipt(
        run_id="r1",
        user_id="u1",
        job=JOB,
        resume_text="abc",
    )
    assert receipt["outcome"] == "prepared"
    assert receipt["submitted_resume_sha256"] is None
    assert receipt["submitted_resume_text"] is None
    assert receipt["prepared_resume_sha256"] == sr.resume_fingerprint("abc")
    assert receipt["prepared_resume_text"] == "abc"


"""Tests for submission receipts: prepared receipts must not claim a
submission, and failed receipts carry an allowlisted, persisted failure_reason."""
import json
from unittest import mock

import pytest

from app.services import submission_receipt as sr

JOB = {
    "url": "https://boards.greenhouse.io/acme/jobs/123",
    "title": "Senior Engineer",
    "company": "Acme",
}


def test_build_prepared_receipt_does_not_claim_submission():
    receipt = sr.build_prepared_receipt(
        run_id="r1",
        user_id="u1",
        job=JOB,
        resume_text="abc",
    )
    assert receipt["outcome"] == "prepared"
    assert receipt["submitted_resume_sha256"] is None
    assert receipt["submitted_resume_text"] is None
    assert receipt["prepared_resume_sha256"] == sr.resume_fingerprint("abc")
    assert receipt["prepared_resume_text"] == "abc"


def test_build_failed_receipt_maps_known_category_to_approved_message():
    receipt = sr.build_failed_receipt(
        run_id="r2",
        user_id="u2",
        job=JOB,
        resume_text="abc",
        error="RuntimeError('boom')\nTraceback (most recent call last):\n  File \"/srv/app.py\", line 1",
    )
    assert receipt["outcome"] == "failed"
    # No portion of the raw error is persisted in failure_reason — only an
    # approved allowlisted message. "RuntimeError('boom')" matches no category,
    # so the generic fallback is returned.
    assert receipt["failure_reason"] == sr._FAILURE_FALLBACK
    assert "RuntimeError" not in receipt["failure_reason"]
    assert "Traceback" not in receipt["failure_reason"]
    assert "/srv/app.py" not in receipt["failure_reason"]
    # raw diagnostic retained for server logs only (not persisted by save_receipt)
    assert "Traceback" in receipt["_error"]


def test_build_failed_receipt_timeout_category_maps_approved():
    receipt = sr.build_failed_receipt(
        run_id="r2b",
        user_id="u2",
        job=JOB,
        resume_text="abc",
        error="Connection timed out",
    )
    assert receipt["failure_reason"] == "The application step timed out. Try again, or submit manually."


def test_build_failed_receipt_category_from_agent_summary_with_error_present():
    # A known condition that only shows up in agent_summary must still be
    # detected when error is present (both sources are combined, not OR-ed
    # with error winning).
    receipt = sr.build_failed_receipt(
        run_id="r2d",
        user_id="u2",
        job=JOB,
        resume_text="abc",
        error="Some unrelated failure",
        agent_summary="aborted by linkedin_automation_blocked policy",
    )
    assert "LinkedIn automation is not permitted" in receipt["failure_reason"]


def test_build_failed_receipt_linkedin_category_maps_approved():
    receipt = sr.build_failed_receipt(
        run_id="r2c",
        user_id="u2",
        job=JOB,
        resume_text="abc",
        error="linkedin_automation_blocked",
    )
    assert "LinkedIn automation is not permitted by policy" in receipt["failure_reason"]


def test_build_failed_receipt_fallback_when_no_diagnostic():
    fallback = sr.build_failed_receipt(run_id="r3", user_id="u3", job=JOB, resume_text=None)
    assert fallback["failure_reason"] == sr._FAILURE_FALLBACK


class _FakeConn:
    def __init__(self):
        self.executed = None

    async def execute(self, sql, *args):
        self.executed = (sql, args)
        return "OK"


class _FakePool:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def acquire(self):
        return _PoolCtx(self._conn)


class _PoolCtx:
    def __init__(self, conn):
        self._conn = conn

    async def __aenter__(self):
        return self._conn

    async def __aexit__(self, *exc):
        return False


@pytest.mark.asyncio
async def test_save_receipt_persists_failure_reason_in_answers():
    conn = _FakeConn()
    pool = _FakePool(conn)
    receipt = sr.build_failed_receipt(
        run_id="r4",
        user_id="u4",
        job=JOB,
        resume_text="abc",
        error="Connection timed out",
        answers={"existing": "kept"},
    )
    with mock.patch("app.services.submission_receipt.get_pool", new=mock.AsyncMock(return_value=pool)):
        saved = await sr.save_receipt(receipt)
    assert saved is True
    assert conn.executed is not None
    sql, args = conn.executed
    assert "INSERT INTO submission_receipts" in sql
    answers_arg = args[13]  # $14::jsonb
    persisted = json.loads(answers_arg)
    # the allowlisted timeout message is persisted, not the raw error text
    assert persisted["_failure_reason"] == "The application step timed out. Try again, or submit manually."
    assert "Connection timed out" not in persisted["_failure_reason"]
    assert persisted["existing"] == "kept"


@pytest.mark.asyncio
async def test_save_receipt_persists_prepared_resume_in_answers():
    conn = _FakeConn()
    pool = _FakePool(conn)
    receipt = sr.build_prepared_receipt(
        run_id="r6",
        user_id="u6",
        job=JOB,
        resume_text="prepared resume body",
    )
    with mock.patch("app.services.submission_receipt.get_pool", new=mock.AsyncMock(return_value=pool)):
        saved = await sr.save_receipt(receipt)
    assert saved is True
    sql, args = conn.executed
    assert "INSERT INTO submission_receipts" in sql
    # the prepared resume survives storage via the jsonb answers column
    persisted = json.loads(args[13])  # $14::jsonb
    assert persisted["_prepared_resume_sha256"] == sr.resume_fingerprint("prepared resume body")
    assert persisted["_prepared_resume_text"] == "prepared resume body"
    # reload: a reader of the answers column retains both prepared fields
    assert persisted["_prepared_resume_sha256"] == receipt["prepared_resume_sha256"]
    assert persisted["_prepared_resume_text"] == receipt["prepared_resume_text"]
    # submitted_* stay None in the row itself — the resume was never submitted
    assert args[11] is None  # $12 submitted_resume_sha256
    assert args[12] is None  # $13 submitted_resume_text


@pytest.mark.asyncio
async def test_save_receipt_non_failed_answers_untouched():
    conn = _FakeConn()
    pool = _FakePool(conn)
    receipt = {
        "run_id": "r5",
        "user_id": "u5",
        "job_url": JOB["url"],
        "job_title": JOB["title"],
        "company": JOB["company"],
        "ats_vendor": "greenhouse",
        "submitted_at": None,
        "verified": False,
        "confirmation_text": None,
        "confirmation_number": None,
        "screenshot_path": None,
        "submitted_resume_sha256": None,
        "submitted_resume_text": None,
        "answers": {"a": 1},
        "outcome": "prepared",
        "failure_reason": "should not leak",
    }
    with mock.patch("app.services.submission_receipt.get_pool", new=mock.AsyncMock(return_value=pool)):
        saved = await sr.save_receipt(receipt)
    assert saved is True
    persisted = json.loads(conn.executed[1][13])
    assert persisted == {"a": 1}


def test_failure_classification_ignores_corporate_substring():
    # "corporate" contains "rate" as an incidental substring — it must not
    # map to the rate-limit category.
    receipt = sr.build_failed_receipt(
        run_id="r8",
        user_id="u8",
        job=JOB,
        resume_text="abc",
        error="Chrome crashed",
        agent_summary="the corporate policy review blocked the attempt",
    )
    assert receipt["failure_reason"] == sr._FAILURE_FALLBACK


def test_failure_classification_ignores_author_substring():
    # "author" contains "auth" as an incidental substring — it must not map
    # to the authentication category.
    receipt = sr.build_failed_receipt(
        run_id="r8b",
        user_id="u8",
        job=JOB,
        resume_text="abc",
        error="Browser disconnected",
        agent_summary="the author of the posting was not reachable",
    )
    assert receipt["failure_reason"] == sr._FAILURE_FALLBACK


def test_failure_classification_authentication_matches():
    receipt = sr.build_failed_receipt(
        run_id="r8c",
        user_id="u8",
        job=JOB,
        resume_text="abc",
        error="Authentication failed for the applicant portal",
    )
    assert "login" in receipt["failure_reason"]


def test_failure_classification_auth_word_matches():
    receipt = sr.build_failed_receipt(
        run_id="r8d",
        user_id="u8",
        job=JOB,
        resume_text="abc",
        error="auth failed on the portal",
    )
    assert "login" in receipt["failure_reason"]


def test_failure_classification_rate_limit_matches():
    receipt = sr.build_failed_receipt(
        run_id="r8e",
        user_id="u8",
        job=JOB,
        resume_text="abc",
        error="rate limit exceeded",
    )
    assert "rate limit" in receipt["failure_reason"]


@pytest.mark.asyncio
async def test_save_receipt_none_prepared_resume_drops_stale_reserved_keys():
    # A prepared receipt with no resume must not leave stale
    # _prepared_resume_* values from an earlier attempt in the answers —
    # the conditional writes skip None values, so stale keys must be
    # removed before them, not just overwritten.
    conn = _FakeConn()
    pool = _FakePool(conn)
    receipt = {
        "run_id": "r9",
        "user_id": "u9",
        "job_url": JOB["url"],
        "job_title": JOB["title"],
        "company": JOB["company"],
        "ats_vendor": "workday",
        "submitted_at": None,
        "verified": False,
        "confirmation_text": None,
        "confirmation_number": None,
        "screenshot_path": None,
        "submitted_resume_sha256": None,
        "submitted_resume_text": None,
        "answers": {
            "_prepared_resume_sha256": "stale-hash",
            "_prepared_resume_text": "stale text",
        },
        "outcome": "prepared",
    }
    with mock.patch("app.services.submission_receipt.get_pool", new=mock.AsyncMock(return_value=pool)):
        saved = await sr.save_receipt(receipt)
    assert saved is True
    persisted = json.loads(conn.executed[1][13])
    assert "_prepared_resume_sha256" not in persisted
    assert "_prepared_resume_text" not in persisted


@pytest.mark.asyncio
async def test_debit_submission_credit_verified():
    with mock.patch("httpx.AsyncClient.post", new_callable=mock.AsyncMock) as mock_post:
        mock_resp = mock.Mock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"status": "success", "debited": 1, "balance": {"balance": 9}}
        mock_post.return_value = mock_resp

        result = await sr.debit_submission_credit(
            user_id="user_123",
            run_id="run_456",
            job_title="Software Engineer",
            company="Acme Corp",
            verified=True,
        )

        assert result["status"] == "debited"
        assert result["charged"] == 1
        assert mock_post.call_count == 1
        call_kwargs = mock_post.call_args[1]
        payload = call_kwargs["json"]
        assert payload["user_id"] == "user_123"
        assert payload["amount"] == 1
        assert payload["verified"] is True


@pytest.mark.asyncio
async def test_debit_submission_credit_unverified_zero_charge():
    with mock.patch("httpx.AsyncClient.post", new_callable=mock.AsyncMock) as mock_post:
        result = await sr.debit_submission_credit(
            user_id="user_123",
            run_id="run_456",
            job_title="Software Engineer",
            company="Acme Corp",
            verified=False,
        )

        assert result["status"] == "no_charge"
        assert result["charged"] == 0
        assert mock_post.call_count == 0


@pytest.mark.asyncio
async def test_save_receipt_triggers_debit_when_verified():
    conn = _FakeConn()
    pool = _FakePool(conn)

    verified_receipt = {
        "run_id": "r_ver_1",
        "user_id": "u_ver_1",
        "job_url": JOB["url"],
        "job_title": JOB["title"],
        "company": JOB["company"],
        "ats_vendor": "greenhouse",
        "submitted_at": "2026-08-16T12:00:00Z",
        "verified": True,
        "confirmation_text": "Thank you for applying",
        "confirmation_number": "CONF-12345",
        "screenshot_path": "/tmp/screenshot.png",
        "submitted_resume_sha256": "sha256...",
        "submitted_resume_text": "resume content",
        "answers": {},
        "outcome": "submitted",
    }

    with mock.patch("app.services.submission_receipt.get_pool", new=mock.AsyncMock(return_value=pool)), \
         mock.patch("app.services.submission_receipt.debit_submission_credit", new_callable=mock.AsyncMock) as mock_debit:
        mock_debit.return_value = {"status": "debited", "charged": 1}
        saved = await sr.save_receipt(verified_receipt)

    assert saved is True
    assert mock_debit.call_count == 1
    assert mock_debit.call_args[1]["user_id"] == "u_ver_1"
    assert mock_debit.call_args[1]["verified"] is True
