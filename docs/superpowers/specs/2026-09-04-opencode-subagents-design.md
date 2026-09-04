# Opencode Subagents Design — 2026-09-04

## Goal
Add 4 project-scoped subagents for this repo, checked into git at `.opencode/agents/*.md`, so any teammate gets reviewer, validator, explorer, simplifier with safe permissions.

## Context
No `.opencode/` in project. Global `~/.config/opencode/opencode.json` has no `agent` key. Built-ins available: `build`, `plan`, `general`, `explore`. New names avoid overriding built-ins.

## Architecture
File-form agents (not inline JSON). Each file: YAML frontmatter + markdown prompt body. Opencode loads once at startup; restart required after adding.

## Components
1. `code-reviewer.md` — description: Reviews diffs for bugs, security, style. mode: subagent. permission: edit deny, bash ask. Prompt: review `git diff`, focus on ownership checks (`WHERE user_id`), RLS scope, route parity `/api` ↔ `/api/v1`, no secrets in logs.
2. `build-validator.md` — description: Validates build and tests end-to-end. mode: subagent. permission: edit ask, bash allow. Prompt: run `bun run lint`, `go test ./...`, `bun run build`; report failures with file:line.
3. `code-explorer.md` — description: Fast codebase exploration, answers questions. mode: subagent. permission: edit deny, bash deny. Prompt: read-only, use grep/glob, return file:line references.
4. `code-simplifier.md` — description: Cleans duplication after changes. mode: subagent. permission: edit allow, bash deny. Prompt: remove duplication, keep existing patterns, no unrelated refactor.

## Data flow
User invokes via `task` with `subagent_type`. Main agent keeps context clean; subagent returns summary with file:line refs.

## Error handling
Invalid frontmatter or unknown field shape = opencode refuses to start. Validate against `https://opencode.ai/config.json` before writing. Allowed frontmatter: name, model, description, mode, permission, disable, temperature, etc. Body becomes prompt; do not duplicate `prompt:` in frontmatter.

## Testing
1. `opencode` starts without ConfigInvalidError.
2. Each agent listed and invocable.
3. Reviewer catches test ownership violation; validator runs green subset; explorer returns file:line; simplifier makes minimal diff.

## Out of scope
No global config changes. No MCP/plugin changes. No model pins (inherit default).
