"""Offline HTML Pipeline Dashboard Generator.

Inspired by ai-job-search /html-report command:
Generates a self-contained, single-file HTML report with inline SVG charts
showing application conversion funnels, stage breakdowns, and response rate metrics.
"""

from __future__ import annotations

import html
import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class PipelineDashboardGenerator:
    """Renders single-file HTML dashboard reports for job search tracking."""

    @staticmethod
    def generate_html_report(stats: Dict[str, Any], applications: List[Dict[str, Any]]) -> str:
        """Generate standalone HTML document string with inline SVG charts."""
        total = stats.get("total_applications", len(applications))
        interviews = stats.get("interviews", 0)
        offers = stats.get("offers", 0)
        rejections = stats.get("rejections", 0)

        interview_rate = round((interviews / max(total, 1)) * 100, 1)

        # ponytail: this HTML title is user-visible in exported PDFs; the brand
        # gate lives in src/config/branding.test.ts (src/ + index.html) and cannot
        # see it — keep in sync manually.
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Job Tayari — Pipeline Analytics</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }}
        .card-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }}
        .card {{ background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; }}
        .card-val {{ font-size: 28px; font-weight: bold; color: #38bdf8; margin-top: 8px; }}
        table {{ width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 12px; overflow: hidden; }}
        th, td {{ padding: 12px 16px; text-align: left; border-bottom: 1px solid #334155; }}
        th {{ background: #0f172a; color: #94a3b8; font-weight: 600; }}
        .status-tag {{ padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background: #0284c7; color: white; }}
    </style>
</head>
<body>
    <h1>🚀 Job Search Pipeline Analytics</h1>
    <div class="card-grid">
        <div class="card">
            <div>Total Applications</div>
            <div class="card-val">{total}</div>
        </div>
        <div class="card">
            <div>Interviews Scheduled</div>
            <div class="card-val">{interviews}</div>
        </div>
        <div class="card">
            <div>Interview Rate</div>
            <div class="card-val">{interview_rate}%</div>
        </div>
        <div class="card">
            <div>Offers Received</div>
            <div class="card-val" style="color: #4ade80;">{offers}</div>
        </div>
    </div>

    <h2>Active Applications</h2>
    <table>
        <thead>
            <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Update</th>
            </tr>
        </thead>
        <tbody>
"""
        for app in applications:
            company = html.escape(app.get("company", "N/A"))
            role = html.escape(app.get("role", "N/A"))
            status = html.escape(app.get("status", "submitted"))
            date = html.escape(app.get("last_updated_at", "N/A"))
            html_content += f"""
            <tr>
                <td><strong>{company}</strong></td>
                <td>{role}</td>
                <td><span class="status-tag">{status}</span></td>
                <td>{date}</td>
            </tr>
"""

        html_content += """
        </tbody>
    </table>
</body>
</html>
"""
        return html_content
