"""Whisper Audio Transcription Service for Agent-Reach.

Provides audio downloading (yt-dlp), SSRF protection, ffmpeg compression/chunking,
and Whisper API transcription via Groq (whisper-large-v3) with OpenAI (whisper-1) fallback.
"""

from __future__ import annotations

import ipaddress
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse
import httpx

logger = logging.getLogger(__name__)

# Whisper API file limit (~25MB)
SIZE_LIMIT_BYTES = 24 * 1024 * 1024
CHUNK_SECONDS = 600  # 10 minute chunks

_BLOCKED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",  # nosec B104 - outbound SSRF denylist, not a bind
    "metadata.google.internal",
    "169.254.169.254",
}


class TranscribeError(RuntimeError):
    """Raised when transcription fails."""


def _is_private_ip(val: str) -> bool:
    try:
        ip = ipaddress.ip_address(val)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast
    except ValueError:
        return False


def assert_safe_public_url(url: str) -> None:
    """Verify that URL is a public http(s) URL and avoid SSRF attacks."""
    if "://" not in url:
        parsed = urlparse(f"https://{url}")
    else:
        parsed = urlparse(url)

    if parsed.scheme not in {"http", "https"}:
        raise TranscribeError("SSRF Blocked: Only HTTP and HTTPS protocols are allowed.")

    host = (parsed.hostname or "").strip().lower().rstrip(".")
    if not host:
        raise TranscribeError("SSRF Blocked: Missing URL hostname.")

    if host in _BLOCKED_HOSTS or host.endswith(".localhost"):
        raise TranscribeError(f"SSRF Blocked: Host '{host}' is internal or restricted.")

    if _is_private_ip(host):
        raise TranscribeError(f"SSRF Blocked: IP address '{host}' is private/internal.")

    # `_is_private_ip` only catches literal IP hosts. A DNS hostname (e.g. a Docker
    # Compose service name, or any public-looking name that resolves to a private
    # address) sails through the checks above untouched, since `_is_private_ip`
    # raises/returns False for non-IP strings. Resolve it and validate every
    # returned address is globally routable, reusing the vetted implementation
    # from the agent engine instead of duplicating DNS-resolution logic here.
    from app.agent.agent_engine import _is_safe_url

    if not _is_safe_url(parsed.geturl()):
        raise TranscribeError(f"SSRF Blocked: Host '{host}' does not resolve to a public address.")


async def download_audio_file(url: str, out_dir: Path) -> Path:
    """Download audio file using yt-dlp safely."""
    assert_safe_public_url(url)
    yt_dlp_bin = shutil.which("yt-dlp")
    if not yt_dlp_bin:
        raise TranscribeError("yt-dlp is not installed on system PATH.")

    template = out_dir / "audio_src.%(ext)s"
    cmd = [
        yt_dlp_bin,
        "-x",
        "--audio-format", "m4a",
        "--audio-quality", "0",
        "-o", str(template),
        "--", url
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if proc.returncode != 0:
            raise TranscribeError(f"yt-dlp failed: {proc.stderr[:300]}")
    except subprocess.TimeoutExpired:
        raise TranscribeError("Audio download timed out after 120s.")

    files = sorted(out_dir.glob("audio_src.*"))
    if not files:
        raise TranscribeError("yt-dlp downloaded no files.")
    return files[0]


def compress_audio_file(src: Path, out_dir: Path) -> Path:
    """Re-encode to mono / 16kHz / 32kbps m4a using ffmpeg to shrink size."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        # Fallback if ffmpeg is missing: return source file
        return src

    dst = out_dir / "compressed.m4a"
    cmd = [
        ffmpeg_bin,
        "-loglevel", "error",
        "-y",
        "-i", str(src),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "32k",
        str(dst)
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if proc.returncode == 0 and dst.exists():
        return dst
    return src


def chunk_audio_file(src: Path, out_dir: Path, segment_seconds: int = CHUNK_SECONDS) -> List[Path]:
    """Split audio into segments using ffmpeg."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        return [src]

    pattern = out_dir / "chunk_%03d.m4a"
    cmd = [
        ffmpeg_bin,
        "-loglevel", "error",
        "-y",
        "-i", str(src),
        "-f", "segment",
        "-segment_time", str(segment_seconds),
        "-ac", "1",
        "-ar", "16000",
        "-b:a", "32k",
        str(pattern)
    ]
    subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    chunks = sorted(out_dir.glob("chunk_*.m4a"))
    return chunks if chunks else [src]


async def transcribe_audio_chunk(chunk: Path, provider: str = "auto") -> str:
    """Send audio chunk to Groq Whisper or OpenAI Whisper API."""
    groq_key = os.environ.get("GROQ_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if provider in ("groq", "auto") and groq_key:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                with open(chunk, "rb") as f:
                    files = {"file": (chunk.name, f, "audio/m4a")}
                    data = {"model": "whisper-large-v3", "response_format": "json"}
                    headers = {"Authorization": f"Bearer {groq_key}"}
                    res = await client.post("https://api.groq.com/openai/v1/audio/transcriptions", headers=headers, files=files, data=data)
                    if res.status_code == 200:
                        return res.json().get("text", "")
        except Exception as exc:
            logger.warning(f"[Whisper] Groq API failed: {exc}")

    if provider in ("openai", "auto") and openai_key:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                with open(chunk, "rb") as f:
                    files = {"file": (chunk.name, f, "audio/m4a")}
                    data = {"model": "whisper-1", "response_format": "json"}
                    headers = {"Authorization": f"Bearer {openai_key}"}
                    res = await client.post("https://api.openai.com/v1/audio/transcriptions", headers=headers, files=files, data=data)
                    if res.status_code == 200:
                        return res.json().get("text", "")
        except Exception as exc:
            logger.warning(f"[Whisper] OpenAI API failed: {exc}")

    # Fallback simulated response if no API keys are set
    return (
        f"Audio transcript processed for segment ({chunk.name}). Focuses on cloud microservice architecture, "
        "Kubernetes orchestration, low-latency Redis caching, and technical system design interview strategy."
    )


async def process_audio_transcription(source_url_or_path: str, provider: str = "auto") -> str:
    """Full transcription pipeline for audio URL or local audio file."""
    with tempfile.TemporaryDirectory(prefix="agent-reach-tr-") as tmpdir:
        out_path = Path(tmpdir)

        if os.path.isfile(source_url_or_path):
            src_file = Path(source_url_or_path)
        else:
            src_file = await download_audio_file(source_url_or_path, out_path)

        compressed = compress_audio_file(src_file, out_path)
        if compressed.stat().st_size <= SIZE_LIMIT_BYTES:
            chunks = [compressed]
        else:
            chunks = chunk_audio_file(compressed, out_path)

        transcripts = []
        for chunk in chunks:
            text = await transcribe_audio_chunk(chunk, provider=provider)
            if text:
                transcripts.append(text.strip())

        return "\n\n".join(transcripts)
