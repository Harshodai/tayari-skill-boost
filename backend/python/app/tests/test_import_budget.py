import asyncio

import pytest

from app.api import ai_routes


@pytest.mark.asyncio
async def test_job_import_limits_same_origin_concurrency(monkeypatch):
    active = 0
    maximum = 0

    async def fake_to_thread(_function, url):
        nonlocal active, maximum
        active += 1
        maximum = max(maximum, active)
        await asyncio.sleep(0.01)
        active -= 1
        return "Synthetic title", "Synthetic job description with enough content."

    monkeypatch.setattr(ai_routes, "_validate_public_url", lambda url: url)
    monkeypatch.setattr(ai_routes.asyncio, "to_thread", fake_to_thread)

    url = "https://budget.example.test/jobs/role"
    results = await asyncio.gather(
        *[
            ai_routes.import_job_description(
                ai_routes.JobDescriptionImportRequest(url=url)
            )
            for _ in range(5)
        ]
    )

    assert len(results) == 5
    assert maximum <= ai_routes.IMPORT_ORIGIN_CONCURRENCY
