from unittest import mock

import pytest

from app.services.omnisave_service import OmnisaveService


@pytest.mark.asyncio
async def test_sync_ingests_captured_content_without_url_fetch():
    service = OmnisaveService()
    service.ingest_source = mock.AsyncMock(
        return_value={"success": True, "source": {"id": "captured-source"}}
    )
    service.list_user_saved_sources = mock.AsyncMock(
        return_value=[{"id": "captured-source"}]
    )

    result = await service.sync_agent_reach_posts(
        user_id="00000000-0000-0000-0000-000000000001",
        platforms=["medium"],
        source_items=[
            {
                "url": "https://medium.com/@candidate/important-reading",
                "title": "Important reading",
                "author": "Candidate",
                "platform": "medium",
                "content": "A visible excerpt captured from the saved reading list.",
            }
        ],
    )

    assert result["success"] is True
    assert result["count"] == 1
    service.ingest_source.assert_awaited_once_with(
        platform="medium",
        url="https://medium.com/@candidate/important-reading",
        title="Important reading",
        author="Candidate",
        raw_content="A visible excerpt captured from the saved reading list.",
        user_id="00000000-0000-0000-0000-000000000001",
        capture_origin="browser_capture",
    )


@pytest.mark.asyncio
async def test_sync_forwards_safe_media_metadata():
    service = OmnisaveService()
    service.ingest_source = mock.AsyncMock(
        return_value={"success": True, "source": {"id": "captured-source"}}
    )
    service.list_user_saved_sources = mock.AsyncMock(return_value=[])

    result = await service.sync_agent_reach_posts(
        user_id="00000000-0000-0000-0000-000000000001",
        platforms=["substack"],
        source_items=[
            {
                "url": "https://example.substack.com/p/post",
                "title": "Post",
                "author": "Author",
                "platform": "substack",
                "content": "Visible article content.",
                "media": [{"url": "https://cdn.example.com/post.png", "type": "image", "alt": "cover"}],
            }
        ],
    )

    assert result["success"] is True
    kwargs = service.ingest_source.await_args.kwargs
    assert kwargs["media"] == [{"url": "https://cdn.example.com/post.png", "type": "image", "alt": "cover"}]
