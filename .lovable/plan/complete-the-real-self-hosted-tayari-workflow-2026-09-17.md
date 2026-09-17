# Complete the real self-hosted Tayari workflow

## Goal 

Pull latest changes and then start the goal Make resume optimization, cover letters, job search, agent runs, Stripe test credits, and verified receipts work as one honest local Docker product. The real application flow will stop for the user to handle credentials, sensitive questions, CAPTCHA, legal declarations, and the final submit action.

The hosted Lovable site will not be connected to a private local machine in this phase. The selected target is **local proof only**; exposing a laptop through a tunnel would be insecure and unreliable. The same public Go API contract will remain deployable later to the existing hardened AWS/VPS path.

## Work plan

### 1. Repair the transaction and evidence contracts

- Trace and align signup/onboarding, checkout pack selection, Stripe test checkout, signed webhook fulfillment, credit balance, purchases, ledger, and dashboard display.
- Add durable, idempotent reconciliation for a verified receipt whose one-credit debit initially fails.
- Add a real refund-request path or remove unsupported refund promises; failed and unverifiable submissions remain explicitly zero-charge.
- Confirm Python and the frontend read/write the same database receipt records.

### 2. Unify the manual-submit safety boundary

- Route every browser submission attempt through one server-enforced policy gate.
- Search and prepare the application automatically, but pause on login, password, OTP/MFA, CAPTCHA, terms, work authorization, sponsorship, salary, EEO, and final submission.
- Keep LinkedIn read-only and enforce the ATS origin allowlist.
- After the user submits, accept only ATS confirmation evidence as “verified”; candidate confirmation alone remains “unverified.”

### 3. Make the complete Docker stack reproducible

- Validate and repair the Compose wiring for local database/auth/storage, Go gateway, Python AI engine, Redis, Celery worker/beat, browser worker, and frontend.
- Add a safe configuration bootstrap/check command that reports missing values without printing secrets.
- Keep Go as the only public backend; Python, workers, Redis, and the database remain private to the Docker network.
- Verify health, readiness, queue processing, cancellation, and provider capability states.

### 4. Prove the workflows

- Add a deterministic ATS fixture for CI that records a submission and emits a verifiable receipt without touching a real employer.
- Exercise signup → onboarding → Stripe test checkout → signed webhook → credit balance/purchase/ledger → dashboard.
- Exercise job search → select → tailored resume/cover letter → agent run → human handoff → receipt verification → one-credit debit → dashboard.
- Then run one supervised real-job journey. The run pauses for the user’s manual submit; the system verifies the real ATS confirmation afterward.
- Add two-user ownership negatives and failure tests for duplicate webhooks, queue outage, debit retry, unverifiable receipts, cancellation, and handoff replay.

### 5. Open-source safely

- Publish the self-hosted community core only after an export audit removes secrets, private deployment configuration, commercial datasets, proprietary readiness/scoring rubrics, private prompts, provider credentials, production telemetry, and customer data.
- Include Docker setup, local/Ollama support, resume rendering, pipeline, manual-submit workflow, MCP contracts, connector interfaces, fixtures, safety tests, and contribution docs.
- Keep managed hosting, verified listings/employer data, paid credit operations, proprietary scoring/evals, production browser operations, team/admin controls, and support commercial.
- Add an automated release allowlist and secret/license scan so the open-source package fails closed when an unapproved file appears.

## Technical notes

- Frontend calls continue through `apiFetch('/v1/...')`; it never calls Python directly.
- All backend database queries remain owner-scoped because raw backend connections bypass row-level policies.
- Billing fulfillment and receipt debits use stable idempotency keys.
- `AUTONOMOUS_SUBMIT_ENABLED=false` remains mandatory and server-enforced.
- No product status will claim “verified” without stored external ATS evidence.

## Validation gates

- Docker Compose configuration and all service health checks pass.
- Go tests, Python compile/tests, frontend tests/typecheck/build, migration checks, and the production security gate pass.
- Stripe test checkout and webhook are observed end to end without a real charge.
- The fixture workflow completes end to end; the real-job workflow completes only after the user performs the final submission.
- `lessons.md` receives the required dated completion entry.

## Current blockers for execution

- Docker is not installed in this sandbox, so containers cannot be started here until a Docker-capable runner is available.
- The local stack configuration file is missing and required local values are blank; the bootstrap will generate app-owned secrets and request only third-party credentials when needed.
- A real ATS proof requires the user to choose a real job and take over at the protected human-submit step.