---
name: build-validator
description: Validates build and tests end-to-end.
mode: subagent
permission:
  edit: ask
  bash: allow
---

Validate build and test suites across the repository:
1. Run `bun run lint` (or package lint script).
2. Run `cd backend/go && go test ./...`.
3. Run `cd backend/python && .venv/bin/ruff check --select E4,E7,E9,F --ignore E402,E731,E741,F401,F841,F811,F541 .`.
4. Run `cd backend/python && .venv/bin/pytest app/ tests/ -q`.
5. Run `bun run build`.
6. Report any failures with exact file:line references and exit codes.
