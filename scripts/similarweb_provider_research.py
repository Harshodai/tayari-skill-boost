from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'research' / 'similarweb-apify-firecrawl-2026-08.json'
OUT.parent.mkdir(parents=True, exist_ok=True)

client = ApiClient()
domains = ['apify.com', 'firecrawl.dev', 'scrapy.org', 'playwright.dev', 'crawlee.dev']
results: dict[str, object] = {
    'collected_at': date.today().isoformat(),
    'scope': 'SimilarWeb benchmark for web-research automation providers and implementation alternatives',
    'domains': {},
}

queries = [
    ('get_global_rank', {}),
    ('get_visits_total', {'country': 'world', 'granularity': 'monthly', 'start_date': '2026-01', 'end_date': '2026-06'}),
    ('get_bounce_rate', {'country': 'world', 'granularity': 'monthly', 'start_date': '2026-01', 'end_date': '2026-06'}),
    ('get_traffic_sources_desktop', {'country': 'world', 'granularity': 'monthly', 'start_date': '2026-04', 'end_date': '2026-06'}),
]

for domain in domains:
    item: dict[str, object] = {}
    for api_suffix, query in queries:
        api_name = f'SimilarWeb/{api_suffix}'
        try:
            item[api_suffix] = client.call_api(api_name, path_params={'domain': domain}, query=query)
        except Exception as exc:
            item[api_suffix] = {'status': 'unavailable', 'error_type': type(exc).__name__}
    results['domains'][domain] = item

OUT.write_text(json.dumps(results, indent=2, sort_keys=True, default=str) + '\n', encoding='utf-8')
print(OUT)
