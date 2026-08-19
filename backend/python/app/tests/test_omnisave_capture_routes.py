from __future__ import annotations

from unittest import mock

import pytest
from fastapi import HTTPException

from app.api.knowledge_hub import CaptureItemRequest, CaptureItemsRequest, CaptureRunRequest, create_capture_run, enqueue_capture_items, get_capture_run


USER_ID = "00000000-0000-0000-0000-0000000000aa"


@pytest.mark.asyncio
async def test_capture_run_requires_explicit_consent():
    payload = CaptureRunRequest(
        platform="medium",
        source_page_url="https://medium.com/me/readinglist",
        consent_acknowledged=False,
    )
    store = mock.Mock()
    store.create_run = mock.AsyncMock(side_effect=ValueError("capture_consent_required"))
    with mock.patch("app.api.knowledge_hub.get_omnisave_capture_store", return_value=store):
        with pytest.raises(HTTPException) as captured:
            await create_capture_run(payload, USER_ID)
    assert captured.value.status_code == 422
    assert captured.value.detail == "capture_consent_required"
    store.create_run.assert_awaited_once()


@pytest.mark.asyncio
async def test_capture_run_create_forwards_owner_and_scope():
    payload = CaptureRunRequest(
        platform="substack",
        source_page_url="https://example.substack.com/home",
        trigger_type="extension",
        requested_limit=100,
        consent_acknowledged=True,
    )
    expected = {"id": "run-1", "user_id": USER_ID, "platform": "substack", "status": "queued"}
    store = mock.Mock()
    store.create_run = mock.AsyncMock(return_value=expected)
    with mock.patch("app.api.knowledge_hub.get_omnisave_capture_store", return_value=store):
        result = await create_capture_run(payload, USER_ID)
    assert result == {"success": True, "run": expected}
    store.create_run.assert_awaited_once_with(
        USER_ID,
        platform="substack",
        source_page_url="https://example.substack.com/home",
        trigger_type="extension",
        requested_limit=100,
        consent_acknowledged=True,
    )


@pytest.mark.asyncio
async def test_capture_run_get_is_owner_scoped_by_service_contract():
    expected = {"id": "run-1", "user_id": USER_ID, "status": "running"}
    store = mock.Mock()
    store.get_run = mock.AsyncMock(return_value=expected)
    with mock.patch("app.api.knowledge_hub.get_omnisave_capture_store", return_value=store):
        result = await get_capture_run("run-1", USER_ID)
    assert result == {"success": True, "run": expected}
    store.get_run.assert_awaited_once_with(USER_ID, "run-1")


@pytest.mark.asyncio
async def test_capture_items_wrapper_payload_is_supported():
    store = mock.Mock()
    store.enqueue_items = mock.AsyncMock(return_value={"inserted": 1, "discovered": 1})
    payload = CaptureItemsRequest(items=[CaptureItemRequest(url="https://medium.com/@jobtayari/post", platform="medium", content="visible")])
    with mock.patch("app.api.knowledge_hub.get_omnisave_capture_store", return_value=store):
        result = await enqueue_capture_items("run-1", payload, USER_ID)
    assert result == {"success": True, "result": {"inserted": 1, "discovered": 1}}
    store.enqueue_items.assert_awaited_once()


@pytest.mark.asyncio
async def test_capture_run_get_hides_missing_owner_data():
    store = mock.Mock()
    store.get_run = mock.AsyncMock(side_effect=KeyError("capture_run_not_found"))
    with mock.patch("app.api.knowledge_hub.get_omnisave_capture_store", return_value=store):
        with pytest.raises(HTTPException) as captured:
            await get_capture_run("run-1", USER_ID)
    assert captured.value.status_code == 404
    assert captured.value.detail == "capture_run_not_found"
