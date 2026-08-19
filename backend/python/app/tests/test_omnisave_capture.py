from __future__ import annotations

from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest

from app.services import omnisave_capture
from app.services.omnisave_capture import OmniSaveCaptureStore, _bounded_media, _canonical_url


class FakeConn:
    def __init__(self, row=None, execute_result="INSERT 0 1"):
        self.row = row
        self.execute_result = execute_result
        self.calls = []

    async def fetchrow(self, query, *args):
        self.calls.append(("fetchrow", query, args))
        return self.row

    async def fetchval(self, query, *args):
        self.calls.append(("fetchval", query, args))
        return False

    async def fetch(self, query, *args):
        self.calls.append(("fetch", query, args))
        return []

    async def execute(self, query, *args):
        self.calls.append(("execute", query, args))
        return self.execute_result


class FakePool:
    def __init__(self, conn):
        self.conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self.conn


def _run_row():
    return {
        "id": "00000000-0000-0000-0000-000000000010",
        "platform": "medium",
        "source_page_url": "https://medium.com/me/readinglist",
        "trigger_type": "manual",
        "status": "queued",
        "requested_limit": 250,
        "page_cursor": None,
        "page_count": 0,
        "discovered_count": 0,
        "imported_count": 0,
        "skipped_count": 0,
        "failed_count": 0,
        "checkpoint": {},
        "last_error": None,
        "cancel_requested_at": None,
        "heartbeat_at": None,
        "lease_until": None,
        "started_at": None,
        "completed_at": None,
        "created_at": None,
        "updated_at": None,
    }


def test_canonical_url_strips_fragment_and_requires_https():
    assert _canonical_url("HTTPS://Medium.com/@a/post#comments") == "https://medium.com/@a/post"
    with pytest.raises(ValueError, match="https_url_required"):
        _canonical_url("http://medium.com/@a/post")


def test_media_metadata_rejects_unsafe_urls_and_bounds_fields():
    result = _bounded_media(
        [
            {"url": "javascript:alert(1)", "type": "script"},
            {"url": "https://cdn.example.com/a.jpg", "type": "image", "alt": "cover"},
        ]
    )
    assert result == [{"url": "https://cdn.example.com/a.jpg", "type": "image", "alt": "cover", "width": None, "height": None}]


@pytest.mark.asyncio
async def test_create_run_requires_explicit_consent():
    store = OmniSaveCaptureStore()
    with pytest.raises(ValueError, match="capture_consent_required"):
        await store.create_run(
            "00000000-0000-0000-0000-000000000001",
            platform="medium",
            source_page_url="https://medium.com/me/readinglist",
        )


@pytest.mark.asyncio
async def test_create_run_persists_owner_and_capture_scope(monkeypatch):
    conn = FakeConn(row=_run_row())
    monkeypatch.setattr(omnisave_capture, "get_pool", lambda: _async_value(FakePool(conn)))
    store = OmniSaveCaptureStore()
    result = await store.create_run(
        "00000000-0000-0000-0000-000000000001",
        platform="medium",
        source_page_url="https://medium.com/me/readinglist#saved",
        trigger_type="extension",
        requested_limit=100,
        consent_acknowledged=True,
    )
    assert result["platform"] == "medium"
    assert result["source_page_url"] == "https://medium.com/me/readinglist"
    query, args = conn.calls[0][1], conn.calls[0][2]
    assert "user_id" in query
    assert str(args[0]) == "00000000-0000-0000-0000-000000000001"
    assert args[1:] == ("medium", "https://medium.com/me/readinglist", "extension", 100)


@pytest.mark.asyncio
async def test_enqueue_items_is_idempotent_and_keeps_media_metadata(monkeypatch):
    conn = FakeConn(row={"platform": "substack", "requested_limit": 10, "status": "queued"})
    monkeypatch.setattr(omnisave_capture, "get_pool", lambda: _async_value(FakePool(conn)))
    store = OmniSaveCaptureStore()
    result = await store.enqueue_items(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000010",
        [
            {
                "url": "https://example.substack.com/p/post#reply",
                "platform": "substack",
                "title": "Post",
                "media": [{"url": "https://cdn.example.com/post.png", "type": "image"}],
            },
            {
                "url": "https://example.substack.com/p/post",
                "platform": "substack",
                "title": "Duplicate",
            },
        ],
    )
    assert result == {"discovered": 2, "inserted": 2}
    insert_calls = [call for call in conn.calls if call[0] == "execute" and "INSERT INTO public.omnisave_capture_items" in call[1]]
    assert len(insert_calls) == 2
    assert '"url": "https://cdn.example.com/post.png"' in insert_calls[0][2][-1]


async def _async_value(value):
    return value


@pytest.mark.asyncio
async def test_enqueue_items_rejects_cross_platform_host(monkeypatch):
    conn = FakeConn(row={"platform": "medium", "requested_limit": 10, "status": "queued"})
    monkeypatch.setattr(omnisave_capture, "get_pool", lambda: _async_value(FakePool(conn)))
    store = OmniSaveCaptureStore()
    with pytest.raises(ValueError, match="capture_item_platform_mismatch"):
        await store.enqueue_items(
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000010",
            [{"url": "https://example.substack.com/p/not-medium", "platform": "medium"}],
        )
