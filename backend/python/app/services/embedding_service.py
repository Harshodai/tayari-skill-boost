from __future__ import annotations
"""Embedding service - local ONNX embeddings via fastembed (BAAI/bge-small-en-v1.5).
No external API needed: open-source model, CPU-friendly, 384 dims.
Lazy-loaded singleton with graceful degradation (hybrid search falls back to
lexical-only if the model can't load, e.g. offline first boot).
"""
import logging
import math
import threading

logger = logging.getLogger(__name__)

_model = None
_model_lock = threading.Lock()
_model_failed = False

MODEL_NAME = "BAAI/bge-small-en-v1.5"


def _get_model():
    global _model, _model_failed
    if _model is not None or _model_failed:
        return _model
    with _model_lock:
        if _model is not None or _model_failed:
            return _model
        try:
            from fastembed import TextEmbedding
            _model = TextEmbedding(MODEL_NAME)
            logger.info("Embedding model loaded: %s", MODEL_NAME)
        except Exception as exc:
            logger.warning("Embedding model unavailable, hybrid search degrades "
                           "to lexical-only: %s", exc)
            _model_failed = True
    return _model


def embeddings_available() -> bool:
    return _get_model() is not None


def embed_texts(texts: list) -> list | None:
    """Returns list of vectors (lists of floats) or None if unavailable."""
    model = _get_model()
    if model is None or not texts:
        return None
    try:
        return [list(v) for v in model.embed(texts)]
    except Exception as exc:
        logger.warning("Embedding failed: %s", exc)
        return None


def cosine_similarity(a: list, b: list) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
