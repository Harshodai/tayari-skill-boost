# MCP Tool Governance

## Purpose

JobTayari has one public MCP surface: the authenticated Supabase `mcp` Edge Function. The Python `MCPManager` is an internal compatibility registry used by the agent runtime and is not an external MCP server. This distinction is deliberate. A second discoverable registry would create an authorization shadow, make tool annotations non-authoritative, and allow policy drift between clients.

## Classification

| Tool | Class | Mutates candidate data or invokes a write path | `readOnlyHint` | Launch control |
|---|---|---:|---:|---|
| `get_profile` | Candidate workspace read | No | `true` | Authenticated MCP session |
| `search_saved_jobs` | Candidate workspace read | No | `true` | Authenticated MCP session |
| `list_applications` | Candidate workspace read | No | `true` | Authenticated MCP session |
| `get_pipeline` | Candidate workspace read | No | `true` | Authenticated MCP session |
| `get_ats_score` | AI analysis read | No | `true` | Authenticated MCP session |
| `get_interview_questions` | AI preparation read | No | `true` | Authenticated MCP session |
| `get_skill_gaps` | AI analysis read | No | `true` | Authenticated MCP session |
| `get_market_salary` | External research read | No | `true` | Authenticated MCP session; provider gates apply |
| `check_company` | External research read | No | `true` | Authenticated MCP session; provider gates apply |
| `save_job` | Candidate workspace write | Yes | `false` | `CAPABILITY_MCP_WRITE_TOOLS=true` |
| `add_to_pipeline` | Candidate workspace write | Yes | `false` | `CAPABILITY_MCP_WRITE_TOOLS=true` |
| `optimize_resume` | AI artifact write | Yes | `false` | `CAPABILITY_MCP_WRITE_TOOLS=true` |
| `generate_cover_letter` | AI artifact write | Yes | `false` | `CAPABILITY_MCP_WRITE_TOOLS=true` |
| `report_outcome` | Outcome write | Yes | `false` | `CAPABILITY_MCP_WRITE_TOOLS=true` |

The write capability is **default-off**. An unset, empty, malformed, or false-like `CAPABILITY_MCP_WRITE_TOOLS` value denies all five mutating tools. The handler returns a machine-readable `disabled_by_launch_scope` error containing the capability name and tool name. Authentication is checked before capability disclosure, so unauthenticated callers do not learn write-surface details.

## Approval boundary

MCP write authorization is not equivalent to approval for autonomous external action. Enabling candidate-workspace writes may allow a tool to persist a job, create or update an application-tracking record, or request an AI-generated artifact. It does not enable account creation, credential entry, legal declarations, CAPTCHA or MFA handling, application submission, payment, or any other irreversible external action. Those actions remain behind the server-side manual-submit boundary and the canonical durable approval workflow.

Email and WhatsApp notifications are delivery channels for an in-app approval review. Provider acceptance is not proof that a user received, viewed, or approved a request. The approval request remains pending until the canonical in-app transition records an authenticated owner decision.

## Legacy registry rule

`backend/python/app/agent/mcp_manager.py` remains available only for existing internal AgentEngine flows such as workspace file operations and controlled browser navigation. Its tools are marked `internalOnly` by default, are not advertised as public MCP tools, and are not a source of external MCP authorization. The `/agent/tools` diagnostics response explicitly reports `legacy_registry_public: false` and identifies the Supabase function as the canonical MCP endpoint.

## Release requirements

Before enabling MCP writes in staging, operators must verify the capability value in the deployed environment, run authenticated positive and unauthenticated/disabled negative tests, confirm owner-scoped database effects, and inspect redacted audit logs. Production enablement requires the same evidence plus two-user isolation tests and confirmation that autonomous submission remains disabled. A green unit-test result alone is not sufficient evidence for enabling the flag.
