# Tayari Computer Staging Runbook

## Scope

This runbook covers the two Tayari Computer modes:

1. **Isolated Computer**, backed by the OpenSandbox provider.
2. **My Browser**, backed by the Tayari extension’s explicit active-tab bridge.

Both modes are disabled in staging and production until the evidence gates below are complete. This runbook is an engineering release procedure, not legal advice or a regulatory certification.

## Secret and capability configuration

Set the following values through the deployment secret manager, never in Git or browser-visible configuration:

```text
CAPABILITY_WORKSPACE_ISOLATED_COMPUTER=true
CAPABILITY_WORKSPACE_LOCAL_BROWSER_BRIDGE=true
CAPABILITY_WORKSPACE_LOCAL_BROWSER_SENSITIVE_ACTIONS=false
CAPABILITY_WORKSPACE_COMPUTER_SUBMISSION=false
COMPUTER_BRIDGE_SIGNING_KEY=<random high-entropy staging secret>
COMPUTER_GRANT_REPLAY_REDIS_URL=<private Redis URL>
BROWSER_PROVIDER=opensandbox
OPENSANDBOX_API_URL=https://<private-control-plane>
OPENSANDBOX_API_TOKEN=<staging secret>
OPENSANDBOX_IMAGE=<registry>/<image>@sha256:<digest>
OPENSANDBOX_RUNTIME=gvisor
OPENSANDBOX_NETWORK_POLICY=deny_private_allowlist
OPENSANDBOX_PRIVATE_HOST_SUFFIX=.sandbox.internal
OPENSANDBOX_TTL_SECONDS=900
```

The OpenSandbox image must be digest-pinned and reviewed. The control plane, browser/CDP endpoint, VNC endpoint, and Redis must be private. A public CDP or VNC URL is a release failure. The API token and bridge signing key must be rotated through the staging secret manager and must not be returned in logs or API responses.

## Local validation before staging

Run the following from the repository root:

```bash
python3 scripts/verify_rls_contract.py
python3 scripts/verify_self_hosted_migrations.py
node scripts/validate-extension.mjs
cd backend/go && go test ./... && cd ../..
cd backend/python && PYTHONPATH=. pytest -q && cd ../..
pnpm test -- --run
pnpm build
SECURITY_BASELINE_ENFORCE=true node scripts/security_scan.mjs
bash scripts/release_contract_test.sh
```

The local suite proves schema, route, policy, replay, and fail-closed contracts. It does not prove that a real OpenSandbox control plane is reachable or that a real local browser session is connected.

## Staging evidence gates

### A. Grant and replay integrity

Create a local-browser run through the Go gateway, attach the extension to one HTTPS tab, and capture the request/response IDs. Prove the following:

| Test | Expected evidence |
|---|---|
| Tamper grant body | Attach returns 403 and no `bridge_attached` event is written. |
| Tamper signature | Attach returns 403 and the nonce is not accepted. |
| Wrong user or tenant | Attach returns 403; the other owner cannot read, attach, revoke, or authorize actions. |
| Reuse grant nonce | First attach succeeds; second attach returns 403. |
| Redis unavailable | Staging attach fails closed; no process-local fallback is used. |
| Expired grant | Attach and action authorization return 403. |
| Revoke | The run becomes revoked, the extension clears its state, and subsequent control attempts fail. |

### B. Existing-browser boundary

Use a dedicated staging account and a non-production browser profile. Prove that only the selected active tab is readable; switching tabs or changing origin causes observation failure until the user reconnects. Capture a redacted request log demonstrating that cookies, local storage, session storage, passwords, MFA values, and browser profile files never reach Tayari. Confirm that the bridge never opens a public debugging port.

The first staging workflow is read-only observation and screenshot/evidence capture. Do not test final application submission, credentials, CAPTCHA, or account-setting changes because those capabilities are disabled by contract.

### C. OpenSandbox isolation

Run one disposable isolated-computer task per test tenant. Prove image-digest verification, private browser endpoint validation, resource quota enforcement, network blocking for loopback/private destinations, allowlisted egress, automatic TTL expiration, destroy-on-cancel, and no cross-run filesystem visibility. Record sandbox ID, image digest, runtime, provider version, and destroy timestamp in the release evidence package.

### D. Tenant and owner isolation

Use two users in two tenants. Prove that User A cannot list, inspect, attach to, authorize actions for, revoke, export, or receive events from User B’s run. Repeat the test after browser disconnect, worker restart, Redis restart, and API retry. A missing database must produce an explicit 503 rather than an empty or apparently safe run list.

### E. Kill switch and recovery

Start a task, issue a stop/revoke request, and measure time to local bridge release or isolated-sandbox destruction. Repeat with the worker process interrupted, the extension disconnected, the browser restarted, and the provider returning a 5xx. The run must settle into a durable revoked/cancelled/failed state and must not continue controlling a browser after the stop deadline.

## Promotion decision

Do not enable `workspace.local_browser_sensitive_actions` or `workspace.computer_submission` based only on successful read-only tests. They require a separate product, privacy, security, and legal review. Production enablement of the two safe modes requires a signed staging evidence package, approved monitoring and retention settings, dependency/SBOM review, restore treatment for computer-run events, and an on-call runbook.

## F. Machine-checkable evidence bundle

The operator must produce a redacted JSON bundle conforming to `tayari.staging-evidence.v1`. The bundle must contain the exact deployed Git commit, immutable image digest, SBOM digest, provider-configuration hash, operator attestation, and all required scenarios across Computer, tenant isolation, privacy/recovery, provider integrations, adversarial safety, and observability/recovery.

Validate the bundle without making live calls:

```bash
python3 scripts/verify_staging_evidence_bundle.py --plan
python3 scripts/verify_staging_evidence_bundle.py --bundle /secure/path/staging-evidence.json
```

For an actual provider-enabled staging run, the operator must explicitly authorize live verification and use real HTTPS staging endpoints. The verifier will reject missing authorization, local/private endpoints, missing categories, missing scenarios, non-PASS results, secret-shaped values, mutable image references, and missing environment attestations:

```bash
ALLOW_LIVE_PROVIDER_VERIFY=true \
python3 scripts/verify_staging_evidence_bundle.py \
  --bundle /secure/path/staging-evidence.json \
  --require-live
```

The bundle is evidence of a specific deployment, not a permanent certification. Its Git commit, image digest, provider configuration hash, and review approval must be checked again after any code, image, provider, model, policy, or infrastructure change.

## G. Standards evidence mapping

Every enabled capability must map its evidence to the repository AI system inventory at `docs/governance/ai-system-inventory.yml`. The inventory records purpose, owner, risk tier, lifecycle state, data classes, outputs, human control, excluded use, evidence requirements, and review owner. Validate it with:

```bash
python3 scripts/verify_ai_system_inventory.py
```

This operationalizes the repository’s mapping to NIST AI RMF/AI 600-1, OWASP GenAI and Agentic Application guidance, and ISO/IEC 42001. It does not claim certification. Independent review, live staging evidence, retention/deletion proof, and incident/recovery exercises remain mandatory.
