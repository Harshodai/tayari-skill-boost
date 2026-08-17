# A2A Hardening Evidence for `bd59705`

**Commit:** [`bd59705`](https://github.com/Harshodai/tayari-skill-boost/commit/bd59705)
**Commit title:** `Harden A2A inbound auth, replay protection, and capability cards`
**Evidence date:** 2026-08-17
**Working tree at evidence generation:** commit `bd5970521ae609af3cc7a00a5098191a4e3db360`

## Capability cards updated

The commit updated five concrete Agent Cards. The change adds the optional `required_capability` property to [`AgentCard`](https://github.com/Harshodai/tayari-skill-boost/blob/bd59705/backend/python/app/a2a/models.py), allowing discovery to filter cards by launch scope without removing the underlying agent implementation.

| Agent Card | Existing agent capability | Required launch capability | Source |
|---|---|---|---|
| `AtsScorerAgent` | `analyze_ats` | `workspace.ats_assistance` | [`ats_agent.py`](https://github.com/Harshodai/tayari-skill-boost/blob/bd59705/backend/python/app/a2a/agents/ats_agent.py) |
| `OptimizerAgent` | `optimize_resume` | `workspace.resume` | [`optimizer_agent.py`](https://github.com/Harshodai/tayari-skill-boost/blob/bd59705/backend/python/app/a2a/agents/optimizer_agent.py) |
| `TruthGateAgent` | `check_authenticity` | `workspace.resume` | [`truth_gate_agent.py`](https://github.com/Harshodai/tayari-skill-boost/blob/bd59705/backend/python/app/a2a/agents/truth_gate_agent.py) |
| `InterviewCoachAgent` | `generate_prep` | `workspace.interview_prep` | [`interview_coach_agent.py`](https://github.com/Harshodai/tayari-skill-boost/blob/bd59705/backend/python/app/a2a/agents/interview_coach_agent.py) |
| `JobSearchAgent` | `orchestrate_pipeline` | `workspace.application_tracker` | [`job_search_agent.py`](https://github.com/Harshodai/tayari-skill-boost/blob/bd59705/backend/python/app/a2a/agents/job_search_agent.py) |

[`AgentRegistry.get_system_agent_card`](https://github.com/Harshodai/tayari-skill-boost/blob/bd59705/backend/python/app/a2a/registry.py) now includes only agents whose `required_capability` is enabled. The system card still exposes the platform’s aggregate capabilities, but disabled workspace skills are not advertised to remote peers.

## Message-integrity implementation

The implementation is in [`backend/python/app/a2a/federation.py`](https://github.com/Harshodai/tayari-skill-boost/blob/bd59705/backend/python/app/a2a/federation.py). The sender signs the exact raw request body together with the timestamp and nonce:

```text
HMAC-SHA256(secret, timestamp + "." + nonce + "." + raw_request_body)
```

The outbound dispatch request includes `X-A2A-Timestamp`, `X-A2A-Nonce`, and `X-A2A-Signature`. The verifier requires all signed headers, bounds their lengths, parses the timestamp, enforces a default ±300-second clock-skew window, recomputes the signature over the raw body, and compares it with `hmac.compare_digest`.

Because the raw body is signed rather than a parsed-and-reserialized JSON representation, changes to values, field order, whitespace, or other body bytes invalidate the signature.

## Replay-protection implementation

`ReplayProtector` claims nonces using Redis when `A2A_REPLAY_REDIS_URL` or `REDIS_URL` is configured. It uses an atomic `SET` with `NX` and a five-minute expiry under the key prefix `tayari:a2a:nonce:<nonce>`. A duplicate nonce returns false and is rejected.

Staging and production fail closed when Redis is absent or unavailable. They raise a federation rejection rather than using process-local memory, because a restart or second instance could otherwise reopen the replay window. Development uses a bounded in-memory fallback with expiry, a maximum of 4,096 entries, and oldest-entry eviction for deterministic local tests.

## Inbound authentication policy

[`a2a_routes.py`](https://github.com/Harshodai/tayari-skill-boost/blob/bd59705/backend/python/app/api/a2a_routes.py) applies this policy:

| Situation | Result |
|---|---|
| Development and no signed headers | Existing bearer-key authentication remains available for local testing. |
| Signed headers present | Federation capability is required and the HMAC/timestamp/nonce/body verifier runs. |
| Staging or production without signed headers | Request is rejected with HTTP 401 because signed authentication is mandatory. |
| Federation capability disabled | Capability gate rejects the request or prevents discovery. |

## Test coverage

The exact focused A2A command is:

```sh
cd backend/python
PYTHONPATH=. pytest -q \
  app/tests/test_a2a_federation.py \
  tests/test_a2a_routes.py \
  app/tests/test_a2a_protocol.py
```

The regenerated result was:

```text
17 passed in 3.74s
```

The full Python suite was regenerated with:

```sh
cd backend/python
PYTHONPATH=. pytest -q
```

The result was:

```text
789 passed, 4 skipped, 2 warnings in 8.66s
```

The logs are retained in the repository at [`a2a-bd59705-focused-validation.log`](https://github.com/Harshodai/tayari-skill-boost/blob/main/docs/audit/a2a-bd59705-focused-validation.log) and [`a2a-bd59705-python-suite.log`](https://github.com/Harshodai/tayari-skill-boost/blob/main/docs/audit/a2a-bd59705-python-suite.log).

### Test-to-control mapping

| Test | Control demonstrated |
|---|---|
| `test_peer_url_policy_rejects_private_and_non_https_hosts` | Rejects HTTP, loopback, private/internal, and unsafe peer URLs. |
| `test_federation_requires_explicit_capability` | Federation remains disabled unless explicitly enabled by launch scope. |
| `test_federation_verifies_card_and_signs_dispatch` | Verifies the configured Agent Card fingerprint and emits signed dispatch headers. |
| `test_signed_request_rejects_tampering_and_replay` | Accepts the original request, rejects nonce reuse, and rejects signature/body/nonce tampering. |
| `test_signed_request_requires_durable_replay_protection_in_staging` | Rejects staging traffic when Redis-backed replay protection is unavailable. |
| `test_federation_rejects_card_fingerprint_mismatch` | Rejects a remote Agent Card whose canonical JSON hash differs from the configured fingerprint. |
| A2A route tests | Enforces development bearer behavior, production signed-auth requirements, and request-body verification. |
| A2A protocol tests | Registers all five agents and verifies disabled workspace skills are hidden from the system card. |
| Capability-gate tests | Verifies A2A discovery is disabled by launch scope. |

## Evidence limitations and follow-up gates

The tests are local and use mock HTTP transport or deterministic secrets. They do not prove multi-instance replay protection, Redis failover, key rotation, durable partner revocation, or tenant-bound partner lifecycle.

One implementation follow-up must be closed before enabling federation in staging: the outbound `fetch_agent_card()` path currently sends bearer authentication for discovery, while staging/production inbound routes require signed authentication whenever federation is enabled. The discovery request must either be signed by the outbound client or be explicitly separated into a narrowly scoped, independently authenticated discovery policy. This is a release gate, not a claim of completed federation readiness.

No live provider or partner calls were made, and no secrets are present in this evidence.
