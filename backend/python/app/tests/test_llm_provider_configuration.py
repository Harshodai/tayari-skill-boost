from app.services.llm_service import (
    LLMNotConfiguredError,
    MockProvider,
    OllamaProvider,
    OpenRouterProvider,
    build_provider,
)


def test_blank_provider_remains_explicitly_unconfigured(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    assert isinstance(build_provider(), MockProvider)


def test_openrouter_label_without_key_fails_closed(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    try:
        build_provider()
    except LLMNotConfiguredError as exc:
        assert "OPENROUTER_API_KEY" in str(exc)
    else:
        raise AssertionError("explicit OpenRouter misconfiguration became a fallback provider")


def test_ollama_label_requires_ollama_endpoint(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    try:
        build_provider()
    except LLMNotConfiguredError as exc:
        assert "LLM_BASE_URL" in str(exc)
    else:
        raise AssertionError("explicit Ollama misconfiguration did not fail closed")


def test_supported_provider_with_credentials_builds_real_provider(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "synthetic-key")
    monkeypatch.setenv("OPENROUTER_MODEL", "synthetic/model")
    assert isinstance(build_provider(), OpenRouterProvider)


def test_ollama_provider_with_valid_endpoint_builds_real_provider(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_BASE_URL", "http://ollama:11434")
    assert isinstance(build_provider(), OllamaProvider)
