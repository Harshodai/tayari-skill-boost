"""Pluggable voice-note transcription service — Tayari.

Activates only when TRANSCRIBE_PROVIDER + TRANSCRIBE_API_KEY are set.
Supported providers: openai (whisper-1), deepgram, assemblyai.
Returns "" when not configured so the audio is still stored and playable.

Design: SOLID — each provider is a function; the router dispatches cleanly.
"""
from __future__ import annotations

import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)


async def transcribe(path: str, content_type: str = "audio/webm") -> str:
    """Transcribe an audio file at *path*. Returns transcript text or '' on failure."""
    provider = os.environ.get("TRANSCRIBE_PROVIDER", "").lower()
    key = os.environ.get("TRANSCRIBE_API_KEY", "")
    if not provider or not key:
        logger.debug("TRANSCRIBE_PROVIDER/TRANSCRIBE_API_KEY not set — skipping transcription")
        return ""
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError as exc:
        logger.warning("transcribe: could not read audio file %s: %s", path, exc)
        return ""

    dispatch = {
        "openai": _openai_whisper,
        "deepgram": _deepgram,
        "assemblyai": _assemblyai,
    }
    fn = dispatch.get(provider)
    if fn is None:
        logger.warning("transcribe: unknown provider %r — supported: %s", provider, list(dispatch))
        return ""
    try:
        return await fn(data, content_type, key)
    except Exception as exc:  # noqa: BLE001
        logger.error("transcribe: provider %r failed: %s", provider, exc)
        return ""


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

async def _openai_whisper(data: bytes, content_type: str, key: str) -> str:
    async with httpx.AsyncClient(timeout=120) as cx:
        resp = await cx.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {key}"},
            files={"file": ("audio.webm", data, content_type)},
            data={"model": "whisper-1"},
        )
        resp.raise_for_status()
    return resp.json().get("text", "")


async def _deepgram(data: bytes, content_type: str, key: str) -> str:
    async with httpx.AsyncClient(timeout=120) as cx:
        resp = await cx.post(
            "https://api.deepgram.com/v1/listen?smart_format=true",
            headers={"Authorization": f"Token {key}", "Content-Type": content_type or "audio/webm"},
            content=data,
        )
        resp.raise_for_status()
    j = resp.json()
    return j["results"]["channels"][0]["alternatives"][0]["transcript"]


async def _assemblyai(data: bytes, content_type: str, key: str) -> str:
    async with httpx.AsyncClient(timeout=120) as cx:
        # Step 1: upload
        up = await cx.post(
            "https://api.assemblyai.com/v2/upload",
            headers={"authorization": key},
            content=data,
        )
        up.raise_for_status()
        audio_url = up.json()["upload_url"]

        # Step 2: request transcription
        tr = await cx.post(
            "https://api.assemblyai.com/v2/transcript",
            headers={"authorization": key},
            json={"audio_url": audio_url},
        )
        tr.raise_for_status()
        tid = tr.json()["id"]

        # Step 3: poll (max 60 s)
        for _ in range(30):
            await asyncio.sleep(2)
            poll = await cx.get(
                f"https://api.assemblyai.com/v2/transcript/{tid}",
                headers={"authorization": key},
            )
            pj = poll.json()
            if pj.get("status") == "completed":
                return pj.get("text", "")
            if pj.get("status") == "error":
                logger.warning("assemblyai transcription error: %s", pj.get("error"))
                return ""
    return ""
