from app.services.capabilities import Capability, capability_enabled


def test_unknown_capability_is_disabled(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)
    assert capability_enabled("autonomous.unknown") is False


def test_workspace_defaults_on_only_outside_deployment_environments(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("CAPABILITY_WORKSPACE_RESUME", raising=False)
    assert capability_enabled(Capability.WORKSPACE_RESUME) is True

    monkeypatch.setenv("APP_ENV", "staging")
    assert capability_enabled(Capability.WORKSPACE_RESUME) is False


def test_autonomous_capability_requires_explicit_flag(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("CAPABILITY_AUTONOMOUS_BROWSER", raising=False)
    assert capability_enabled(Capability.AUTONOMOUS_BROWSER) is False
    monkeypatch.setenv("CAPABILITY_AUTONOMOUS_BROWSER", "true")
    assert capability_enabled(Capability.AUTONOMOUS_BROWSER) is True
