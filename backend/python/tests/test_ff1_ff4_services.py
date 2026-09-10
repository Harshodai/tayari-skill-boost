"""Tests for Phase 3 Tasks FF1 and FF4:
- FF1: Dynamic salary compensation model and LLM-assisted benchmarking.
- FF4: AI Interactive Portfolio Generator with JobTayariOrchestrator integration.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app.services.career_intelligence import (
    calculate_dynamic_compensation,
    parse_domain,
    parse_location_tier,
    parse_seniority,
    salary_benchmark,
    salary_benchmark_sync,
)
from app.services.portfolio_generator import (
    PortfolioOrchestratorAdapter,
    generate_portfolio_ai,
    generate_portfolio_html,
    render_tailored_portfolio_html,
)


SAMPLE_RESUME = """
Jane Doe
jane.doe@example.com | San Francisco, CA

Professional Summary
Senior Backend Engineer with 6+ years of experience designing high-throughput distributed systems in Go, Python, and Kubernetes.

Experience
Acme Cloud Corp — Senior Distributed Systems Engineer (2021 - Present)
• Spearheaded real-time streaming pipeline processing 15M events daily with Go and Kafka.
• Reduced p99 API latency by 45% through Redis multi-tier caching and query optimization.
• Architected automated deployment pipelines with Docker and Kubernetes on AWS.

Vanguard Tech — Backend Engineer (2018 - 2021)
• Built RESTful microservices in Python (FastAPI) and PostgreSQL.
• Scaled database read performance by 3x via connection pooling and index refactoring.

Technical Skills
Go, Python, TypeScript, Docker, Kubernetes, PostgreSQL, Redis, Kafka, AWS, CI/CD
"""


# ═══════════════════════════════════════════════════════════════════════════
# Task FF1: Dynamic Salary Benchmarking & Compensation Model Tests
# ═══════════════════════════════════════════════════════════════════════════

class TestDynamicSalaryBenchmark:
    """Verification of dynamic compensation model across seniorities, domains, and location tiers."""

    def test_seniority_parsing(self) -> None:
        assert parse_seniority("Software Engineering Intern") == "intern"
        assert parse_seniority("Junior Backend Developer") == "junior"
        assert parse_seniority("Associate Data Scientist") == "junior"
        assert parse_seniority("Software Engineer") == "mid"
        assert parse_seniority("Senior Frontend Engineer") == "senior"
        assert parse_seniority("Sr. DevOps Engineer") == "senior"
        assert parse_seniority("Tech Lead") == "lead"
        assert parse_seniority("Lead AI Engineer") == "lead"
        assert parse_seniority("Staff Systems Engineer") == "staff"
        assert parse_seniority("Principal Cloud Architect") == "principal"
        assert parse_seniority("Engineering Manager") == "manager"
        assert parse_seniority("Director of Engineering") == "director"

    def test_domain_parsing(self) -> None:
        assert parse_domain("Machine Learning Engineer") == "AI/ML"
        assert parse_domain("LLM Research Scientist") == "AI/ML"
        assert parse_domain("Cybersecurity Analyst") == "Security"
        assert parse_domain("Distributed Systems Engineer") == "Systems"
        assert parse_domain("Site Reliability Engineer (SRE)") == "DevOps/Cloud"
        assert parse_domain("Cloud Platform Engineer") == "DevOps/Cloud"
        assert parse_domain("Golang Backend Engineer") == "Backend"
        assert parse_domain("React Frontend Developer") == "Frontend"
        assert parse_domain("iOS Mobile Engineer") == "Mobile"
        assert parse_domain("Data Scientist") == "Data"
        assert parse_domain("Data Engineer") == "Data"
        assert parse_domain("Technical Product Manager") == "Product"
        assert parse_domain("General Technologist") == "General"

    def test_location_tier_parsing(self) -> None:
        tier, mult = parse_location_tier("San Francisco, CA")
        assert tier == "Tier 1"
        assert 1.25 <= mult <= 1.35

        tier, mult = parse_location_tier("New York, NY")
        assert tier == "Tier 1"
        assert 1.25 <= mult <= 1.35

        tier, mult = parse_location_tier("Seattle, WA")
        assert tier == "Tier 1"
        assert 1.25 <= mult <= 1.35

        tier, mult = parse_location_tier("Austin, TX")
        assert tier == "Tier 2"
        assert 1.10 <= mult <= 1.15

        tier, mult = parse_location_tier("Chicago, IL")
        assert tier == "Tier 2"
        assert 1.10 <= mult <= 1.15

        tier, mult = parse_location_tier("Remote")
        assert tier == "Remote / National Average"
        assert mult == 1.0

    def test_dynamic_compensation_ranges_and_metadata(self) -> None:
        res = calculate_dynamic_compensation("Senior Backend Engineer", "San Francisco")
        assert res["role"] == "Senior Backend Engineer"
        assert res["location"] == "San Francisco"
        assert res["currency"] == "USD"
        assert res["seniority"] == "senior"
        assert res["domain"] == "Backend"
        assert res["location_tier"] == "Tier 1"

        # Salary ranges
        salary = res["salary_usd"]
        assert salary["min"] < salary["median"] < salary["max"]
        assert salary["median"] > 180000  # realistic Senior in SF

        # Bonus ranges
        bonus = res["bonus"]
        assert bonus["min"] < bonus["median"] < bonus["max"]
        assert bonus["currency"] == "USD"

        # Equity ranges
        equity = res["equity"]
        assert equity["min"] < equity["median"] < equity["max"]
        assert equity["currency"] == "USD"
        assert "vesting_period" in equity

        # Metadata
        meta = res["data_source_metadata"]
        assert meta["source"] == "dynamic_compensation_model"
        assert meta["seniority_level"] == "senior"
        assert meta["domain"] == "Backend"
        assert meta["location_tier"] == "Tier 1"

    def test_salary_benchmark_sync_alias(self) -> None:
        res = salary_benchmark_sync("Staff AI/ML Engineer", "Seattle")
        assert res["seniority"] == "staff"
        assert res["domain"] == "AI/ML"
        assert res["salary_usd"]["median"] >= 300000

    @pytest.mark.asyncio
    async def test_salary_benchmark_async_fallback(self) -> None:
        """Without external LLM keys configured, async salary_benchmark falls back to dynamic model."""
        res = await salary_benchmark("Lead DevOps Engineer", "Austin")
        assert res["seniority"] == "lead"
        assert res["domain"] == "DevOps/Cloud"
        assert res["location_tier"] == "Tier 2"
        assert res["data_source_metadata"]["source"] == "dynamic_compensation_model"

    @pytest.mark.asyncio
    async def test_salary_benchmark_with_mocked_llm(self) -> None:
        """When LLM estimation succeeds, it uses LLM metadata and values."""
        fake_llm_payload = {
            "salary_min": 195000,
            "salary_median": 225000,
            "salary_max": 265000,
            "bonus_min": 25000,
            "bonus_median": 35000,
            "bonus_max": 50000,
            "equity_min": 60000,
            "equity_median": 85000,
            "equity_max": 120000,
            "seniority": "senior",
            "domain": "Backend",
            "location_tier": "Tier 1",
        }

        class FakeProvider:
            provider_name = "openrouter"

        with patch("app.services.llm_service.build_provider", return_value=FakeProvider()):
            with patch("app.services.llm_service.llm_json", return_value=fake_llm_payload):
                res = await salary_benchmark("Senior Go Developer", "San Francisco")
                assert res["data_source_metadata"]["source"] == "llm_estimation"
                assert res["salary_usd"]["median"] == 225000
                assert res["bonus"]["median"] == 35000
                assert res["equity"]["median"] == 85000


# ═══════════════════════════════════════════════════════════════════════════
# Task FF4: AI Interactive Portfolio Generator Tests
# ═══════════════════════════════════════════════════════════════════════════

class TestPortfolioGenerator:
    """Verification of AI portfolio generation, orchestrator integration, and HTML fallback."""

    def test_generate_portfolio_html_fallback(self) -> None:
        """Verify generate_portfolio_html remains functional as an offline fallback renderer."""
        payload = {
            "full_name": "Alice Smith",
            "headline": "Fullstack Cloud Engineer",
            "summary": "Building scalable platforms.",
            "email": "alice@example.com",
            "skills": ["Go", "React", "Docker"],
            "experience": [
                {
                    "title": "Cloud Architect",
                    "company": "Skyline Corp",
                    "dates": "2022 - Present",
                    "bullets": ["Deployed global clusters with 99.99% uptime."],
                }
            ],
        }
        html = generate_portfolio_html(payload)
        assert "<!DOCTYPE html>" in html
        assert "Alice Smith" in html
        assert "Fullstack Cloud Engineer" in html
        assert "Skyline Corp" in html
        assert "alice@example.com" in html

    def test_render_tailored_portfolio_html_styles(self) -> None:
        """Verify tailored renderer supports modern, minimal, and technical themes."""
        data = {
            "full_name": "Jane Doe",
            "headline": "Senior Backend Engineer",
            "summary": "Distributed systems specialist.",
            "email": "jane@example.com",
            "skills": ["Go", "Python", "Kubernetes"],
            "projects": [
                {
                    "title": "Distributed Streaming Engine",
                    "role": "Lead Architect",
                    "description": "Processes 15M daily events with sub-second p99 latency.",
                    "technologies": ["Go", "Kafka", "Redis"],
                    "metrics": "Reduced latency by 45%",
                    "url": "https://github.com/example/engine",
                }
            ],
            "experience": [],
        }

        # Modern style
        modern_html = render_tailored_portfolio_html(data, style="modern")
        assert "Jane Doe" in modern_html
        assert "Distributed Streaming Engine" in modern_html
        assert "Reduced latency by 45%" in modern_html
        assert "bg-slate-950" in modern_html

        # Minimal style
        minimal_html = render_tailored_portfolio_html(data, style="minimal")
        assert "Jane Doe" in minimal_html
        assert "bg-zinc-50" in minimal_html

        # Technical style
        technical_html = render_tailored_portfolio_html(data, style="technical")
        assert "Jane Doe" in technical_html
        assert "bg-[#0b0f17]" in technical_html

    @pytest.mark.asyncio
    async def test_portfolio_orchestrator_adapter_compliance(self) -> None:
        """Verify PortfolioOrchestratorAdapter complies with DSPy CodeActionOutput requirements."""
        from app.unhobbling.state import new_state, add_context_variable
        from app.unhobbling.signatures import CodeActionOutput, CodeRepairOutput

        state = new_state(user_id="user_test_123", task_type="code_action", target_role="portfolio_generation")
        state = add_context_variable(state, "resume", SAMPLE_RESUME)

        adapter = PortfolioOrchestratorAdapter()
        action_output = await adapter.generate_code_action(state)
        validated_action = CodeActionOutput.model_validate(action_output)
        assert validated_action.code_to_execute is not None

        repair_output = await adapter.generate_repair(state)
        validated_repair = CodeRepairOutput.model_validate(repair_output)
        assert validated_repair.repaired_code is not None

    @pytest.mark.asyncio
    async def test_generate_portfolio_ai_offline_mode(self) -> None:
        """Verify generate_portfolio_ai runs end-to-end through JobTayariOrchestrator."""
        res = await generate_portfolio_ai(
            user_id="usr_prod_456",
            resume_text=SAMPLE_RESUME,
            style="modern",
        )

        # Expected return structure
        assert "html" in res
        assert "<!DOCTYPE html>" in res["html"]
        assert "Jane Doe" in res["html"]
        assert "projects" in res
        assert isinstance(res["projects"], list)
        assert len(res["projects"]) >= 2
        for proj in res["projects"]:
            assert "title" in proj
            assert "description" in proj
            assert "technologies" in proj

        assert res["full_name"] == "Jane Doe"
        assert res["style"] == "modern"
        assert res["metadata"]["target_role"] == "portfolio_generation"
        assert res["metadata"]["task_type"] == "code_action"
        assert res["validation_passed"] is True
        assert res["orchestrator_run_id"] is not None

    @pytest.mark.asyncio
    async def test_generate_portfolio_ai_with_mocked_llm(self) -> None:
        """Verify generate_portfolio_ai incorporates rich LLM-generated project sections."""
        mock_llm_data = {
            "full_name": "Jane Doe, M.S.",
            "headline": "Lead Distributed Systems Architect",
            "summary": "Specialist in ultra-low latency event streaming and cloud orchestration.",
            "email": "jane.doe@example.com",
            "skills": ["Go", "Kafka", "Kubernetes", "AWS", "gRPC"],
            "projects": [
                {
                    "title": "Quantum Event Engine",
                    "role": "Principal Designer",
                    "description": "Sub-millisecond event streaming gateway across multi-region clusters.",
                    "technologies": ["Go", "Kafka", "gRPC"],
                    "metrics": "Maintained 99.999% uptime under 20M events/sec load",
                    "url": "https://github.com/example/quantum-engine",
                }
            ],
            "experience": [
                {
                    "title": "Lead Distributed Systems Architect",
                    "company": "Acme Cloud Corp",
                    "dates": "2021 - Present",
                    "bullets": ["Led high-throughput architecture."],
                }
            ],
        }

        class FakeProvider:
            provider_name = "openrouter"

        with patch("app.services.llm_service.build_provider", return_value=FakeProvider()):
            with patch("app.services.llm_service.llm_json", return_value=mock_llm_data):
                res = await generate_portfolio_ai(
                    user_id="usr_llm_789",
                    resume_text=SAMPLE_RESUME,
                    style="technical",
                )
                assert res["full_name"] == "Jane Doe, M.S."
                assert res["style"] == "technical"
                assert len(res["projects"]) == 1
                assert res["projects"][0]["title"] == "Quantum Event Engine"
                assert "Quantum Event Engine" in res["html"]
                assert "bg-[#0b0f17]" in res["html"]
                assert res["metadata"]["source"] == "ai_orchestrator"
