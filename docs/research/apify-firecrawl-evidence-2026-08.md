# Apify and Firecrawl Benchmark Evidence

## Official Apify evidence

Apify’s v2 API describes an asynchronous Actor workflow: start an Actor or task, monitor the run by polling the run endpoint, then fetch result items from the default dataset or records from a key-value store. Apify also supports synchronous execution for shorter jobs, but documents a five-minute waiting limit for that mode. The API standardizes JSON responses, pagination, common HTTP errors, and bearer-token authentication. It recommends exponential backoff for rate-limit responses and states that its official clients implement that behavior.[^1]

Apify webhooks send HTTP POST requests on run events. The destination must return a 2xx response; failed responses are retried with exponential backoff up to eleven retries. Apify warns that a webhook can be invoked more than once, so receivers must be idempotent. It also recommends a secret token in the webhook URL and says time-consuming receivers should respond immediately and use an internal queue for completion work.[^2]

## Official Firecrawl evidence

Firecrawl’s Search API returns clean structured result data and can optionally scrape result content in the same call. It supports web, news, and image source types, domain inclusion/exclusion, location and time filters, developer/GitHub categories, and markdown or link formats. Firecrawl documents both a one-step search-plus-scrape path and a two-step search-then-selective-scrape path; the latter is more flexible when filtering or ranking results before retrieval.[^3]

Firecrawl’s Crawl API is an asynchronous recursive crawl. It handles sitemap discovery, JavaScript rendering, rate limits, path/depth controls, and result pagination. It exposes polling, WebSocket watcher, and webhook delivery modes. Crawl webhooks include started, page, completed, and failed events, and Firecrawl requires HMAC-SHA256 verification through `X-Firecrawl-Signature` before processing webhook data. Firecrawl also documents result expiry, a dedicated crawl-errors endpoint, and the need to follow `next` pagination for large responses.[^4]

## Benchmark implications for JobTayari

The strongest common pattern is not simply “call a scraper.” It is a durable external-job state machine: create a provider job, persist an idempotency key and provider job ID, accept authenticated webhook or polling updates, normalize partial and terminal states, fetch paginated results, verify signatures, retry bounded failures, and record cost/provenance/tenant ownership. JobTayari’s current Firecrawl adapter is stronger on capability gates, approved endpoints, URL sanitization, bounded results, and provenance capture. Its current Apify adapter is stronger on Actor allowlisting and tenant-safe configuration, but it currently returns only a run acknowledgement and does not yet poll or consume a dataset, so it is not equivalent to Apify’s documented end-to-end result workflow.

[^1]: [Apify API v2 documentation](https://docs.apify.com/api/v2)
[^2]: [Apify webhook actions and retry/security documentation](https://docs.apify.com/integrations/webhooks/actions)
[^3]: [Firecrawl Search documentation](https://docs.firecrawl.dev/features/search)
[^4]: [Firecrawl Crawl documentation](https://docs.firecrawl.dev/features/crawl)
