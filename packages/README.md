# Shared Packages

This directory contains standalone, portable packages and bridges shared across the Tayari Skill Boost monorepo, desktop distribution, browser extensions, and open-core ecosystem.

## Package Inventory

### 1. `packages/tayari-protocol`

- **Purpose**: Portable, privacy-safe contracts and TypeScript schemas for career-workflow interoperability.
- **Language**: TypeScript (`package.json`, `tsconfig.json`).
- **Core Abstractions**:
  - Typed state transitions across candidate application lifecycles (`PREPARED` → `CANDIDATE_CONFIRMED` → `EXTERNALLY_VERIFIED`).
  - Strict separation of state: an application is only considered externally verified upon observing a genuine `ApplicationReceipt` with proof/evidence.
  - Portable envelopes for career goals, normalised job postings, artifact hashes, approvals, and career events.
- **Open-Core Separation**:
  - Designed for eventual extraction to an independent MIT-licensed repository.
  - Contains zero proprietary cloud secrets, credentials, browser-worker fleets, or tenant private data.
- **Backward Compatibility Symlink**:
  - `open-core/tayari-protocol` preserves backward compatibility for existing documentation and tooling.

### 2. `packages/native-host`

- **Purpose**: Native messaging bridge conforming to the Chrome / Chromium stdio length-prefixed JSON protocol for desktop-to-browser extension capabilities.
- **Language**: Go (`go.mod`, module `com.jobtayari.browser`).
- **Security & Scope Boundaries**:
  - Implements a strictly typed, audited method whitelist in `policy.go`.
  - Enforces mandatory capability tokens (`TAYARI_NATIVE_CAPABILITY_TOKEN`) for all privileged operations.
  - Deliberately omits arbitrary shell execution, password/MFA entry, CAPTCHA bypass, and automatic form submission.
- **Cross-Platform Compilation**:
  - Compiles via `scripts/prepare-native-host.mjs` for Darwin (`mac-arm64`), Linux (`linux-x64`), and Windows (`win-x64`).
  - Packaged by `electron-builder` into desktop releases.
- **Backward Compatibility Symlink**:
  - `native-host` in the repository root preserves backward compatibility for Electron builder scripts, installers, and developer workflows.
