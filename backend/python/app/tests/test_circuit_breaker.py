import pytest
from unittest.mock import AsyncMock

from app.services.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpen,
    get_circuit_breaker,
    reset_circuit_breakers,
)
from app.services.llm_service import (
    HermesProvider,
    LLMNotConfiguredError,
    LLMProvider,
    MockProvider,
    NVIDIANIMProvider,
    OllamaProvider,
    OpenAICompatibleProvider,
    OpenRouterProvider,
    llm_complete,
)


@pytest.fixture(autouse=True)
def clean_breakers():
    reset_circuit_breakers()
    yield
    reset_circuit_breakers()


def test_provider_name_properties():
    assert OpenAICompatibleProvider("http://localhost:8000/v1", "key", "model").provider_name == "openai_compatible"
    assert OllamaProvider("http://localhost:11434", "llama3").provider_name == "ollama"
    assert OpenRouterProvider("key", "model").provider_name == "openrouter"
    assert NVIDIANIMProvider("key", "model", "http://nim").provider_name == "nvidia_nim"
    assert HermesProvider().provider_name == "hermes"
    assert MockProvider().provider_name == "mock"


class DummyProvider(LLMProvider):
    def __init__(self, name="dummy", fail=False):
        self._name = name
        self.fail = fail
        self.call_count = 0

    @property
    def provider_name(self) -> str:
        return self._name

    async def complete(self, system_message: str, user_message: str, max_tokens: int = 800, temperature: float = 0.3) -> str:
        self.call_count += 1
        if self.fail:
            raise RuntimeError(f"Provider {self._name} failed")
        return f"Response from {self._name}"


def test_per_provider_circuit_breaker_naming():
    cb1 = get_circuit_breaker(name="llm_openrouter", failure_threshold=3)
    cb2 = get_circuit_breaker(name="llm_nvidia_nim", failure_threshold=3)
    assert cb1.name == "llm_openrouter"
    assert cb2.name == "llm_nvidia_nim"
    assert cb1 is not cb2


@pytest.mark.asyncio
async def test_llm_complete_dynamically_scopes_circuit_breaker(monkeypatch):
    dummy_a = DummyProvider("prov_a", fail=True)
    dummy_b = DummyProvider("prov_b", fail=False)

    current_provider = dummy_a

    def fake_build_provider(tier="fast"):
        return current_provider

    monkeypatch.setattr("app.services.llm_service.build_provider", fake_build_provider)

    # Trigger failures on provider A until its circuit breaker opens
    cb_a = get_circuit_breaker(name="llm_prov_a", failure_threshold=3)
    cb_b = get_circuit_breaker(name="llm_prov_b", failure_threshold=3)

    for _ in range(3):
        with pytest.raises(RuntimeError):
            await llm_complete("sys", "user")

    assert cb_a.state == "OPEN"
    assert cb_b.state == "CLOSED"

    # Next attempt with provider A should immediately raise CircuitBreakerOpen
    with pytest.raises(CircuitBreakerOpen) as excinfo:
        await llm_complete("sys", "user")
    assert "llm_prov_a" in str(excinfo.value)

    # Switch to provider B: its breaker is still CLOSED and succeeds
    current_provider = dummy_b
    result = await llm_complete("sys", "user")
    assert result == "Response from prov_b"
    assert cb_b.state == "CLOSED"
