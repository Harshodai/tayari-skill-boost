import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.llm_service import LLMNotConfiguredError

client = TestClient(app)


def test_export_pdf_returns_binary_stream(monkeypatch):
    monkeypatch.setattr("app.export.pdf_exporter.PDFExporter.export", lambda data: b"%PDF-1.4 dummy pdf bytes")
    resp = client.post("/api/v1/export/pdf", json={"resume_json": {"contact": {"name": "Test"}}})
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "attachment; filename=resume.pdf" in resp.headers.get("content-disposition", "")
    assert resp.content == b"%PDF-1.4 dummy pdf bytes"


def test_strategic_analyze_503_on_llm_not_configured(monkeypatch):
    async def mock_fail(*args, **kwargs):
        raise LLMNotConfiguredError("No LLM configured")
    monkeypatch.setattr("app.llm.strategic_analyzer.StrategicAnalyzer.analyze", mock_fail)
    resp = client.post("/api/v1/strategic/analyze", json={"resume_text": "sample"})
    assert resp.status_code == 503
    assert resp.json() == {"error": "ai_service_unavailable"}


def test_cover_letter_503_on_llm_not_configured(monkeypatch):
    async def mock_fail(*args, **kwargs):
        raise LLMNotConfiguredError("No LLM configured")
    monkeypatch.setattr("app.services.cover_letter.CoverLetterGenerator.generate", mock_fail)
    payload = {
        "resume_text": "sample resume",
        "job_description": "sample jd",
        "company_name": "Acme",
        "job_title": "Engineer"
    }
    resp = client.post("/api/v1/cover-letter/generate", json=payload)
    assert resp.status_code == 503
    assert resp.json() == {"error": "ai_service_unavailable"}


def test_cover_letter_422_on_missing_required_fields():
    resp = client.post("/api/v1/cover-letter/generate", json={})
    assert resp.status_code == 422


def test_optimize_resume_stream_413_on_oversized_file():
    big_data = b"a" * (11 * 1024 * 1024)
    files = {"resume_file": ("big_resume.pdf", big_data, "application/pdf")}
    resp = client.post("/api/v1/optimize/stream", files=files)
    assert resp.status_code == 413
