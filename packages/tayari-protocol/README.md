# Tayari Protocol

**Status: proposed open-core package.** This directory is designed to be extracted into a separate public repository after legal review. It contains portable, privacy-safe contracts for career-workflow interoperability. It is not an automation bot and does not implement application submission.

> The protocol preserves a critical distinction: **prepared**, **candidate confirmed**, and **externally verified** are different states. An item can become externally verified only when an `ApplicationReceipt` with evidence is observed.

## What this package includes

The package provides TypeScript definitions for opaque candidate references, versioned career goals, normalised job postings, artefact hashes, approvals, application receipts, career events, and a safe application-state transition validator. It also contains no personal-profile store, no credentials, no browser cookies, no portal automation, and no provider API tokens.

| Included in the public protocol | Deliberately excluded from Tayari Cloud |
|---|---|
| Application and approval state-machine contracts | Candidate identity vault and encrypted connector tokens |
| Artefact, receipt, and event-envelope formats | Browser-worker fleet, ATS/portal adapters, and credential handoff |
| Deterministic transition and receipt helper functions | Proprietary matching, agent prompting, career memory, and policy registry |
| Synthetic fixtures and adapter interface examples | Tenant data, telemetry, notification ledger, billing, and support tooling |

## Development

```bash
npm install
npm test
```

This package should be versioned independently using semantic versioning. Backward-incompatible changes to schemas or state transitions require a major version and a migration note. Published fixtures must be synthetic and must never contain candidate resumes, messages, browser traces, employer portal data, credentials, or production policy configuration.

## Release checklist

Before publishing this directory as its own repository, replace the provisional package metadata with the organisation name and registry namespace, add maintainer and security contacts, run an independent licence review, add CI for tests and TypeScript declaration generation, and confirm that no private Cloud implementation has been copied into history.

## Licence

The included `LICENSE` is MIT. Confirm the final licensing, trademarks, contributor policy, and governance model with counsel before the first public release.
