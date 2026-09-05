# Architectural Decision Record: Desktop Status

**Decision**: Shelved for Web Launch — Static Security & Sandbox Contracts Preserved  
**Status**: Shelved (Active Freeze)  
**Date**: 2026-08-16  
**Scope**: Electron Packaging, Native OS Bundling, and Cross-Platform Desktop Distribution  

---

## 1. Executive Summary & Context

As validated in the Tayari Profitability Analysis (`TAYARI_PROFITABILITY.html`), distribution velocity and zero-friction candidate onboarding are the primary determinants of product viability. In this market:
- Competitors that succeed (e.g., Rezi at $3.2M ARR bootstrapped) scale through immediate web access and low-friction search/scan funnels.
- Requiring candidates or career switchers to download an unnotarized or heavyweight desktop binary creates severe conversion drop-off.
- The web platform (`/free-scan`, `/auth`, `/app`) delivers the complete end-to-end user value: ATS analysis, calibrated fit scoring, zero-hallucination claim ledger verification, and resume graph generation.

**Decision**: The desktop client packaging and release cycle is **explicitly shelved for the initial Web SaaS launch**. The engineering surface is consolidated onto the high-velocity Web distribution funnel (Path 1: Web Freemium + Path 2: B2B2C Bootcamp Partnerships).

---

## 2. Static Security & Sandbox Contract Invariants Preserved

Although public desktop distribution is shelved, the codebase strictly maintains 100% compliant, production-grade Electron isolation and packaging configurations. No security invariants have been dismantled or relaxed.

The following security and sandboxing guarantees are frozen in code and verified continuously via automated contract tests:

### A. Context & Process Isolation (`electron/main.cjs`, `electron/preload.cjs`)
- **`contextIsolation: true`**: The renderer has zero direct access to Electron internal APIs or Node.js runtime.
- **`nodeIntegration: false`**: Completely prevents remote code execution via compromised DOM elements.
- **`sandbox: true`**: Enforces Chromium OS-level process sandboxing across all renderer processes.
- **`assertTrustedSender`**: IPC messages validate the sender frame origin before executing any handler.

### B. Navigation & External Link Lockdown (`electron/main.cjs`, `electron/security.cjs`)
- **`setWindowOpenHandler`**: Rejects arbitrary new window creation; allows only whitelisted protocols via system browser.
- **`will-navigate`**: Blocks malicious top-level redirects inside the Electron container.
- **`SAFE_EXTERNAL_HOSTS`**: Restricts external opening to strictly audited domains.
- **Content Security Policy (CSP)**: Strict script-src and connect-src policies injected into HTML headers.

### C. IPC & File Access Constraints
- **Session-Scoped File Reveal**: `Only files selected in this session may be revealed` prevents unauthorized directory traversal or arbitrary local disk discovery.
- **Orchestration Isolation**: `Local service orchestration is disabled in packaged builds` ensures the packaged desktop client never silently executes or bundles backend microservices or untrusted Docker containers.

### D. Packaging & Exclusions (`electron-builder.yml`)
- Application identifier locked to `appId: app.tayari.desktop` (Version `0.1.0`).
- Hardened runtime enabled (`hardenedRuntime: true`) with macOS entitlements at `electron/entitlements.plist` and `electron/entitlements.mac.plist`.
- Explicit exclusion of backend runtime payloads (`!tayari-runtime/backend`), development Supabase configurations (`!supabase-local`), test files (`!electron/**/*.test.cjs`), and docker-compose definitions.

---

## 3. Automated Verification & Contract Test Status

The static security release contract is fully executable and passes with zero warnings:

```bash
$ bash scripts/mac_release_contract_test.sh
electron/entitlements.plist: OK
electron/entitlements.mac.plist: OK
macOS release contract: PASS
```

Associated runbooks and verification scripts remain documented and intact in the repository:
- `docs/MACOS_RELEASE_RUNBOOK.md` — Release inputs, Apple Developer ID signing, `spctl` assessment, and `xcrun stapler validate` requirements.
- `docs/CROSS_PLATFORM_DESKTOP_RELEASE_RUNBOOK.md` — Multi-platform target definitions and packaging matrices.
- `scripts/mac_artifact_contract.sh` — Deep verification of binary architectures (`lipo -archs`), code signatures, and package exclusion integrity.

---

## 4. Re-activation Criteria

The desktop packaging workflow will only be unshelved if all of the following conditions are met:
1. **Commercial Pull**: Paying user demand specifically requests an offline-first, local LLM execution model (e.g. native Ollama binding) that cannot be served via Web BYO-key.
2. **Infrastructure Readiness**: Dedicated Apple Developer Program signing credentials and CI notarization runners are provisioned.
3. **Distribution Traction**: The Web SaaS funnel has surpassed steady-state customer acquisition milestones ($10k+ MRR or signed institutional B2B contracts).
