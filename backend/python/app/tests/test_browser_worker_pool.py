"""Unit and security tests for WP-04: Live Isolated Browser Worker Pool."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.browser_worker_pool import (
    validate_ats_url,
    DomainForbiddenError,
    detect_sensitive_field,
    scan_html_for_sensitive_fields,
    terminate_worker,
    create_worker,
    get_worker,
    compute_receipt_hash,
    ALLOWLISTED_ATS_DOMAINS,
)


def test_validate_ats_url_greenhouse_allowed():
    """Verify boards.greenhouse.io is allowed."""
    valid_url = "https://boards.greenhouse.io/acme/jobs/12345"
    assert validate_ats_url(valid_url) == valid_url


def test_validate_ats_url_non_allowlisted_rejected_with_403():
    """Verify non-allowlisted domains are rejected with 403 Forbidden before browser start."""
    disallowed_urls = [
        "https://evil.com/phish",
        "https://myworkdayjobs.com/company/job/1",
        "https://lever.co/company/job/2",
        "http://localhost:8080/admin",
        "https://attacker-controlled.net",
    ]
    for url in disallowed_urls:
        with pytest.raises(DomainForbiddenError) as exc_info:
            validate_ats_url(url)
        assert exc_info.value.status_code == 403
        assert "not allowlisted" in exc_info.value.detail


def test_detect_sensitive_field_patterns():
    """Verify all sensitive keywords and patterns are detected."""
    sensitive_labels = [
        "Please enter your password",
        "Social Security Number (SSN)",
        "Desired Annual Salary ($)",
        "Will you now or in the future require visa sponsorship?",
        "Equal Employment Opportunity (EEO) voluntary self-identification",
        "Please complete the Captcha to verify you are human",
        "Race / Ethnicity",
        "Do you have a physical or mental disability?",
        "Veteran Status: Are you a protected veteran?",
    ]
    for label in sensitive_labels:
        matched = detect_sensitive_field(label)
        assert matched is not None, f"Failed to detect sensitive pattern in: {label}"

    clean_labels = [
        "First Name",
        "Last Name",
        "Email Address",
        "Phone Number",
        "Resume / CV attachment",
        "LinkedIn Profile URL",
        "GitHub URL",
    ]
    for label in clean_labels:
        assert detect_sensitive_field(label) is None


def test_scan_html_for_sensitive_fields():
    """Verify scanning raw HTML identifies sensitive inputs."""
    html_with_sensitive = """
    <form>
        <label for="name">Name</label>
        <input id="name" type="text" />
        <label for="comp">Expected Salary</label>
        <input id="comp" type="text" />
    </form>
    """
    res = scan_html_for_sensitive_fields(html_with_sensitive)
    assert res is not None
    assert "salary" in res["keyword"]

    clean_html = """
    <form>
        <label for="name">Full Name</label>
        <input id="name" type="text" />
        <label for="email">Email</label>
        <input id="email" type="email" />
    </form>
    """
    assert scan_html_for_sensitive_fields(clean_html) is None


def test_compute_receipt_hash():
    """Verify receipt hashing generates deterministic SHA256."""
    text = "Thank you for applying to Acme Corp. Application ID: 12345"
    h1 = compute_receipt_hash(text)
    h2 = compute_receipt_hash(text)
    assert h1 == h2
    assert len(h1) == 64


@pytest.mark.asyncio
async def test_terminate_worker_kills_within_bound():
    """Verify terminate_worker enforces strict cancellation within 5s timeout and cleans up."""
    import asyncio
    run_id = "test-run-12345"
    user_id = "00000000-0000-0000-0000-000000000001"
    worker = await create_worker(
        run_id=run_id,
        user_id=user_id,
        target_url="https://boards.greenhouse.io/acme/jobs/12345",
    )
    assert get_worker(run_id) is not None

    # Bound the close mock so terminate_worker cannot hang indefinitely
    async def _delayed_close(*args, **kwargs):
        await asyncio.sleep(10.0)  # simulate hanging close

    worker.close = AsyncMock(side_effect=_delayed_close)

    # Verify terminate_worker bounds the hanging close within the hard-kill deadline
    res = await asyncio.wait_for(terminate_worker(run_id, owner_id=user_id), timeout=6.0)
    assert res is True
    assert get_worker(run_id) is None
    worker.close.assert_awaited_once()


def test_docker_runtime_raises_at_worker_start():
    import os
    from app.services.browser_worker_pool import BrowserWorker
    from app.services.computer_docker_runtime import ComputerRuntimeUnavailable

    old = os.getenv("COMPUTER_RUNTIME")
    os.environ["COMPUTER_RUNTIME"] = "docker"
    try:
        try:
            BrowserWorker(run_id="r-docker", user_id="u1", target_url="https://boards.greenhouse.io/a/b")
        except ComputerRuntimeUnavailable as exc:
            assert "docker exec bridge not yet wired" in str(exc)
        else:
            raise AssertionError("expected ComputerRuntimeUnavailable for docker runtime")
    finally:
        if old is None:
            os.environ.pop("COMPUTER_RUNTIME", None)
        else:
            os.environ["COMPUTER_RUNTIME"] = old


def test_emit_hook_holds_strong_refs_across_gc():
    import asyncio
    import gc
    from unittest.mock import AsyncMock, patch
    from app.services import browser_worker_pool as pool_mod
    from app.services.browser_worker_pool import BrowserWorker

    async def _run():
        worker = BrowserWorker(run_id="r-gc", user_id="u1", target_url="https://boards.greenhouse.io/a/b")
        with patch("app.services.computer_replay.append_computer_event", new=AsyncMock()) as mock_append:
            worker.emit_event("action", {"action": "navigate"})
            gc.collect()
            await asyncio.sleep(0)
            gc.collect()
            for _ in range(20):
                await asyncio.sleep(0)
                if mock_append.await_count:
                    break
            assert mock_append.await_count == 1
            assert pool_mod._REPLAY_TASKS is not None
        await worker.close()

    asyncio.run(_run())


def test_worker_registry_namespaced_by_user():
    import asyncio

    async def _run():
        from app.services.browser_worker_pool import cleanup_all_workers
        await cleanup_all_workers()
        w1 = await create_worker(run_id="same-run", user_id="user-a", target_url="https://boards.greenhouse.io/a/b")
        w2 = await create_worker(run_id="same-run", user_id="user-b", target_url="https://boards.greenhouse.io/a/b")
        assert w1 is not w2
        assert get_worker("same-run", user_id="user-a") is w1
        assert get_worker("same-run", user_id="user-b") is w2
        assert get_worker("same-run") in (w1, w2)
        await cleanup_all_workers()

    asyncio.run(_run())

