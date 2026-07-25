# ADR-0002: Open Source Licensing Strategy (AGPL-3.0 vs. MIT)

- **Status**: Proposed / Pending Human Decision
- **Date**: 2026-07-25
- **Authors**: Tayari Execution Orchestrator

## Context & Background

Tayari is a self-hosted AI job-search platform featuring automated web scraping (Hermes), local LLM integration, automated document generation (Typst), and an Model Context Protocol (MCP) server architecture. As we prepare the repository to flip public, we must establish a clear open-source license.

## Options Considered

### Option A: AGPL-3.0 (GNU Affero General Public License v3.0) — RECOMMENDED
- **Pros**:
  - **Protects against closed-cloud SaaS cloning**: Requires network users interacting with modified AGPL-covered software over a network API to be offered corresponding source code for those modifications.
  - **Ideal for Open-Core Monopolization Prevention**: Ensures commercial hosted offerings contribute back their modifications to the core project.
- **Cons**:
  - **Higher enterprise friction**: Some commercial enterprises restrict AGPL dependencies in their internal developer tooling.

### Option B: MIT License
- **Pros**:
  - **Maximum Adoption**: Permissive, zero friction for developers, enterprise contributions, or downstream forks.
- **Cons**:
  - **Risk of Unreciprocated Exploitation**: Cloud vendors can take Tayari, host it behind closed paywalls, and never contribute back to the open-source codebase.

## Decision Recommendation

**Recommended Option**: **AGPL-3.0**.
AGPL-3.0 balances developer freedom with protection against unreciprocated cloud exploitation, while permitting self-hosters and individuals to run Tayari for free. Note: The final licensing decision must undergo legal review before official selection.

---

> [!IMPORTANT]
> **Human Approval & Legal Review Required**: The repository administrator and legal counsel must explicitly approve or modify the license selection before the public repository flip.
