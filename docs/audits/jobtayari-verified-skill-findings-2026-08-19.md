# Verified Agent Skill Findings — 2026-08-19

The real-time skill fetch failed because the connector response could not be parsed, so the skill finder fell back to its cached catalog. The catalog is marked `using_cache: true`; these are discovery signals, not a substitute for reviewing each repository’s current code.

## Relevant cached skills

| Skill | Source | Useful lesson for JobTayari | Import decision |
|---|---|---|---|
| `plannotator` | [backnotprop/plannotator](https://github.com/backnotprop/plannotator) | Plan review with visual annotation and offline sharing can improve human review quality. | Study the UX pattern; do not import until token/tenant/expiry and data-sharing risks are reviewed. |
| `claude-skills` | [jeffallan/claude-skills](https://github.com/jeffallan/claude-skills) | Discovery, planning, execution, and retrospectives should be separate workflow phases. | Adopt the lifecycle concept in repository docs and task UX; no direct code import. |
| `defense-in-depth` | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/defense-in-depth) | Security needs multiple independent layers rather than one prompt or one test. | Adopt as a mandatory release-review checklist. |
| `systematic-debugging` | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging) | Reproduce, localize, fix the root cause, and rerun the full validation matrix. | Adopt as the default incident and regression workflow. |
| `Trail of Bits Security Skills` | [trailofbits/skills](https://github.com/trailofbits/skills) | Static analysis, CodeQL/Semgrep, variant analysis, and fix verification provide stronger assurance than unit tests alone. | Add targeted security-analysis backlog and independent review requirement. |
| `varlock-claude-skill` | [wrsmith108/varlock-claude-skill](https://github.com/wrsmith108/varlock-claude-skill) | Environment variables and secrets need protection from sessions, terminals, logs, and commits. | Use as design inspiration; retain JobTayari’s own secret scanner and vault policy until compatibility is verified. |
| `webapp-testing` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | Browser-level testing should verify real UI state and failure banners, not only unit behavior. | Add approval-channel and disabled-route Playwright coverage. |
| `deep-research` | [sanjay3290/ai-skills](https://github.com/sanjay3290/ai-skills/tree/main/skills/deep-research) | Competitive research needs explicit source tracking and multi-step synthesis. | Adopt source-register and confidence labeling; do not permit an external skill to override repository safety rules. |
| `postgres` | [sanjay3290/ai-skills](https://github.com/sanjay3290/ai-skills/tree/main/skills/postgres) | Database tools should be read-only by default and use defense-in-depth connection controls. | Adopt for any future agent database tool; never permit arbitrary SQL mutation. |

## No-repeat rule from the catalog

A skill description is not a security review. No skill may be imported into production without source review, license review, tool inventory, secret-flow review, tenant-boundary review, test coverage, provenance behavior, and a disable/rollback path.
