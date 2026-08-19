# JobTayari LinkedMash-Parity Gap Remediation

**Assessment date:** 20 August 2026
**Repository:** [Harshodai/tayari-skill-boost](https://github.com/Harshodai/tayari-skill-boost)
**Verified code revision:** `6a76e4e`
**Report commit:** documented in the subsequent `origin/main` commit
**Scope:** OmniSaveAI full-history capture and the five remaining parity/readiness gaps; interview functionality remains excluded.

## Executive conclusion

The five gaps have now been split into code-completable controls and deployment evidence. The repository gained browser-side restart/resume discovery, bounded 429/5xx backoff, a sanitized three-platform fixture corpus, a deterministic recovery contract, a fail-closed media-mirroring policy, and provider-neutral destination adapters for Google Sheets, Notion, Airtable, and Miro. All new local contracts are covered by tests and the release contract.

These additions materially reduce implementation risk, but they do not justify claiming full LinkedMash equivalence. Binary media mirroring is still disabled, destination adapters are not mounted as public routes, and authenticated source-account, worker-interruption, two-tenant, backup/restore, rollback, and alert-routing evidence still requires deployed staging and real connectors.

## Gap-by-gap status

| Gap | What is now implemented and verified | What remains open |
|---|---|---|
| Authenticated LinkedIn/Medium/Substack fixtures | Sanitized corpus with 6 pages, 8 raw items, 7 unique canonical items, media-rich examples, duplicate, deletion, login-wall, paywall, and cross-platform negative cases. Validator passes. | Real authenticated browser sessions and live source-account evidence. Current connected browser still exposes Medium `Sign in`/404 and Substack `Log in or sign up`. |
| Browser restart/resume | Companion searches owner-scoped nonterminal runs for the same normalized platform/page, reclaims the run, preserves page counts and counters, and advances when the stored content signature matches the current page. Extension contract and JavaScript syntax checks pass. | A real browser restart/resume staging run with captured run IDs and redacted evidence. |
| Worker interruption/reclaim | Synthetic recovery contract proves checkpoint preservation after lease expiry, duplicate source-key suppression, cancellation claim prevention, and bounded retry policy. Backend durable lease/checkpoint implementation was already present. | Kill a real Celery worker after a checkpoint and verify replacement-worker reclaim against staging PostgreSQL/Redis. |
| Rate-limit backoff | Browser companion retries only 429 and 5xx responses with bounded 500/1000/2000 ms delays and capped `Retry-After`; non-retryable errors fail immediately. | Observe the behavior against a gated staging endpoint or provider test fixture. |
| Binary media mirroring | New fail-closed policy validates HTTPS, ports, DNS/IP safety, content type, content length/body size, malware verdict, retention, owner-scoped object keys, and deletion namespace. Six focused media tests pass. | No binary download is enabled. A real fetcher, malware scanner, object store, retention/rights/deletion controls, and staging proof are required before enabling `OMNISAVE_MEDIA_MIRROR_ENABLED`. |
| Destination adapters | Four provider-neutral adapters produce bounded payloads and require a server-side token, injected transport, and owner-scoped idempotency ledger. Seven destination tests pass, including duplicate suppression and provider failure handling. | The adapters are not public routes. Connector OAuth/token retrieval, durable delivery migration, explicit capability flags, consent UI, provider pagination/rate-limit handling, revoke/delete behavior, and real provider acceptance tests remain open. |
| Two-tenant and operational drills | Existing RLS, route-authorization, migration, evidence-bundle, and synthetic recovery contracts pass. | Deployed staging with two disposable tenants, real backup/restore, rollback, worker interruption, and an alert receiver. |

## Verification evidence

| Gate | Result |
|---|---:|
| Full Python suite | **899 passed, 4 skipped** |
| Focused media/destination/capture tests | **13 passed** in the focused run |
| Go suite | **Passed** |
| Frontend tests | **43 files, 154 tests passed** |
| Frontend build | **Passed** |
| Extension syntax and validation | **Passed** |
| Fixture validator | **Passed** — 6 pages, 8 raw items, 7 unique items, 6 negative cases |
| Synthetic recovery contract | **Passed** — checkpoint reclaim, deduplication, backoff, cancellation |
| Release contract | **Passed** |
| Docker Python image | **Passed** — no host `.venv`; new media/destination/capture modules compile |
| Docker smoke and contracts | **Passed** — Go/Python health, migrations, RLS, route authorization |
| Live-provider verifier | **Completed safely but blocked by missing configuration**; no external side effects were attempted |
| Live Medium/Substack browser capture | **Blocked by missing authenticated source sessions** |

The frontend test run emits existing React `act(...)` warnings, and Python emits existing deprecation warnings; neither caused a failure.

## Safety decisions

The binary mirror remains disabled because metadata capture is safer than silently downloading arbitrary third-party content. The new policy refuses missing scanners or stores, non-clean malware verdicts, inadequate retention, private/reserved IP resolution, disallowed content types, oversized bodies, and invalid object keys.

Destination delivery is not exposed through a new unauthenticated or browser-token route. The adapter layer accepts only server-side tokens supplied by a connector layer and reserves an owner-scoped idempotency event before making a transport call. Until that durable connector and delivery ledger exist, the adapters remain a tested implementation contract rather than a user-visible claim.

## Exact next staging actions

1. Sign in to Medium, Substack, and LinkedIn in the connected browser using disposable test accounts, open the known saved-content pages, and execute the sanitized corpus scenarios. Do not provide passwords or MFA codes to the automation service.
2. Run the browser companion through a deliberate stop/restart while a capture run is checkpointed. Verify the same owner-scoped run ID resumes rather than creating duplicate imports.
3. Kill one staging Celery worker after checkpoint persistence, restart it, and verify lease expiry/reclaim, imported counts, and duplicate-side-effect invariants.
4. Configure a disposable malware scanner and object store in a non-production staging namespace. Run SSRF, redirect, content-type, size, malware, retention, deletion, account-purge, and restore tests before enabling binary mirroring.
5. Add connector OAuth and durable delivery-ledger wiring for the destination adapters, then run provider-specific acceptance tests for Google Sheets, Notion, Airtable, and Miro with disposable targets.
6. Complete two-tenant negative tests, backup/restore, rollback, and real Sentry/metrics alert routing. Attach redacted evidence to the staging promotion bundle.

## References

[1]: https://github.com/Harshodai/tayari-skill-boost/blob/main/docs/operations/omnisave-full-history-capture.md "OmniSaveAI full-history capture operations"
[2]: https://github.com/Harshodai/tayari-skill-boost/blob/main/docs/operations/omnisave-staging-fixtures.md "OmniSaveAI authenticated staging fixtures"
[3]: https://github.com/Harshodai/tayari-skill-boost/blob/main/docs/operations/omnisave-media-and-destinations.md "OmniSaveAI media and destination contracts"
[4]: https://github.com/Harshodai/tayari-skill-boost/blob/main/scripts/release_contract_test.sh "JobTayari release contract"
