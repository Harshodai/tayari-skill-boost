import http.client
import socket
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException

from app.api.ai_routes import (
    _extract_imported_job_description,
    _fetch_public_job_description,
    _validate_public_url,
)


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/job",
        "https://user:secret@example.com/job",
        "http://127.0.0.1/job",
        "http://[::1]/job",
        "http://169.254.1.1/job",
        "http://10.0.0.1/job",
    ],
)
def test_validate_public_url_rejects_non_public_targets(url):
    with pytest.raises(HTTPException) as exc_info:
        _validate_public_url(url)
    assert exc_info.value.status_code == 400


def test_validate_public_url_rejects_hostname_with_any_private_resolution():
    resolved = [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443)),
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443)),
    ]
    with patch("app.api.ai_routes.socket.getaddrinfo", return_value=resolved):
        with pytest.raises(HTTPException) as exc_info:
            _validate_public_url("https://jobs.example.com/backend")
    assert exc_info.value.status_code == 400


def test_validate_public_url_accepts_public_hostname_without_network_calls():
    resolved = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]
    with patch("app.api.ai_routes.socket.getaddrinfo", return_value=resolved):
        assert _validate_public_url("https://jobs.example.com/backend") == "https://jobs.example.com/backend"


def test_extract_imported_job_description_strips_non_readable_html():
    title, text = _extract_imported_job_description(
        "text/html; charset=utf-8",
        b"""
        <html><head><title>Senior Backend Engineer</title><style>.hidden{display:none}</style></head>
        <body><script>secretToken = 'do-not-return'</script><h1>Senior Backend Engineer</h1>
        <p>Build resilient Go services, mentor teammates, and improve system reliability.</p></body></html>
        """,
    )
    assert title == "Senior Backend Engineer"
    assert "Build resilient Go services" in text
    assert "secretToken" not in text
    assert ".hidden" not in text


def test_extract_imported_job_description_rejects_short_or_binary_content():
    with pytest.raises(HTTPException) as short_content:
        _extract_imported_job_description("text/plain", b"Too short")
    assert short_content.value.status_code == 422

    with pytest.raises(HTTPException) as unsupported_content:
        _extract_imported_job_description("application/pdf", b"%PDF-1.7")
    assert unsupported_content.value.status_code == 415


def test_fetch_public_job_description_maps_malformed_http_response_to_502():
    connection = Mock()
    connection.request.side_effect = http.client.BadStatusLine("malformed response")

    with patch("app.api.ai_routes._resolve_public_addresses", return_value=["93.184.216.34"]):
        with patch("app.api.ai_routes.http.client.HTTPConnection", return_value=connection):
            with pytest.raises(HTTPException) as exc_info:
                _fetch_public_job_description("http://jobs.example.com/backend")

    assert exc_info.value.status_code == 502
    connection.close.assert_called_once_with()
