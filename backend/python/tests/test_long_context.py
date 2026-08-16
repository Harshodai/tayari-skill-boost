"""Unit tests for the long-context chunking + map-reduce client.

Covers: chunker bounds/determinism/fallback, factory routing, fast path
(1 call, byte-identical), map phase parallelism + ordering, failed-chunk
tolerance, all-failed re-raise (original error type), condense (no reduce),
typed map_reduce_json, and template contract enforcement.
"""
import asyncio
import time

import pytest

from app.llm.long_context import (
    CONDENSE_SYSTEM_PROMPT,
    CONDENSE_TEMPLATE,
    FixedSizeChunker,
    LongContextClient,
    SectionAwareChunker,
    RESUME_HEADER_RE,
    JD_BOUNDARY_RE,
    build_chunker,
    ChunkResult,
)


class _BoomError(RuntimeError):
    """Distinct error type so tests can assert the ORIGINAL error re-raises."""


class FakeLLM:
    """Recording LLM with optional failure triggers and artificial delay."""

    def __init__(self, delay: float = 0.0, fail_when=None, json_ok: bool = True) -> None:
        self.calls: list[str] = []
        self.delay = delay
        self.fail_when = fail_when  # callable(user_message) -> bool
        self.json_ok = json_ok
        self.max_active = 0
        self._active = 0

    async def complete(
        self,
        system_message: str,
        user_message: str,
        *,
        tier: str = "fast",
        max_tokens: int = 800,
        temperature: float = 0.3,
    ) -> str:
        self._active += 1
        self.max_active = max(self.max_active, self._active)
        self.calls.append(user_message)
        try:
            if self.delay:
                await asyncio.sleep(self.delay)
            if self.fail_when and self.fail_when(user_message):
                raise _BoomError("llm down")
            return f"echo:{user_message[-20:]}"
        finally:
            self._active -= 1

    async def json_complete(
        self,
        system_message: str,
        user_message: str,
        *,
        response_model=None,
        tier: str = "fast",
        max_tokens: int = 1500,
    ):
        self.calls.append(user_message)
        if not self.json_ok:
            raise _BoomError("json down")
        return {"parsed": user_message[-20:]}

    @property
    def map_calls(self) -> list[str]:
        return [c for c in self.calls if "Extract all facts" in c]

    @property
    def reduce_calls(self) -> list[str]:
        return [c for c in self.calls if "Extract all facts" not in c]


def _long_doc(n: int = 5000) -> str:
    return "".join(chr(ord("a") + i % 26) for i in range(n))


# ---------------------------------------------------------------------------
# Chunkers
# ---------------------------------------------------------------------------


class TestFixedSizeChunker:
    def test_bounds_and_sequence(self):
        doc = _long_doc(5000)
        chunker = FixedSizeChunker(1500, 150)
        chunks = chunker.chunk(doc)
        assert chunks[0].index == 0
        assert [c.index for c in chunks] == list(range(len(chunks)))
        assert all(len(c.text) <= 1500 for c in chunks)
        # overlap is duplication, not loss: de-duplicating it reconstructs the doc
        reconstructed = chunks[0].text + "".join(
            c.text[chunker.overlap:] for c in chunks[1:]
        )
        assert reconstructed == doc

    def test_overlap_duplicates_tail(self):
        chunks = FixedSizeChunker(100, 10).chunk(_long_doc(250))
        assert len(chunks) >= 3
        assert chunks[1].text[:10] == chunks[0].text[-10:]  # overlap tail copied

    def test_deterministic(self):
        doc = _long_doc(4000)
        a = FixedSizeChunker(1500, 150).chunk(doc)
        b = FixedSizeChunker(1500, 150).chunk(doc)
        assert [(c.index, c.text) for c in a] == [(c.index, c.text) for c in b]

    def test_single_chunk_when_small(self):
        chunks = FixedSizeChunker(1500, 150).chunk("tiny")
        assert [(x.index, x.text) for x in chunks] == [(0, "tiny")]

    def test_empty_doc_no_chunks(self):
        assert FixedSizeChunker(1500, 150).chunk("") == []


class TestSectionAwareChunker:
    RESUME = (
        "JANE DOE\nSoftware Engineer\n\n"
        "SUMMARY:\n" + "x" * 200 + "\n\n"
        "EXPERIENCE:\n" + "y" * 2000 + "\n\n"
        "EDUCATION:\n" + "z" * 100
    )

    def test_sections_in_order_with_provenance(self):
        chunks = SectionAwareChunker(RESUME_HEADER_RE, 1500, 150).chunk(self.RESUME)
        sources = [c.source_section for c in chunks]
        assert "SUMMARY" in sources
        assert "EXPERIENCE" in sources
        assert "EDUCATION" in sources
        assert [c.index for c in chunks] == list(range(len(chunks)))

    def test_oversized_section_sub_split(self):
        chunks = SectionAwareChunker(RESUME_HEADER_RE, 1500, 150).chunk(self.RESUME)
        big = [c for c in chunks if c.source_section == "EXPERIENCE"]
        assert len(big) >= 2
        assert all(len(c.text) <= 1500 for c in big)

    def test_prefix_before_first_header_kept(self):
        chunks = SectionAwareChunker(RESUME_HEADER_RE, 1500, 150).chunk(self.RESUME)
        assert chunks[0].source_section == ""  # name/contact block
        assert chunks[0].text.startswith("JANE DOE")

    def test_headerless_falls_back_to_fixed_size(self):
        chunks = SectionAwareChunker(RESUME_HEADER_RE, 1500, 150).chunk(_long_doc(4000))
        assert all(c.source_section == "" for c in chunks)
        assert all(len(c.text) <= 1500 for c in chunks)

    def test_jd_paragraph_splitting(self):
        jd = "\n\n".join(f"Responsibilities {i}:" + "r" * 500 for i in range(8))
        chunks = SectionAwareChunker(JD_BOUNDARY_RE, 1500, 150).chunk(jd)
        assert len(chunks) >= 2
        assert all(len(c.text) <= 1500 for c in chunks)

    def test_all_boundaries_respected(self):
        doc = "SUMMARY:\nshort\n\nEXPERIENCE:\nmed\n\nEDUCATION:\nend"
        chunks = SectionAwareChunker(RESUME_HEADER_RE, 1500, 150).chunk(doc)
        joined = "".join(c.text for c in chunks)
        assert "SUMMARY" in joined and "EDUCATION" in joined


class TestBuildChunker:
    def test_kind_routing(self):
        assert isinstance(build_chunker("resume"), SectionAwareChunker)
        assert isinstance(build_chunker("jd"), SectionAwareChunker)
        assert isinstance(build_chunker("other"), FixedSizeChunker)

    def test_invalid_size_rejected(self):
        with pytest.raises(ValueError):
            FixedSizeChunker(0, 0)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class TestClientFastPath:
    def test_single_call_byte_identical(self):
        fake = FakeLLM()
        client = LongContextClient(llm=fake)
        out = asyncio.run(client.map_reduce("short", "TASK\n{LONG_TEXT}"))
        assert out == "echo:TASK\nshort"
        assert fake.calls == ["TASK\nshort"]
        assert fake.map_calls == []

    def test_fast_path_no_chunking_under_budget(self):
        fake = FakeLLM()
        client = LongContextClient(llm=fake)
        text = "x" * 1499
        asyncio.run(client.map_reduce(text, "TASK\n{LONG_TEXT}"))
        assert len(fake.calls) == 1
        assert fake.calls[0] == "TASK\n" + text

    def test_condense_fast_path_returns_input(self):
        fake = FakeLLM()
        client = LongContextClient(llm=fake)
        out = asyncio.run(client.condense("short", kind="jd"))
        assert out == "short"
        assert fake.calls == []

    def test_map_reduce_json_fast_path(self):
        fake = FakeLLM()
        client = LongContextClient(llm=fake)
        out = asyncio.run(
            client.map_reduce_json("short", "TASK\n{LONG_TEXT}", response_model=dict)
        )
        assert out == {"parsed": "TASK\nshort"[-20:]}
        assert len(fake.calls) == 1


class TestClientMapReduce:
    def test_map_then_reduce_ordered(self):
        fake = FakeLLM()
        client = LongContextClient(llm=fake)
        doc = _long_doc(5000)
        out = asyncio.run(client.map_reduce(doc, "TASK\n{LONG_TEXT}"))
        assert len(fake.map_calls) >= 3
        assert len(fake.reduce_calls) == 1
        # every map call carries the condense contract; reduce carries the task
        for call in fake.map_calls:
            assert CONDENSE_SYSTEM_PROMPT is not None and "CHUNK:" in call
        reduce_prompt = fake.reduce_calls[0]
        assert reduce_prompt.startswith("TASK\n")
        assert "echo:" in reduce_prompt  # facts flowed through

    def test_concurrency_bounded_by_semaphore(self):
        fake = FakeLLM(delay=0.03)
        client = LongContextClient(llm=fake, max_concurrency=2)
        doc = _long_doc(12000)  # >= 8 chunks
        start = time.monotonic()
        asyncio.run(client.map_reduce(doc, "TASK\n{LONG_TEXT}"))
        elapsed = time.monotonic() - start
        assert fake.max_active <= 2, "semaphore did not bound parallelism"
        assert elapsed < 0.5, "map phase did not run in parallel"  # serial would be >= 0.12

    def test_failed_chunk_tolerated_reduce_gets_ok_facts(self):
        # fail the 2nd map-phase call; the rest succeed
        fake = FakeLLM(fail_when=lambda user: len(fake.calls) == 2)
        client = LongContextClient(llm=fake)
        asyncio.run(client.map_reduce(_long_doc(5000), "TASK\n{LONG_TEXT}"))
        assert len(fake.map_calls) == 4  # 5000 chars / 1350 step
        assert len(fake.reduce_calls) == 1  # reduce still ran
        reduce_prompt = fake.reduce_calls[0]
        assert reduce_prompt.startswith("TASK\n")
        assert reduce_prompt.count("echo:") == 3  # only the ok chunks fed the reduce

    def test_all_failed_re_raises_original_error(self):
        fake = FakeLLM(fail_when=lambda user: True)
        client = LongContextClient(llm=fake)
        with pytest.raises(_BoomError):
            asyncio.run(client.map_reduce(_long_doc(5000), "TASK\n{LONG_TEXT}"))

    def test_template_requires_placeholder(self):
        fake = FakeLLM()
        client = LongContextClient(llm=fake)
        with pytest.raises(ValueError):
            asyncio.run(client.map_reduce("short", "TASK\nnothing here"))
        with pytest.raises(ValueError):
            asyncio.run(client.map_only("short", "no placeholder"))


class TestClientMapOnly:
    def test_ordered_results_with_status(self):
        # fail the 2nd map-phase call; the rest succeed
        fake = FakeLLM(fail_when=lambda user: len(fake.calls) == 2)
        client = LongContextClient(llm=fake)
        results = asyncio.run(
            client.map_only(_long_doc(5000), "EXTRACT\n{LONG_TEXT}", kind="jd")
        )
        assert [r.index for r in results] == list(range(len(results)))
        assert results[1].status == "failed"
        ok = [r for r in results if r.ok]
        assert ok
        assert all(r.text.startswith("echo:") for r in ok)

    def test_all_failed_re_raises(self):
        fake = FakeLLM(fail_when=lambda user: True)
        client = LongContextClient(llm=fake)
        with pytest.raises(_BoomError):
            asyncio.run(client.map_only(_long_doc(5000), "EXTRACT\n{LONG_TEXT}"))


class TestClientCondense:
    def test_no_reduce_call(self):
        fake = FakeLLM()
        client = LongContextClient(llm=fake)
        out = asyncio.run(client.condense(_long_doc(5000), kind="jd"))
        assert len(fake.calls) >= 3
        assert fake.reduce_calls == []  # condense never issues a reduce call
        assert "echo:" in out  # ordered facts joined


class TestChunkResult:
    def test_ok_property(self):
        assert ChunkResult(0, "ok", "x").ok
        assert not ChunkResult(0, "failed").ok
