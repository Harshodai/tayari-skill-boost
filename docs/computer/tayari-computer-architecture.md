# Tayari Computer Architecture and Threat Model

**Status:** Phase-1 design contract
**Scope:** Isolated computer execution and explicitly authorized local-browser control
**Release posture:** Development-only until staging evidence gates are satisfied

## Decision

Tayari Computer has two separate execution modes. **Isolated Computer** creates a disposable browser/desktop environment under Tayari’s infrastructure control. **Local Browser Bridge** attaches only to a user-selected browser window or tab after an explicit local grant. The two modes must never share cookies, browser profiles, session storage, or implicit authority.

The Tayari Go gateway and Python control plane remain the policy authority. The extension, native host, local bridge, and isolated runtime are execution surfaces only. Every execution surface receives an owner-bound, tenant-bound, time-limited task grant and must fail closed when that grant is absent, expired, replayed, revoked, or inconsistent with the requested capability.

## Non-goals for the first release

The first release will not copy cookies or browser profiles, expose a public Chrome DevTools Protocol endpoint, permit arbitrary JavaScript evaluation, permit arbitrary shell execution through the local browser bridge, enter passwords/MFA/CAPTCHA answers, change account settings, send messages, make purchases, submit job applications, or bypass a human approval. Final application submission remains disabled by the existing product boundary.

## Trust boundaries

| Boundary | Trusted input | Untrusted input | Required control |
|---|---|---|---|
| Browser page to agent | None from page content | DOM text, screenshots, accessibility labels, redirects, downloads, prompts | Treat page content as data; it cannot expand task scope or authorize an action. |
| Local bridge to Tayari | Signed task grant, verified local user approval, bridge instance identity | Local tab content and browser events | Nonce-bound signatures, expiry, tab/window scope, origin allowlist, release/revoke. |
| Gateway to Python | Verified authenticated subject and tenant context | Caller headers, task payloads, model output | Gateway identity forwarding, owner predicates, capability registry, schema validation. |
| Control plane to sandbox | Provider-issued session metadata and task policy | Sandbox output, network content, tool results | Digest-pinned image, private endpoint, egress policy, resource quotas, destruction. |
| Provenance and audit | Hashes, event type, policy version, owner identity | Raw page text, screenshots, secrets, credentials | Redaction at capture boundary, bounded retention, hash-only storage where possible. |

## Computer-run contract

Each computer run is identified by a UUID and binds the following fields: `run_id`, verified `user_id`, verified `tenant_id`, execution mode, capability, selected tab/window or isolated provider session, approved origin set, grant issued-at and expiry, action policy, approval state, revocation state, provider/session identity, and provenance correlation ID. A run must not be controlled by a caller-supplied owner or tenant header.

A local bridge grant is signed over the canonical fields and a nonce. The grant audience is the specific bridge instance, its maximum lifetime is bounded, and a release or revoke operation invalidates all handles issued under that grant. Action requests include the grant ID, action ID, document generation, target reference, and raw observation hash. The bridge rejects stale observations and requires a new observation after navigation or DOM mutation.

## Capability boundaries

The implementation will add separate launch-scope capabilities rather than widening `AUTONOMOUS_BROWSER`:

| Capability | Meaning | Default |
|---|---|---|
| `workspace.isolated_computer` | Create a disposable OpenSandbox-backed computer for candidate-safe workflows. | Development only. |
| `workspace.local_browser_bridge` | Attach to one explicitly selected local browser window or tab. | Disabled unless explicitly enabled. |
| `workspace.local_browser_sensitive_actions` | Permit a sensitive action after immediate user confirmation. | Disabled by default. |
| `workspace.computer_submission` | Permit irreversible submission or sending. | Disabled and not implemented in the first release. |

Unknown capability values remain disabled. Staging and production require explicit environment flags. Autonomous capabilities remain separate from candidate-controlled workspace capabilities.

## Allowed first-release action classes

The isolated computer may perform read-only research, page answering, structured observation, screenshot capture, draft generation, saving a job, queueing for review, and candidate-approved autofill where the existing origin and field policies permit it. The local browser bridge may perform structured observation and candidate-safe actions on one approved tab. It may not silently switch tabs, follow an unapproved origin, or perform an irreversible action.

Sensitive actions require an explicit user confirmation at the moment of action and a durable audit event. If the bridge cannot prove the target, origin, owner, approval, or current document generation, it refuses the action instead of guessing.

## Release evidence gates

Before enabling either capability in staging, the project must demonstrate signed-grant integrity, replay rejection, expiry and revocation, active-tab isolation, origin-switch blocking, browser restart recovery, disconnect cleanup, two-tenant read/control/export negatives, prompt-injection resistance, screenshot/DOM redaction, stop latency, sandbox destruction on cancellation, private-network egress blocking, image-digest verification, and provenance completeness.

Production enablement additionally requires a signed staging evidence package, operational runbooks, alerting, retention/deletion confirmation, backup/restore treatment for run records, a dependency/SBOM review, and explicit product/privacy/security approval. This document is an engineering control contract and does not constitute legal advice or a regulatory certification.

## References

[1]: https://github.com/opensandbox-group/OpenSandbox "OpenSandbox repository"

[2]: https://developer.chrome.com/docs/devtools/agents/use-cases/auto-connect "Chrome DevTools auto-connect"

[3]: https://github.com/koltyakov/browser-bridge "Browser Bridge reference implementation"

[4]: https://github.com/Harshodai/tayari-skill-boost/blob/85acc15/docs/DESKTOP_STATUS.md "Tayari desktop status decision record"
