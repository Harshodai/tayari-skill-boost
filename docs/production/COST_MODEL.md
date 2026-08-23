# Tayari Skill Boost — Cost Model

## Cost accounting rule

No live account pricing or production spend was available during this pass. The model therefore identifies cost drivers and measurement formulas without fabricating dollar values. Provider prices, regions, plans, quotas, and negotiated terms must be attached before a financial approval.

| Cost area | Fixed driver | Variable driver | Unit to measure | Main explosion mode |
|---|---|---|---|---|
| Compute | EC2/Kubernetes node base cost | CPU/memory hours, replicas, worker concurrency | Cost per service-hour and per successful workflow | Unbounded worker/AI concurrency |
| Database/Auth | Supabase/Postgres plan or managed database base cost | Compute/storage/egress, connections, backups | Cost per active account and per durable workflow | Large scans, connection exhaustion, retention growth |
| Redis/queue | Host or managed Redis base cost | Memory, ops, persistence, replicas | Cost per queued job and queue-hour | Retry storm and unbounded backlog |
| Object/file storage | Bucket/base plan | GB stored, requests, egress, retention | Cost per uploaded document and GB-month | Unbounded uploads and retention |
| LLM | Provider account/base quota | Input/output tokens, model, retries, fallback | Cost per AI request and successful result | Prompt amplification, expensive model routing, retry loops |
| Scraping/providers | SaaS plan/base quota | Requests, pages, results, 429 retries | Cost per accepted job/result | Broad crawling and fallback cascade |
| Email/OAuth/billing | Provider plan | Messages, auth events, payment actions | Cost per completed workflow | Webhook replay, abuse, unnecessary notifications |
| Observability | Dashboard/log/metric base plan | Log volume, metric cardinality, trace volume, retention | Cost per active account and GB/day | High-cardinality labels and verbose payloads |
| CI/CD/registry | Runner and registry base | Build minutes, image storage, egress | Cost per release artifact | Repeated builds and large unpruned images |

## Unit economics formulas

- **Cost per active user:** total allocated monthly cost / active users in the same period.
- **Cost per successful core action:** allocated compute, provider, storage, and telemetry cost / successful candidate-reviewed package completion.
- **Cost per AI request:** model token cost plus attributable retry, cache-miss, and provider overhead.
- **Cost per stored GB:** storage and backup cost / retained data volume.
- **Cost per background job:** worker, queue, provider, and telemetry cost / terminal job.

## Required measurements

Record provider/model, input and output tokens, latency, cache hit, retries, fallback, user/feature class, success/failure, and estimated cost for each AI operation. Attribute storage and telemetry by coarse service/feature class, not raw user identity. Validate the model at 10, 100, 1,000, 10,000, and 100,000 user scenarios, labeling forecasts as estimated.

## Current risks

The highest cost risks are AI token amplification, broad scraping/provider fallback, queue retry storms, browser sessions, upload/retention growth, and high-cardinality telemetry. Production must have per-user, per-feature, and system-level budgets with graduated controls rather than relying on a single global kill switch.

## References

- `scripts/perf_check.sh` — safe benchmark inputs.
- `docs/operations/production-deployment-observability-checklist.md` — budgets and telemetry requirements.
- `deploy/aws/provision.sh` — budget-before-provisioning guard.
- `PRODUCTION_ISSUES.md` — provider/capacity/cost evidence gaps.
