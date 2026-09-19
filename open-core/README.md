# Tayari Community Edition boundary

Tayari's community edition is a self-hostable, candidate-controlled workspace for job research, resume and cover-letter preparation, application tracking, and local AI providers.

## Included

- React workspace and shared design system
- Go authentication/API gateway and owner-scoped CRUD
- Python resume, cover-letter, ranking, and provider abstractions
- Local Docker, database, Redis, and worker configuration
- Local Ollama support
- MCP and connector contracts
- Public templates, migrations, fixtures, safety tests, and documentation

## Excluded from community release bundles

- Billing and payment-provider implementations
- Production browser operations and autonomous final-submit capabilities
- Private prompts, scoring rubrics, evaluations, benchmarks, and research vaults
- Customer data, database dumps, screenshots, logs, release evidence, and operational telemetry
- Deployment secrets, credentials, local environment files, signing material, and provider keys
- Proprietary job/employer datasets and managed-hosting operations

The application always pauses before credentials, MFA, CAPTCHA, legal declarations, work-authorization, salary, EEO, or final submission. Candidate approval permits preparation only; it never authorizes Tayari to click an employer's final submit control.

The root repository license does not by itself define a curated release artifact. Run `scripts/check-open-core-boundary.sh` before creating a community bundle; release only reviewed source paths, never the working tree wholesale.