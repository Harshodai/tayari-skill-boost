from app.services.action_policy import RiskTier, evaluate_action, require_manual_submission

def test_submission_is_always_human_only():
    result = evaluate_action('submit_application', {}, 'https://greenhouse.io/job', explicit_approval=True)
    assert result.allowed is False
    assert result.risk_tier == RiskTier.SUBMISSION

def test_sensitive_field_requires_approval():
    result = evaluate_action('input_text', {'label': 'Work authorization'}, 'https://greenhouse.io/job')
    assert result.allowed is False and result.requires_approval

def test_unknown_navigation_is_denied():
    result = evaluate_action('go_to_url', {'url': 'https://attacker.example'}, 'https://greenhouse.io/job')
    assert result.allowed is False

def test_orchestrator_manual_submission_boundary_is_never_overridden_by_approval():
    result = require_manual_submission('https://boards.greenhouse.io/acme/jobs/123')
    assert result.allowed is False
    assert result.requires_approval is True
    assert result.risk_tier == RiskTier.SUBMISSION
