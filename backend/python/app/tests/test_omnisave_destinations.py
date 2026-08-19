import pytest

from app.services.omnisave_destinations import TransportResponse, deliver_bundle


BUNDLE = {
    "schema_version": "omnisave-export-v1",
    "exported_at": "2026-08-20T00:00:00+00:00",
    "source_count": 1,
    "sources": [{"title": "Fixture", "url": "https://medium.com/p/fixture", "platform": "medium", "author": "Author", "category": "Testing", "summary": ["One line"]}],
}


class Ledger:
    def __init__(self, reserve=True):
        self.reserve_result = reserve
        self.successes = []
        self.failures = []

    async def reserve(self, **kwargs):
        return self.reserve_result

    async def mark_success(self, **kwargs):
        self.successes.append(kwargs)

    async def mark_failure(self, **kwargs):
        self.failures.append(kwargs)


@pytest.mark.asyncio
@pytest.mark.parametrize("destination,target,expected_url", [
    ("google_sheets", "sheet-1", "sheets.googleapis.com"),
    ("notion", "database-1", "api.notion.com"),
    ("airtable", "base-1/table-1", "api.airtable.com"),
    ("miro", "board-1", "api.miro.com"),
])
async def test_destination_adapters_use_injected_transport_and_owner_ledger(destination, target, expected_url):
    calls = []
    ledger = Ledger()

    async def transport(method, url, headers, payload):
        calls.append((method, url, headers, payload))
        return TransportResponse(200, {"id": "provider-1"})

    result = await deliver_bundle(
        user_id="user-1",
        destination=destination,
        target=target,
        access_token="server-side-test-token",
        bundle=BUNDLE,
        transport=transport,
        ledger=ledger,
    )
    assert result["status"] == "delivered"
    assert expected_url in calls[0][1]
    assert calls[0][2]["Authorization"] == "Bearer server-side-test-token"
    assert calls[0][2]["X-JobTayari-Idempotency-Key"].startswith("omnisave:user-1:")
    assert ledger.successes and not ledger.failures


@pytest.mark.asyncio
async def test_duplicate_delivery_is_suppressed_before_transport():
    calls = []
    ledger = Ledger(reserve=False)

    async def transport(*args):
        calls.append(args)
        return TransportResponse(200, {"id": "should-not-happen"})

    result = await deliver_bundle(
        user_id="user-1",
        destination="notion",
        target="database-1",
        access_token="token",
        bundle=BUNDLE,
        transport=transport,
        ledger=ledger,
    )
    assert result["status"] == "already_reserved"
    assert calls == []


@pytest.mark.asyncio
async def test_provider_failure_marks_ledger_and_never_claims_success():
    ledger = Ledger()

    async def transport(*args):
        return TransportResponse(429, {"error": "rate_limited"})

    with pytest.raises(Exception, match="destination_http_429"):
        await deliver_bundle(
            user_id="user-1",
            destination="google_sheets",
            target="sheet-1",
            access_token="token",
            bundle=BUNDLE,
            transport=transport,
            ledger=ledger,
        )
    assert ledger.failures and not ledger.successes


@pytest.mark.asyncio
async def test_missing_server_side_token_is_rejected():
    ledger = Ledger()

    async def transport(*args):
        raise AssertionError("transport must not run")

    with pytest.raises(ValueError, match="access_token_required"):
        await deliver_bundle(
            user_id="user-1",
            destination="miro",
            target="board-1",
            access_token="",
            bundle=BUNDLE,
            transport=transport,
            ledger=ledger,
        )
