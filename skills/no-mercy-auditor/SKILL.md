---
name: no-mercy-auditor
description: "Performs ultra-ruthless, evidence-based audits of software products, focusing on the gap between marketing vision and technical reality. Use for: auditing repositories, validating product claims, identifying 'theatrical' vs. 'functional' features, and architecting category-killing strategic plans."
---

# No-Mercy Auditor

This skill provides a structured, uncompromising workflow for auditing software products and repositories. It is designed to strip away marketing fluff and expose the underlying technical reality, enabling the creation of "10/10" strategic plans for market dominance.

## Core Principles

1.  **Trust, but Verify (Ruthlessly):** Never take a UI claim or a PRD at face value. If a button says "Auto-Apply," find the backend function that submits the form.
2.  **Expose the "Theatrical UI":** Identify where the user experience is driven by choreography (timeouts, simulated logs, optimistic UI) rather than functional engines.
3.  **Audit the "Intelligence":** Scrutinize LLM prompts, heuristic rubrics, and data-handling logic. Determine if "AI" is a core engine or just a thin wrapper.
4.  **No Mercy for Placeholders:** A stub is a failure until it's a feature. Flag every "TODO," "placeholder," and "mock" as a critical gap.

## The Audit Workflow

### Phase 1: Deep Intelligence Gathering
*   **Re-clone & Inspect:** Always start with the absolute latest state of the repository.
*   **Skill-Finder & Gem-Seeker:** Use `/internet-skill-finder` and `/github-gem-seeker` to identify the "Legendary" technologies that *should* be integrated to achieve a 10/10 product.
*   **Competitive Analysis:** Use `/similarweb-analytics` and `/youtube-video-research` to find the blind spots and weaknesses of current market leaders.

### Phase 2: Technical Validation (The "Truth-Check")
*   **Trace the Data Flow:** Follow a user action from the frontend component to the API route, then to the service layer, and finally to the persistence/execution engine.
*   **Audit the Prompts:** Read every LLM prompt in the codebase. Look for truncation, poor instructions, and lack of guardrails.
*   **Security & Integrity Check:** Validate that guardrails (PII detection, truthfulness checks) are functional and non-bypassable.

### Phase 3: The Ruthless Report
*   **Reality vs. Vision:** Use a structured "Verdict" system (PASS, FAIL, PARTIAL, CRITICAL FAIL) for every core requirement.
*   **Evidence-Based Insights:** Every claim must be backed by a file path and line number.
*   **Ruthless Q&A:** Generate the hard questions that the founders/developers need to answer, and provide the unvarnished truth as the answer.

### Phase 4: The 10/10 Master Plan
*   **Category-Killing Strategy:** Architect a plan that doesn't just "improve" the product but makes it a category-killer.
*   **Uncompromising Integrations:** Mandate the integration of specific, proven open-source technologies (the "Gems").
*   **Multi-Departmental Roadmap:** Provide a concrete, phased plan covering Discovery, Execution, Intelligence, Readiness, and Security.

## Audit Checklist (Job-Seeker Platforms)

| Requirement | Audit Point | Evidence Required |
| :--- | :--- | :--- |
| **Automation** | Does "Auto-Apply" actually submit forms? | Backend service implementation |
| **Intelligence** | Is scoring heuristic or predictive? | Scorer logic and data source |
| **Connectivity** | Are connectors (Gmail/LinkedIn) real? | API/OAuth route implementation |
| **Integrity** | Can guardrails be bypassed? | Gate orchestration logic |
| **Visuals** | Is there real-time agent visualization? | Frontend component state handling |

## Reusable Resources

*   **`references/audit_checklist.md`**: A comprehensive checklist for various product categories.
*   **`scripts/check_stubs.py`**: A script to automatically scan the codebase for "TODO," "placeholder," and empty function stubs.
*   **`templates/ruthless_report_template.md`**: A boilerplate for generating the final audit report.
