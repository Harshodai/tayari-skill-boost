import pytest

from app.services.prompt_registry import _REGISTRY, get_prompt, list_prompts, render


def test_registry_versions_are_pinned():
    for pid in ("optimizer.generate", "optimizer.reflexion_refine", "optimizer.humanize"):
        version, template = get_prompt(pid)
        assert version == "1.0.0"
        assert isinstance(template, str) and len(template) > 50


def test_hyphen_alias_resolves():
    assert get_prompt("optimizer.reflexion-refine") == get_prompt("optimizer.reflexion_refine")


def test_unknown_prompt_id_raises():
    with pytest.raises(KeyError):
        get_prompt("optimizer.nonexistent")


def test_render_substitutes_vars():
    _REGISTRY["__test_tpl__"] = {"version": "0.0.0", "template": "hello {name}, score {score}"}
    try:
        assert render("__test_tpl__", name="ada", score=85) == "hello ada, score 85"
    finally:
        del _REGISTRY["__test_tpl__"]


def test_render_without_vars_returns_template_verbatim():
    version, template = get_prompt("optimizer.generate")
    assert render("optimizer.generate") == template
    assert render("optimizer.generate", unused_var="x") == template
    assert version == "1.0.0"


def test_optimizer_imports_resolve_to_registry():
    from app.services import optimizer

    for attr, pid in (
        ("OPTIMIZE_SYSTEM", "optimizer.generate"),
        ("HUMANIZE_SYSTEM", "optimizer.humanize"),
        ("STAR_SYSTEM", "optimizer.star_rewrite"),
    ):
        _, template = get_prompt(pid)
        assert getattr(optimizer, attr) == template
    assert optimizer.OPTIMIZE_PROMPT_VERSION == "1.0.0"
    assert optimizer.HUMANIZE_PROMPT_VERSION == "1.0.0"


def test_langfuse_trace_carries_prompt_version():
    from app.telemetry.langfuse_client import LangfuseTelemetryClient

    client = LangfuseTelemetryClient()
    rec = client.trace_llm_call(
        model="test-model",
        prompt_id="optimizer.generate",
        prompt_version="1.0.0",
    )
    assert rec["prompt_id"] == "optimizer.generate"
    assert rec["prompt_version"] == "1.0.0"
    assert rec["metadata"]["prompt_id"] == "optimizer.generate"
    assert rec["metadata"]["prompt_version"] == "1.0.0"


def test_langfuse_trace_without_prompt_still_succeeds():
    from app.telemetry.langfuse_client import trace_llm_call

    rec = trace_llm_call(model="test-model")
    assert rec["prompt_id"] is None
    assert rec["prompt_version"] is None


def test_list_prompts_covers_required_ids():
    versions = list_prompts()
    for pid in ("optimizer.generate", "optimizer.reflexion_refine", "optimizer.humanize"):
        assert versions[pid] == "1.0.0"
