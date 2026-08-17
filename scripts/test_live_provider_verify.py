from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

import live_provider_verify as verify


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        if self.path == "/api/health":
            body = b'{"status":"ok","service":"go-gateway"}'
            self.send_response(200)
        elif self.path == "/metrics":
            if self.headers.get("X-Internal-Token") != "synthetic-metrics":
                body = b'{"error":"unauthorized"}'
                self.send_response(401)
            else:
                body = b'{"counters":{"llm_errors_total":0}}'
                self.send_response(200)
        elif self.path == "/readyz":
            body = b'{"status":"not_ready"}'
            self.send_response(503)
        else:
            body = b'{"error":"not_found"}'
            self.send_response(404)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Request-ID", "synthetic-request")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        return


@pytest.fixture(scope="module")
def server_url():
    server = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield f"http://{host}:{port}"
    finally:
        server.shutdown()
        thread.join(timeout=2)


def test_dry_run_reports_blocked_not_green(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    results = verify.run("local", None, None, allow_live=False, timeout=0.2)
    assert len(results) == 12
    assert {result.status for result in results} == {"blocked_by_configuration"}
    assert all(result.side_effect == "none" for result in results)


def test_live_read_only_probe_records_provider_status_without_secret(server_url):
    results = verify.run("staging", server_url, None, allow_live=True, timeout=1.0)
    go_results = {result.check: result for result in results if result.provider == "go-gateway"}
    assert go_results["health"].status == "pass"
    assert go_results["health"].request_id == "synthetic-request"
    assert go_results["readiness"].status == "degraded"
    serialized = json.dumps([result.evidence for result in results])
    assert "synthetic-secret" not in serialized
    assert "Authorization: Bearer" not in serialized


def test_all_fixture_http_probes_are_read_only(server_url):
    results = verify.run("staging", server_url, None, allow_live=True, timeout=1.0)
    assert all(result.side_effect == "none" for result in results)


def test_protected_metrics_probe_uses_token_without_leaking_it(monkeypatch, server_url):
    monkeypatch.setenv("METRICS_TOKEN", "synthetic-metrics")
    monkeypatch.setenv("SENTRY_DSN", "synthetic-sentry-dsn")
    results = verify.run("staging", server_url, None, allow_live=True, timeout=1.0)
    metric_results = [result for result in results if result.check == "metrics-readiness"]
    assert len(metric_results) == 1
    assert metric_results[0].status == "pass"
    serialized = json.dumps([result.evidence for result in results])
    assert "synthetic-metrics" not in serialized
    assert "synthetic-sentry-dsn" not in serialized
