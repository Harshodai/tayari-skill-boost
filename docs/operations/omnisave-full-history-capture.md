# OmniSaveAI Full-History Capture Operations

## Purpose

OmniSaveAI can now run an explicit, bounded full-history capture from a candidate-selected saved-content page in the signed browser companion. The companion does not receive passwords, does not enumerate private libraries from the server, and does not read unrelated tabs. The candidate must enable the feature and acknowledge the capture consent in the JobTayari UI.

The supported page families are LinkedIn saved posts, Medium reading lists, Substack home/reading views, and Instagram saved activity where the platform page exposes stable visible links. Platform pages can change their DOM, require reauthentication, load content only after scrolling, or deny access. These conditions are recorded as partial, blocked, failed, or reauthentication-required outcomes rather than being presented as successful empty imports.

## Lifecycle

A full-history run has a durable owner-scoped record with the selected platform, source page URL, trigger, bounded item limit, status, page cursor, page count, discovered/imported/skipped/failed counts, checkpoint metadata, lease, heartbeat, cancellation state, and terminal error. Each discovered item is keyed by the platform and canonical HTTPS URL, so repeated page loads do not create duplicate capture-ledger rows.

The browser companion creates a run, claims a short lease, captures the visible batch, persists the batch ledger, sends the same items through the existing authenticated `/v1/saves/sync` hydration path, records a page checkpoint, advances the selected page, and repeats until the requested limit or page-completion signal is reached. The capture run is then finalized as `completed`, `partial`, `failed`, or `cancelled`. A worker or browser interruption leaves a durable checkpoint that can be inspected and retried; it does not silently claim that the entire history was captured.

## Consent and scope controls

Full-history capture is disabled by default. Enabling it is a separate action from enabling ordinary automatic capture. The companion stores the following local preference fields:

| Preference | Meaning |
|---|---|
| `fullHistoryEnabled` | Enables bounded page advancement rather than only reading the currently visible batch. |
| `consentAcknowledged` | Records the candidate’s explicit acknowledgement before a capture run can be created. |
| `maxItems` | Hard item cap for one run; the server also enforces a 1–5000 range. |
| `platforms` | Allowlist of platform page families the companion may inspect. |
| `intervalMinutes` | Minimum five-minute schedule interval for automatic runs. |

The server validates the platform, HTTPS source page, trigger type, item limit, and consent flag. Every capture-run read and state transition includes the authenticated owner ID. The Go gateway forwards all capture-run calls to Python with verified identity headers; the frontend and extension do not call Python directly.

## Recovery and cancellation

Operators should inspect `GET /api/v1/saves/capture/runs` for the most recent state and `GET /api/v1/saves/capture/runs/{run_id}/items` for the item ledger. A stuck `running` run can be reclaimed after its lease expires. A candidate stop action calls the owner-scoped cancel route and moves a queued run directly to `cancelled` or an active run to `cancel_requested`; the browser loop must observe that state before continuing.

The capture ledger is not itself the candidate knowledge library. Items become searchable saved sources only after the companion sends them through `/api/v1/saves/sync`. This separation makes an interrupted run auditable: an item can be discovered, persisted in the ledger, and still be marked as not yet hydrated.

## Media handling

Visible media references are normalized and stored as metadata inside the source NLP/provenance payload. Only HTTPS URLs are accepted; script/data/file URLs and malformed references are discarded. The current slice does not download arbitrary third-party binaries. Markdown and CSV exports include the validated media URLs, while JSON exports preserve the complete media metadata. Binary object-storage retrieval, malware scanning, retention policy, and deletion propagation remain separate production gates before media mirroring is enabled.

## Platform boundaries

Medium and Substack private reading queues are not treated as public APIs. A candidate-authorized browser tab is required for private-library capture. Public Substack RSS remains a separate public-feed import path and must not be represented as the candidate’s private saved library. Public URL hydration can fail on login walls, paywalls, robots restrictions, anti-bot pages, deleted posts, or transient errors. The system records the failure class and preserves the canonical URL when appropriate.

## Verification commands

Run the focused tests with:

```bash
APP_ENV=development JWT_SECRET=ci-test-jwt-secret-not-production \
PYTHONPATH=backend/python \
pytest -q \
  backend/python/app/tests/test_omnisave_capture.py \
  backend/python/app/tests/test_omnisave_capture_routes.py \
  backend/python/app/tests/test_omnisave_sync_capture.py \
  backend/python/app/tests/test_omnisave_agent_reach.py
```

Run the browser companion and frontend contracts with:

```bash
node scripts/validate-extension.mjs
pnpm test -- --run
pnpm build
```

Run the gateway and security contracts with:

```bash
cd backend/go && go test ./...
cd ../..
python3 scripts/verify_self_hosted_migrations.py
python3 scripts/verify_rls_contract.py
python3 scripts/verify_route_authorization_contract.py
bash scripts/release_contract_test.sh
```

The final readiness claim still requires deployed staging evidence for authenticated Medium/Substack pages, pagination fixtures, worker interruption/restart, two-tenant negative tests, real observability routing, and backup/restore/rollback drills.
