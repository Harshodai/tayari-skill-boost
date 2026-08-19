from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'research' / 'similarweb-frontend-automation-2026-08.json'
OUT.parent.mkdir(parents=True, exist_ok=True)

client = ApiClient()
domains = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'huntr.co']
results: dict[str, object] = {
    'collected_at': date.today().isoformat(),
    'scope': 'Frontend automation UX comparator research for JobTayari',
    'domains': {},
}

for domain in domains:
    item: dict[str, object] = {}
    for api_name, query in [
        ('SimilarWeb/get_global_rank', {}),
        ('SimilarWeb/get_visits_total', {
            'country': 'world', 'granularity': 'monthly', 'start_date': '2026-01', 'end_date': '2026-06'
        }),
        ('SimilarWeb/get_bounce_rate', {
            'country': 'world', 'granularity': 'monthly', 'start_date': '2026-01', 'end_date': '2026-06'
        }),
        ('SimilarWeb/get_traffic_sources_desktop', {
            'country': 'world', 'granularity': 'monthly', 'start_date': '2026-04', 'end_date': '2026-06'
        }),
    ]:
        try:
            item[api_name.rsplit('/', 1)[-1]] = client.call_api(
                api_name,
                path_params={'domain': domain},
                query=query or None,
            )
        except Exception as exc:  # provider availability varies by account/domain
            item[api_name.rsplit('/', 1)[-1]] = {'status': 'unavailable', 'error_type': type(exc).__name__}
    results['domains'][domain] = item

OUT.write_text(json.dumps(results, indent=2, sort_keys=True, default=str) + '\n', encoding='utf-8')
print(OUT)
