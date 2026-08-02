"""Tests for the offline HTML pipeline dashboard generator."""

from app.export.pipeline_dashboard_generator import PipelineDashboardGenerator


def test_escapes_user_controlled_fields():
    stats = {"total_applications": 1, "interviews": 0, "offers": 0}
    apps = [
        {
            "company": '<script>alert("x")</script>',
            "role": "Dev & Ops",
            "status": "interviewing",
            "last_updated_at": "2026-08-01",
        }
    ]
    html = PipelineDashboardGenerator.generate_html_report(stats, apps)
    assert "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;" in html
    assert "<script>" not in html
    assert "Dev &amp; Ops" in html
    assert "&quot;x&quot;" in html


def test_fallback_values_still_render():
    stats = {"total_applications": 1, "interviews": 0, "offers": 0}
    apps = [{"role": "Dev"}]
    html = PipelineDashboardGenerator.generate_html_report(stats, apps)
    assert "N/A" in html
    assert "submitted" in html
