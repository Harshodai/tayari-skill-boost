from __future__ import annotations

import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.event_bus import (
    close_redis,
    consume_events,
    get_redis,
    publish_event,
)


@pytest.mark.asyncio
async def test_publish_event_success():
    mock_redis = AsyncMock()
    mock_redis.xadd.return_value = "1725900000000-0"

    with patch("app.services.event_bus.get_redis", return_value=mock_redis):
        data = {"user_id": "usr_test_123", "resume_id": "res_abc_456"}
        event_id = await publish_event("tayari:events", "resume.optimized", data)

        assert event_id == "1725900000000-0"
        mock_redis.xadd.assert_called_once()

        call_args = mock_redis.xadd.call_args
        stream_arg = call_args[0][0]
        payload_arg = call_args[0][1]
        kwargs = call_args[1]

        assert stream_arg == "tayari:events"
        assert kwargs.get("maxlen") == 10000
        assert payload_arg["type"] == "resume.optimized"

        # Check timestamp is ISO UTC
        ts = payload_arg["timestamp"]
        parsed_dt = datetime.fromisoformat(ts)
        assert parsed_dt is not None

        # Check JSON serialization of data
        serialized_data = payload_arg["data"]
        assert isinstance(serialized_data, str)
        assert json.loads(serialized_data) == data


@pytest.mark.asyncio
async def test_publish_event_graceful_when_redis_is_down():
    mock_redis = AsyncMock()
    mock_redis.xadd.side_effect = ConnectionError("Could not connect to Redis at 127.0.0.1:6379")

    with patch("app.services.event_bus.get_redis", return_value=mock_redis):
        # Must not raise to caller
        event_id = await publish_event(
            "tayari:events",
            "resume.optimized",
            {"user_id": "usr_test"},
        )
        assert event_id == ""


@pytest.mark.asyncio
async def test_publish_event_graceful_when_client_is_none():
    with patch("app.services.event_bus.get_redis", return_value=None):
        event_id = await publish_event(
            "tayari:events",
            "resume.optimized",
            {"user_id": "usr_test"},
        )
        assert event_id == ""


@pytest.mark.asyncio
async def test_consume_events_processing_and_xack():
    mock_redis = AsyncMock()
    mock_redis.xgroup_create.return_value = True

    event_payload = {
        "type": "resume.optimized",
        "data": json.dumps({"user_id": "u1", "resume_id": "r1"}),
        "timestamp": "2026-09-10T00:00:00Z",
    }
    mock_redis.xreadgroup.return_value = [
        ["tayari:events", [("1725900000000-0", event_payload)]],
    ]
    mock_redis.xack.return_value = 1

    mock_handler = AsyncMock()

    with patch("app.services.event_bus.get_redis", return_value=mock_redis):
        processed = await consume_events(
            stream="tayari:events",
            group="test_group",
            consumer="test_worker_1",
            handler=mock_handler,
            count=5,
            block=1000,
        )

        assert processed == 1
        mock_redis.xgroup_create.assert_called_once_with(
            "tayari:events",
            "test_group",
            id="0",
            mkstream=True,
        )
        mock_redis.xreadgroup.assert_called_once_with(
            groupname="test_group",
            consumername="test_worker_1",
            streams={"tayari:events": ">"},
            count=5,
            block=1000,
        )
        mock_handler.assert_called_once_with("1725900000000-0", event_payload)
        mock_redis.xack.assert_called_once_with("tayari:events", "test_group", "1725900000000-0")


@pytest.mark.asyncio
async def test_consume_events_handles_existing_group():
    mock_redis = AsyncMock()
    mock_redis.xgroup_create.side_effect = Exception("BUSYGROUP Consumer Group name already exists")
    mock_redis.xreadgroup.return_value = []

    handler = MagicMock()

    with patch("app.services.event_bus.get_redis", return_value=mock_redis):
        processed = await consume_events(
            stream="tayari:events",
            group="existing_group",
            consumer="worker_1",
            handler=handler,
        )
        assert processed == 0
        handler.assert_not_called()


@pytest.mark.asyncio
async def test_consume_events_handler_error_does_not_xack():
    mock_redis = AsyncMock()
    event_payload = {
        "type": "application.submitted",
        "data": json.dumps({"user_id": "u1", "job_url": "https://example.com/job"}),
        "timestamp": "2026-09-10T00:00:00Z",
    }
    mock_redis.xreadgroup.return_value = [
        ["tayari:events", [("msg-err-1", event_payload)]],
    ]

    faulty_handler = MagicMock(side_effect=RuntimeError("Handler crashed"))

    with patch("app.services.event_bus.get_redis", return_value=mock_redis):
        processed = await consume_events(
            stream="tayari:events",
            group="grp",
            consumer="c1",
            handler=faulty_handler,
        )
        # Should not crash, and message should NOT be acknowledged
        assert processed == 0
        faulty_handler.assert_called_once()
        mock_redis.xack.assert_not_called()


@pytest.mark.asyncio
async def test_consume_events_graceful_when_redis_down():
    mock_redis = AsyncMock()
    mock_redis.xreadgroup.side_effect = ConnectionError("Redis connection lost")

    with patch("app.services.event_bus.get_redis", return_value=mock_redis):
        processed = await consume_events(
            stream="tayari:events",
            group="grp",
            consumer="c1",
            handler=MagicMock(),
        )
        assert processed == 0


@pytest.mark.asyncio
async def test_get_redis_and_close_redis():
    with patch("app.services.event_bus.aioredis") as mock_aioredis:
        mock_client = AsyncMock()
        mock_aioredis.from_url.return_value = mock_client

        r = get_redis()
        assert r is mock_client

        await close_redis()
        mock_client.aclose.assert_called_once()


@pytest.mark.asyncio
async def test_optimizer_flow_publishes_event():
    with patch("app.services.event_bus.publish_event", new_callable=AsyncMock) as mock_pub:
        from app.services import optimizer

        # Mock the cache hit to quickly return a valid result without calling real LLM
        with patch.object(
            optimizer,
            "get_optimizer_result",
            new_callable=AsyncMock,
            return_value={"optimized_text": "Sample", "resume_id": "res_999"},
        ):
            await optimizer.optimize_with_reflection(
                resume_text="Software Engineer with Python",
                job_description="Senior Python Engineer",
                user_id="user_123",
                resume_id="res_999",
            )

        mock_pub.assert_called_once_with(
            "tayari:events",
            "resume.optimized",
            {"user_id": "user_123", "resume_id": "res_999"},
        )


@pytest.mark.asyncio
async def test_automation_engine_flow_publishes_event():
    with patch("app.services.event_bus.publish_event", new_callable=AsyncMock) as mock_pub:
        from app.services.automation_engine import record_application_submitted

        await record_application_submitted(
            user_id="user_abc",
            job_url="https://jobs.example.com/posting/42",
        )

        mock_pub.assert_called_once_with(
            "tayari:events",
            "application.submitted",
            {"user_id": "user_abc", "job_url": "https://jobs.example.com/posting/42"},
        )

