# OmniSaveAI Media Mirroring and Destination Delivery

## Scope

OmniSaveAI currently stores media as validated HTTPS metadata. Binary mirroring and external destination delivery are higher-risk side effects, so they are separate from the capture and export control plane.

The repository now contains two fail-closed contracts:

| Contract | Purpose | Default state |
|---|---|---|
| `app.services.omnisave_media` | Validate public HTTPS media, reject private/reserved addresses, enforce image content types and byte limits, require malware scanning and retention, derive owner-scoped object keys, and restrict deletion to the OmniSave namespace. | Disabled; `OMNISAVE_MEDIA_MIRROR_ENABLED=false` |
| `app.services.omnisave_destinations` | Deliver an immutable OmniSave export bundle to Google Sheets, Notion, Airtable, or Miro using injected server-side transport and an owner-scoped idempotency ledger. | Not mounted as a public route; no browser-supplied provider tokens |

These contracts are deliberately not presented as live provider integrations. They provide the security and idempotency boundary that a staging deployment must exercise with real connector credentials before launch enablement.

## Media-mirroring enablement gates

A deployment must provide all of the following before setting the media feature flag to `true`:

1. The fetcher must use HTTPS, reject credentials and non-443 ports, resolve the hostname, and reject loopback, private, link-local, reserved, multicast, unspecified, and invalid addresses. Redirects must be bounded and revalidated.
2. The response must be limited by content type and byte count. The current contract allows only common image types and enforces a 10 MiB default limit.
3. A malware scanner must return an explicit `clean` verdict. Missing scanners and non-clean verdicts fail closed.
4. The object store must be tenant/owner scoped, retain provenance metadata and content hash, and enforce retention and deletion propagation.
5. Rights, takedown, account deletion, object lifecycle, backup, and restoration behavior must be tested with real staging storage.
6. The browser companion must never download arbitrary media directly; the server-side worker must own the fetch and storage operation.

The unit tests use injected fake scanners and stores only. They do not claim that a production object store, malware scanner, or remote media source has been verified.

## Destination delivery gates

Destination adapters accept only a server-side access token supplied by an already-authenticated connector layer. Tokens must never arrive in browser JSON payloads, be logged, or be persisted in the OmniSave export bundle. Every delivery requires an owner-scoped ledger reservation before network side effects.

The deterministic event key is derived from owner, destination, target, export timestamp, and source count. A ledger reservation failure suppresses duplicate transport calls. Provider errors mark the delivery failed, while successful calls record the provider identifier. A production ledger implementation must use a durable unique constraint and retry/suppression state similar to the existing notification delivery ledger.

The current adapter request shapes are:

| Destination | Target | Provider operation |
|---|---|---|
| Google Sheets | Spreadsheet ID | Append rows to `OmniSave!A1` |
| Notion | Database ID | Create a page with source title and export event reference |
| Airtable | `base_id/table_name` | Create bounded records |
| Miro | Board ID | Create a card with source title and export event reference |

The adapters are not public routes yet. Before mounting them, add explicit capability flags, consent UI, connector-token retrieval, durable delivery migration, API route authorization, deletion/revocation handling, provider rate-limit retry, and real staging acceptance tests.

## Verification commands

```bash
APP_ENV=development JWT_SECRET=ci-test-jwt-secret-not-production \
PYTHONPATH=backend/python \
pytest -q backend/python/app/tests/test_omnisave_media.py \
  backend/python/app/tests/test_omnisave_destinations.py

python3 scripts/verify_omnisave_staging_fixtures.py
python3 scripts/omnisave_recovery_contract_test.py
```

The synthetic recovery contract proves only local invariants. It does not replace a real worker interruption, browser cancellation, staging storage, connector, or alert-routing drill.
