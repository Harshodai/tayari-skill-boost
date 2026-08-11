#!/usr/bin/env python3
"""Create a reproducible SimilarWeb benchmark for direct Job Tayari competitors.

The script writes raw API responses for auditability and a compact PNG chart for
human review. It intentionally treats unavailable API responses as unavailable
rather than substituting estimates.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt

sys.path.append('/opt/.manus/.sandbox-runtime')
from data_api import ApiClient  # type: ignore[import-not-found]

OUTPUT = Path('/home/ubuntu/tayari-skill-boost/docs/research/similarweb_benchmark')
DOMAINS = ['jobright.ai', 'simplify.jobs', 'tealhq.com']
START = '2026-02'
END = '2026-07'


def unwrap(result: Any) -> Any:
    """Return useful API data while retaining unexpected shapes for inspection."""
    if isinstance(result, dict):
        for key in ('data', 'result', 'results'):
            if key in result:
                return result[key]
    return result


def latest_visits(data: Any) -> float | None:
    """Extract the most recent visits value across common API result shapes."""
    if isinstance(data, dict):
        for key in ('visits', 'records', 'data'):
            value = data.get(key)
            extracted = latest_visits(value)
            if extracted is not None:
                return extracted
        for key in ('value', 'visits_total', 'total_visits'):
            value = data.get(key)
            if isinstance(value, (float, int)):
                return float(value)
    if isinstance(data, list):
        for item in reversed(data):
            extracted = latest_visits(item)
            if extracted is not None:
                return extracted
    return None


def extract_rank(data: Any) -> float | None:
    if isinstance(data, dict):
        for key in ('global_rank', 'rank', 'value'):
            value = data.get(key)
            if isinstance(value, (int, float)):
                return float(value)
        for value in data.values():
            extracted = extract_rank(value)
            if extracted is not None:
                return extracted
    if isinstance(data, list):
        for item in data:
            extracted = extract_rank(item)
            if extracted is not None:
                return extracted
    return None


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    client = ApiClient()
    summary: list[dict[str, Any]] = []

    for domain in DOMAINS:
        record: dict[str, Any] = {'domain': domain, 'status': 'ok'}
        try:
            visits = client.call_api(
                'SimilarWeb/get_visits_total',
                path_params={'domain': domain},
                query={
                    'country': 'world',
                    'granularity': 'monthly',
                    'start_date': START,
                    'end_date': END,
                    'main_domain_only': 'true',
                },
            )
            rank = client.call_api(
                'SimilarWeb/get_global_rank',
                path_params={'domain': domain},
                query={'main_domain_only': 'true'},
            )
            payload = {'visits': visits, 'rank': rank}
            (OUTPUT / f'{domain}.json').write_text(json.dumps(payload, indent=2, default=str))
            record['latest_monthly_visits'] = latest_visits(unwrap(visits))
            record['global_rank'] = extract_rank(unwrap(rank))
        except Exception as exc:  # API availability is a valid research outcome.
            record.update({'status': 'unavailable', 'reason': str(exc)})
        summary.append(record)

    (OUTPUT / 'summary.json').write_text(json.dumps(summary, indent=2, default=str))
    lines = [
        '# SimilarWeb Competitive Benchmark',
        '',
        f'Period requested: **{START} to {END}**. Domains are approximate market proxies, not market-share measurements.',
        '',
        '| Domain | Latest monthly visits | Global rank | Data status |',
        '|---|---:|---:|---|',
    ]
    for row in summary:
        visits = row.get('latest_monthly_visits')
        rank = row.get('global_rank')
        lines.append(
            f"| {row['domain']} | {visits:,.0f} | {rank:,.0f} | {row['status']} |"
            if isinstance(visits, float) and isinstance(rank, float)
            else f"| {row['domain']} | — | — | {row['status']} |"
        )
    lines.append('')
    lines.append('Unavailable data is intentionally shown as unavailable; no traffic values are inferred.')
    (OUTPUT / 'README.md').write_text('\n'.join(lines) + '\n')

    available = [row for row in summary if isinstance(row.get('latest_monthly_visits'), float)]
    fig, ax = plt.subplots(figsize=(8, 4.5))
    if available:
        domains = [row['domain'] for row in available]
        values = [row['latest_monthly_visits'] for row in available]
        bars = ax.bar(domains, values, color=['#2f80ed', '#5b8ff9', '#82b1ff'][:len(domains)])
        ax.bar_label(bars, labels=[f'{value:,.0f}' for value in values], padding=3, fontsize=9)
        ax.set_ylabel('Latest reported monthly visits')
        ax.set_title('Job-search AI competitor web traffic (SimilarWeb)')
    else:
        ax.text(0.5, 0.55, 'No usable SimilarWeb values were returned', ha='center', va='center', fontsize=14)
        ax.text(0.5, 0.40, 'This chart deliberately does not fabricate estimates.', ha='center', va='center', fontsize=10)
        ax.set_axis_off()
    fig.text(0.5, 0.02, f'Requested period: {START}–{END}; source: SimilarWeb API', ha='center', fontsize=8)
    fig.tight_layout(rect=(0, 0.06, 1, 1))
    fig.savefig(OUTPUT / 'traffic_benchmark.png', dpi=180)


if __name__ == '__main__':
    main()
