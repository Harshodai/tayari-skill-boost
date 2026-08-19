# OmniSaveAI Authenticated Staging Fixtures

## Purpose

`test-fixtures/omnisave/staging-corpus.json` is a sanitized fixture corpus for proving the full-history capture path against three real authenticated source sessions. It contains no credentials, private URLs, or personal content. `scripts/verify_omnisave_staging_fixtures.py` validates its schema and negative coverage without making network calls.

The corpus includes LinkedIn, Medium, and Substack pages with two cursors each, content signatures, duplicate normalization, media-rich items, login-wall cases, paywall cases, a deletion case, and a cross-platform host rejection case.

## Local contract

```bash
python3 scripts/verify_omnisave_staging_fixtures.py
python3 scripts/verify_omnisave_staging_fixtures.py --plan
python3 scripts/omnisave_recovery_contract_test.py
```

A local `PASS` means the fixture corpus and synthetic invariants are internally consistent. It does not mean the browser is logged in, the source account exposes the expected saved library, or a real worker was restarted.

## Required live staging setup

The operator must use two disposable staging tenants and three source accounts or test profiles authorized to access the relevant saved-content pages. The browser companion must remain in the user-controlled browser session; passwords, MFA codes, CAPTCHAs, and legal declarations must never be entered by the automation service.

For each platform, record the account identifier as a redacted hash, the source page URL, image/build digest, browser companion version, fixture scenario, start/end timestamps, and the run ID. The evidence bundle must contain only redacted metadata and response summaries, never cookies, bearer tokens, private post bodies, or screenshots containing personal data.

## Acceptance scenarios

| Scenario | Required observation |
|---|---|
| Baseline capture | Known fixture items are discovered and imported through the gateway and owner-scoped database path |
| Pagination/infinite scroll | Page cursor and content signature advance; the same page is not re-imported after resume |
| Duplicate item | Repeated canonical URL produces no duplicate saved source or external side effect |
| Deleted item | Missing/deleted source is recorded as skipped or failed with an inspectable error |
| Login wall | Run remains truthful and reports authentication required; it must not claim completion |
| Paywall | Run records partial/blocked behavior without bypassing access controls |
| Media-rich post | Only metadata is captured unless the separately gated media mirror is enabled |
| Cancellation | Browser session is terminated and the durable run reaches cancelled state |
| Worker interruption | Checkpoint survives worker kill; a replacement worker reclaims the expired lease |
| Two-tenant negative | Tenant A cannot list, mutate, cancel, or export Tenant B’s run or items |

## Evidence boundary

The following remain deployment evidence, not local claims: authenticated source-library access, real browser restart, worker interruption/reclaim, provider rate-limit behavior, backup/restore, rollback, alert routing, and destination delivery using real connector tokens.
