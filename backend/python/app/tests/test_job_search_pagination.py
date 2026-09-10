from unittest.mock import AsyncMock, patch
import pytest

from app.services.job_providers import search_jobs


@pytest.mark.asyncio
async def test_search_jobs_pagination_dict():
    mock_jobs = [
        {"title": f"Job {i}", "company": f"Company {i}", "location": "Remote", "url": f"http://{i}"}
        for i in range(10)
    ]
    with patch("app.services.job_providers._call_provider", new_callable=AsyncMock) as mock_cp:
        # First provider returns the 10 jobs, others empty
        mock_cp.side_effect = [mock_jobs] + [[] for _ in range(10)]

        # Page 1: limit 3, cursor 0
        res = await search_jobs(query="dev", location="remote", limit=3, cursor=0)
        assert isinstance(res, dict)
        assert len(res["results"]) == 3
        assert res["next_cursor"] == 3
        assert res["total"] == 10

        # Page 2: limit 3, cursor 3
        mock_cp.side_effect = [mock_jobs] + [[] for _ in range(10)]
        res2 = await search_jobs(query="dev", location="remote", limit=3, cursor=3)
        assert isinstance(res2, dict)
        assert len(res2["results"]) == 3
        assert res2["next_cursor"] == 6

        # Last page: cursor 9, limit 3
        mock_cp.side_effect = [mock_jobs] + [[] for _ in range(10)]
        res_last = await search_jobs(query="dev", location="remote", limit=3, cursor=9)
        assert isinstance(res_last, dict)
        assert len(res_last["results"]) == 1
        assert res_last["next_cursor"] is None


@pytest.mark.asyncio
async def test_search_jobs_backward_compatibility_list():
    mock_jobs = [
        {"title": f"Job {i}", "company": f"Company {i}", "location": "Remote", "url": f"http://{i}"}
        for i in range(5)
    ]
    with patch("app.services.job_providers._call_provider", new_callable=AsyncMock) as mock_cp:
        mock_cp.side_effect = [mock_jobs] + [[] for _ in range(10)]
        # Caller expecting raw list with cursor=None, return_dict=False
        res = await search_jobs(query="dev", limit=3, cursor=None, return_dict=False)
        assert isinstance(res, list)
        assert len(res) == 3


@pytest.mark.asyncio
async def test_smart_search_pagination():
    from app.services.job_agent import smart_search

    mock_batch = [
        {"job_id": f"job-{i}", "title": f"Engineer {i}", "company": f"Tech {i}", "location": "Remote", "url": f"http://{i}", "description": "code"}
        for i in range(15)
    ]

    with patch("app.services.job_agent.search_jobs", new_callable=AsyncMock) as mock_sj, \
         patch("app.services.job_agent.rank_jobs", new_callable=AsyncMock) as mock_rj, \
         patch("app.services.job_agent.annotate_jobs_with_ats", new_callable=AsyncMock) as mock_ann:

        mock_sj.return_value = {"results": mock_batch, "total": len(mock_batch), "next_cursor": None}
        mock_rj.side_effect = lambda candidate, jobs, top_n: [
            {**j, "match_score": 85 - idx} for idx, j in enumerate(jobs[:top_n])
        ]
        mock_ann.side_effect = lambda jobs: jobs

        res = await smart_search(
            query="developer",
            location="Remote",
            profile=None,
            resume_text=None,
            top_n=5,
            cursor=0,
            limit=5,
        )

        assert isinstance(res, dict)
        assert "results" in res
        assert "next_cursor" in res
        assert len(res["results"]) <= 5
        assert res["total"] >= len(res["results"])
