from app.services.hermes import config


def test_crawl4ai_requires_explicit_opt_in(monkeypatch):
    monkeypatch.setattr(config, "ENABLE_CRAWL4AI", False)
    assert config.crawl4ai_available() is False

    monkeypatch.setattr(config, "ENABLE_CRAWL4AI", True)
    assert config.crawl4ai_available() is True
