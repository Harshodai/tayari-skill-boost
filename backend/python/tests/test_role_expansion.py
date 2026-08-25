from app.services.job_agent import _preparation_material, expand_queries
from app.services.skill_taxonomy import role_expansion_explanation, role_family


def test_data_engineer_expands_to_semantic_title_family():
    queries = expand_queries("Data Engineer", None)
    assert queries[0] == "Data Engineer"
    assert "software engineer data" in queries
    assert "data platform engineer" in queries
    assert "data pipeline engineer" in queries


def test_punctuation_and_word_order_map_to_data_engineering_family():
    assert role_family("Software Engineer, Data") == "data engineering"
    explanation = role_expansion_explanation("Software Engineer, Data")
    assert explanation["family"] == "data engineering"
    assert explanation["expanded_queries"][0] == "Software Engineer, Data"
    assert explanation["confidence"] == "high"
    assert explanation["clarification_question"] is None
    assert "backend engineer" in explanation["adjacent_roles"]


def test_unknown_role_preserves_exact_user_query():
    assert expand_queries("Research Operations Lead", None) == ["Research Operations Lead"]
    explanation = role_expansion_explanation("Research Operations Lead")
    assert explanation["confidence"] == "unknown"
    assert explanation["clarification_question"] is None


def test_generic_role_gets_clarification_without_silent_expansion():
    explanation = role_expansion_explanation("Engineer")
    assert explanation["family"] is None
    assert explanation["expanded_queries"] == ["Engineer"]
    assert explanation["confidence"] == "low"
    assert "specialty" in explanation["clarification_question"]


def test_preparation_material_is_bounded_and_role_grounded():
    material = _preparation_material(
        {"title": "Data Engineer", "matched_skills": ["sql"], "missing_skills": ["data engineering", "spark"]},
        role_expansion_explanation("Data Engineer"),
    )
    assert material["status"] == "draft"
    assert material["role_family"] == "data engineering"
    assert material["focus_areas"] == ["data engineering", "spark"]
    assert len(material["practice_prompts"]) == 2
    assert all("truthful" in item.lower() for item in material["evidence_to_prepare"])
    assert len(material["counterfactuals"]) == 2
    assert all("do not claim" in item.lower() for item in material["counterfactuals"])
