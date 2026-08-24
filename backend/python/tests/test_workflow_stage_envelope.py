from app.services.workflow_stage_envelope import InvalidStageEnvelope, build_stage_envelope


HASH = "a" * 64


def test_resume_stage_preserves_owner_and_hashes_without_raw_content():
    envelope = build_stage_envelope(
        application_id="application-1",
        user_id="user-1",
        stage_key="resume_ingested",
        profile_snapshot_hash=HASH,
        artifact_hash=HASH,
        artifact_version="resume-v3",
        artifact_provenance={"source": "candidate_upload", "parser_version": "parser-v2"},
    )

    payload = envelope.to_dict()
    assert payload["application_id"] == "application-1"
    assert payload["user_id"] == "user-1"
    assert payload["artifact_hash"] == HASH
    assert payload["artifact_provenance"]["parser_version"] == "parser-v2"
    assert "resume_text" not in payload
    assert "job_description" not in payload


def test_job_discovery_requires_canonical_identity():
    try:
        build_stage_envelope(application_id="a", user_id="u", stage_key="job_discovered")
    except InvalidStageEnvelope as exc:
        assert "job_identity_key" in str(exc)
    else:
        raise AssertionError("job discovery without canonical identity must fail")


def test_artifact_stages_require_content_hash():
    for stage in ("resume_tailored", "cover_letter_created", "review_package_created"):
        try:
            build_stage_envelope(application_id="a", user_id="u", stage_key=stage)
        except InvalidStageEnvelope as exc:
            assert "artifact_hash" in str(exc)
        else:
            raise AssertionError(f"{stage} without artifact hash must fail")


def test_provenance_and_failure_state_are_bounded():
    envelope = build_stage_envelope(
        application_id="a",
        user_id="u",
        stage_key="fit_analyzed",
        failure_state={"code": "provider_timeout", "message": "provider unavailable", "retryable": True},
        job_provenance={"provider": "approved-provider", "confidence": 0.4},
    )
    assert envelope.failure_state["retryable"] is True
    assert envelope.job_provenance["confidence"] == 0.4

    try:
        build_stage_envelope(
            application_id="a",
            user_id="u",
            stage_key="fit_analyzed",
            job_provenance={"raw_job_description": "do not persist this"},
        )
    except InvalidStageEnvelope as exc:
        assert "unsupported keys" in str(exc)
    else:
        raise AssertionError("raw provider/job content must be rejected")
