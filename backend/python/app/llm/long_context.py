"""Long-context chunking + parallel map-reduce for LLM prompts.

Replaces head-slicing (`text[:N]`) of resumes/JDs before LLM calls. When a
source document exceeds the chunk budget, it is split on meaningful boundaries
(section headers for resumes, paragraph/heading breaks for JDs, fixed-size as
fallback), each chunk is condensed in parallel under a bounded semaphore, and a
single reduce call receives the ordered facts. Documents within budget take the
fast path: exactly one direct call, byte-identical to pre-chunking behavior.

SOLID notes:
- SRP: this module only chunks and orchestrates LLM calls; it owns no
  provider logic, no storage, no prompt content beyond the generic condense
  step. Task-specific prompts live at the call sites.
- OCP: new chunking strategies implement the ``Chunker`` protocol and are
  reachable via ``build_chunker``; new merge behavior is a Merger strategy.
- DIP: ``LongContextClient`` depends on the ``LLMCallable`` protocol, never
  on ``llm_service`` directly. ``DefaultLLMCallable`` binds the real
  ``llm_complete``/``llm_json`` lazily so this module imports cleanly even
  when the LLM layer is unavailable.

Honesty: per-chunk failures are tolerated (``status="failed"``, others
proceed); when zero chunks succeed the first underlying error is re-raised so
the call site's existing error paths fire (503 ``llm_not_configured``,
``draft_source != "llm"``, generation fallbacks). Chunking never fabricates.
"""
from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass, field
from typing import Any, Callable, List, Optional, Protocol, Type, TypeVar

CHUNK_SIZE = int(os.environ.get("LLM_CHUNK_SIZE", "1500"))
CHUNK_OVERLAP = int(os.environ.get("LLM_CHUNK_OVERLAP", "150"))
MAX_CONCURRENCY = int(os.environ.get("LLM_MAX_CONCURRENCY", "4"))

# ponytail: extraction needs no creativity — 0.0 temperature + a fixed 600-token
# budget keeps map outputs deterministic and cheap regardless of the caller's
# reduce-phase kwargs.
MAP_TEMPERATURE = 0.0
MAP_MAX_TOKENS = 600

LONG_TEXT_PLACEHOLDER = "{LONG_TEXT}"

RESUME_HEADER_RE = re.compile(
    r"(?im)^[ \t]*(?:SUMMARY|OBJECTIVE|PROFILE|EXPERIENCE|EMPLOYMENT|"
    r"WORK HISTORY|EDUCATION|SKILLS|TECHNICAL SKILLS|PROJECTS|CERTIFICATIONS?|"
    r"AWARDS|PUBLICATIONS|LANGUAGES|INTERESTS|ACTIVITIES|REFERENCES)"
    r"[ \t]*[:#]?[ \t]*$"
)

JD_BOUNDARY_RE = re.compile(r"(?m)\n\n+|\n(?=[A-Z][A-Z0-9 .\-/]{2,60}:?\n)")


@dataclass
class Chunk:
    """One piece of a source document, with provenance."""

    index: int
    text: str
    source_section: str = ""


@dataclass
class ChunkResult:
    """Map-phase outcome for one chunk. ``status`` is "ok" or "failed"."""

    index: int
    status: str
    text: str = ""

    @property
    def ok(self) -> bool:
        return self.status == "ok"


class Chunker(Protocol):
    """Strategy: split a document into ordered, budget-bounded chunks."""

    def chunk(self, text: str) -> List[Chunk]:  # pragma: no cover - protocol
        ...


class FixedSizeChunker:
    """Deterministic uniform slicing with optional overlap (fallback strategy)."""

    def __init__(self, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> None:
        if chunk_size < 1:
            raise ValueError("chunk_size must be >= 1")
        self.chunk_size = chunk_size
        # ponytail: overlap clamped to half the chunk so a pathological config
        # can't make a chunk zero-length or the document loop forever.
        self.overlap = max(0, min(overlap, chunk_size // 2))

    def chunk(self, text: str) -> List[Chunk]:
        if not text:
            return []
        step = max(1, self.chunk_size - self.overlap)
        return [
            Chunk(index=pos, text=text[offset : offset + self.chunk_size], source_section="")
            for pos, offset in enumerate(range(0, len(text), step))
        ]


class SectionAwareChunker:
    """Split on meaningful boundaries (headers/paragraphs), fixed-size fallback.

    Sections within budget are kept whole so the LLM sees coherent units
    (a full EXPERIENCE section beats a mid-bullet cut). Sections that still
    exceed the budget are sub-split at fixed size, carrying the section name
    as provenance.
    """

    def __init__(
        self,
        split_re: re.Pattern[str],
        chunk_size: int = CHUNK_SIZE,
        overlap: int = CHUNK_OVERLAP,
    ) -> None:
        self.split_re = split_re
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk(self, text: str) -> List[Chunk]:
        if not text:
            return []
        boundaries = [m for m in self.split_re.finditer(text)]
        if not boundaries:
            return FixedSizeChunker(self.chunk_size, self.overlap).chunk(text)

        chunks: List[Chunk] = []
        prefix = text[: boundaries[0].start()].strip()
        if prefix:
            chunks.append(Chunk(index=0, text=prefix, source_section=""))
        for i, match in enumerate(boundaries):
            start = match.start()
            end = boundaries[i + 1].start() if i + 1 < len(boundaries) else len(text)
            section_name = match.group(0).strip().strip(":#").strip()
            body = text[start:end]
            if len(body) <= self.chunk_size:
                chunks.append(
                    Chunk(index=len(chunks), text=body, source_section=section_name)
                )
            else:
                for piece in self._split_fixed(body, section_name):
                    piece.index = len(chunks)
                    chunks.append(piece)
        return chunks

    def _split_fixed(self, body: str, section_name: str) -> List[Chunk]:
        size = self.chunk_size
        overlap = max(0, min(self.overlap, size // 2))
        step = max(1, size - overlap)
        return [
            Chunk(index=0, text=body[i : i + size], source_section=section_name)
            for i in range(0, len(body), step)
        ]


def build_chunker(kind: str, chunk_size: Optional[int] = None, overlap: Optional[int] = None) -> Chunker:
    """Factory: section-aware for resumes/JDs, fixed-size otherwise."""
    size = chunk_size or CHUNK_SIZE
    ovl = overlap if overlap is not None else CHUNK_OVERLAP
    if kind == "resume":
        return SectionAwareChunker(RESUME_HEADER_RE, size, ovl)
    if kind == "jd":
        return SectionAwareChunker(JD_BOUNDARY_RE, size, ovl)
    return FixedSizeChunker(size, ovl)


class LLMCallable(Protocol):
    """DIP seam: anything with an async ``complete`` can back the client."""

    async def complete(
        self,
        system_message: str,
        user_message: str,
        *,
        tier: str = "fast",
        max_tokens: int = 800,
        temperature: float = 0.3,
    ) -> str:  # pragma: no cover - protocol
        ...


class LLMJsonCallable(Protocol):
    """DIP seam for Pydantic-typed completions (``llm_json``)."""

    async def json_complete(
        self,
        system_message: str,
        user_message: str,
        *,
        response_model: Optional[Type[Any]] = None,
        tier: str = "fast",
        max_tokens: int = 1500,
    ) -> Any:  # pragma: no cover - protocol
        ...


class DefaultLLMCallable:
    """Binds the real ``llm_complete``/``llm_json`` lazily (no import cycle)."""

    async def complete(
        self,
        system_message: str,
        user_message: str,
        *,
        tier: str = "fast",
        max_tokens: int = 800,
        temperature: float = 0.3,
    ) -> str:
        from app.services.llm_service import llm_complete  # lazy: no cycle

        return await llm_complete(
            system_message,
            user_message,
            tier=tier,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    async def json_complete(
        self,
        system_message: str,
        user_message: str,
        *,
        response_model: Optional[Type[Any]] = None,
        tier: str = "fast",
        max_tokens: int = 1500,
    ) -> Any:
        from app.services.llm_service import llm_json  # lazy: no cycle

        return await llm_json(
            system_message,
            user_message,
            response_model=response_model,
            tier=tier,
            max_tokens=max_tokens,
        )


CONDENSE_SYSTEM_PROMPT = (
    "You are a verbatim fact extractor. Copy every fact, achievement, skill, "
    "metric, bullet, and detail from the document chunk EXACTLY as written. "
    "Do not paraphrase, summarize, add, or invent anything. Preserve dates, "
    "numbers, and job titles. Output only the extracted facts."
)

CONDENSE_TEMPLATE = "Extract all facts from this document chunk.\n\nCHUNK:\n" + LONG_TEXT_PLACEHOLDER

T = TypeVar("T")


class LongContextClient:
    """Facade over chunked, parallel LLM calls.

    Modes:
    - ``condense`` — map phase only, facts joined in order (secondary inputs,
      e.g. a JD that contextualizes the task).
    - ``map_reduce`` / ``map_reduce_json`` — map + single reduce call; the
      caller's template must contain ``{LONG_TEXT}``, which is filled with the
      raw text on the fast path and with condensed facts otherwise.
    - ``map_only`` — per-chunk extraction results returned to the caller for
      client-side union (analysis tasks).
    """

    def __init__(
        self,
        chunker_factory: Optional[Callable[..., Chunker]] = None,
        llm: Optional[LLMCallable] = None,
        json_llm: Optional[LLMJsonCallable] = None,
        max_concurrency: Optional[int] = None,
    ) -> None:
        self._chunker_factory = chunker_factory or build_chunker
        self._llm: LLMCallable = llm or DefaultLLMCallable()
        self._json_llm: Optional[LLMJsonCallable] = json_llm or (
            self._llm if hasattr(self._llm, "json_complete") else None
        )
        self._semaphore = asyncio.Semaphore(max_concurrency or MAX_CONCURRENCY)

    # -- public API -------------------------------------------------------

    async def condense(self, text: str, kind: str = "resume") -> str:
        """Map-only: return ordered condensed facts (fast path = input)."""
        if len(text) <= self._budget(kind):
            return text
        results = await self.map_only(
            text,
            CONDENSE_TEMPLATE,
            kind=kind,
            system=CONDENSE_SYSTEM_PROMPT,
            max_tokens=MAP_MAX_TOKENS,
            temperature=MAP_TEMPERATURE,
        )
        return "\n".join(r.text for r in results if r.ok)

    async def map_only(
        self,
        text: str,
        extract_template: str,
        *,
        kind: str = "resume",
        system: str = "",
        tier: str = "fast",
        max_tokens: int = MAP_MAX_TOKENS,
        temperature: float = MAP_TEMPERATURE,
    ) -> List[ChunkResult]:
        """Per-chunk extraction, ordered by chunk index; failures tolerated."""
        if LONG_TEXT_PLACEHOLDER not in extract_template:
            raise ValueError("extract_template must contain {LONG_TEXT}")
        chunks = self._chunker_factory(kind).chunk(text)
        if not chunks:
            return []

        async def _one(chunk: Chunk) -> ChunkResult:
            async with self._semaphore:
                try:
                    # ponytail: replace() not .format() — templates routinely
                    # embed literal JSON braces (extraction schemas) that
                    # str.format would choke on.
                    prompt = extract_template.replace(LONG_TEXT_PLACEHOLDER, chunk.text)
                    out = await self._llm.complete(
                        system,
                        prompt,
                        tier=tier,
                        max_tokens=max_tokens,
                        temperature=temperature,
                    )
                    return ChunkResult(index=chunk.index, status="ok", text=out)
                except Exception as exc:  # noqa: BLE001 - per-chunk tolerance
                    first_error.setdefault(exc)
                    return ChunkResult(index=chunk.index, status="failed", text="")

        first_error: dict = {}
        results = await asyncio.gather(*(_one(c) for c in chunks))
        results.sort(key=lambda r: r.index)
        if not any(r.ok for r in results):
            # ponytail: raise the ORIGINAL error (not a wrapper) so call sites'
            # existing except-clauses (LLMNotConfiguredError etc.) fire unchanged.
            raise first_error.popitem()[0]  # type: ignore[arg-type]
        return results

    async def map_reduce(
        self,
        text: str,
        template: str,
        *,
        kind: str = "resume",
        system: str = "",
        tier: str = "fast",
        max_tokens: int = 800,
        temperature: float = 0.3,
    ) -> str:
        """Map + single reduce call with ordered facts in the template."""
        if LONG_TEXT_PLACEHOLDER not in template:
            raise ValueError("template must contain {LONG_TEXT}")
        if len(text) <= self._budget(kind):
            return await self._llm.complete(
                system,
                template.replace(LONG_TEXT_PLACEHOLDER, text),
                tier=tier,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        facts = await self.condense(text, kind=kind)
        return await self._llm.complete(
            system,
            template.replace(LONG_TEXT_PLACEHOLDER, facts),
            tier=tier,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    async def map_reduce_json(
        self,
        text: str,
        template: str,
        *,
        kind: str = "resume",
        system: str = "",
        response_model: Optional[Type[T]] = None,
        tier: str = "fast",
        max_tokens: int = 1500,
    ) -> Any:
        """Map + single typed reduce call via ``llm_json``."""
        if LONG_TEXT_PLACEHOLDER not in template:
            raise ValueError("template must contain {LONG_TEXT}")
        json_fn = self._json_llm
        if json_fn is None:
            raise NotImplementedError("no JSON-capable LLM callable configured")
        if len(text) <= self._budget(kind):
            return await json_fn.json_complete(
                system,
                template.replace(LONG_TEXT_PLACEHOLDER, text),
                response_model=response_model,
                tier=tier,
                max_tokens=max_tokens,
            )
        facts = await self.condense(text, kind=kind)
        return await json_fn.json_complete(
            system,
            template.replace(LONG_TEXT_PLACEHOLDER, facts),
            response_model=response_model,
            tier=tier,
            max_tokens=max_tokens,
        )

    # -- internals --------------------------------------------------------

    def _budget(self, kind: str) -> int:
        """Fast-path budget for a document kind (chunk size of its chunker)."""
        chunker = self._chunker_factory(kind)
        size = getattr(chunker, "chunk_size", None)
        return size if isinstance(size, int) and size > 0 else CHUNK_SIZE


def make_client() -> LongContextClient:
    """Module-level convenience: one shared client per process."""
    return LongContextClient()


if __name__ == "__main__":  # ponytail: self-check, headless — no LLM, no DB
    import asyncio

    class _FakeLLM:
        def __init__(self) -> None:
            self.calls = 0

        async def complete(
            self,
            system_message: str,
            user_message: str,
            *,
            tier: str = "fast",
            max_tokens: int = 800,
            temperature: float = 0.3,
        ) -> str:
            self.calls += 1
            return user_message

    fake = _FakeLLM()

    async def _run() -> None:
        client = LongContextClient(llm=fake)
        # fast path: one call, byte-identical
        out = await client.map_reduce("short text", "TASK\n{LONG_TEXT}")
        assert out == "TASK\nshort text" and fake.calls == 1, "fast path failed"

        # fixed-size fallback covers the whole document
        doc = "".join(chr(ord("a") + i % 26) for i in range(5000))
        chunks = FixedSizeChunker(1500, 150).chunk(doc)
        assert chunks[0].index == 0 and chunks[-1].index == len(chunks) - 1
        assert all(len(c.text) <= 1500 for c in chunks), "chunk over budget"

        # section-aware resume splitting
        resume = (
            "JANE DOE\nSoftware Engineer\n\nSUMMARY:\n"
            + "x" * 200
            + "\n\nEXPERIENCE:\n"
            + "y" * 2000
            + "\n\nEDUCATION:\n"
            + "z" * 100
        )
        secs = SectionAwareChunker(RESUME_HEADER_RE, 1500, 150).chunk(resume)
        assert any("SUMMARY" in c.source_section for c in secs)
        assert any("EXPERIENCE" in c.source_section for c in secs)
        assert all(len(c.text) <= 1500 for c in secs)

        # map-reduce on a long doc: N map calls + 1 reduce, ordered facts
        fake.calls = 0
        before = fake.calls
        out2 = await client.map_reduce(doc, "TASK\n{LONG_TEXT}")
        assert fake.calls >= 3, "expected map+reduce calls"
        assert "TASK\n" in out2

    asyncio.run(_run())
    print("long_context self-check OK")
