from app.services import agent_reach
from app.services.agent_reach import TayariDoctorReport, run_tayari_doctor


def test_tayari_doctor_report_platform_name_uses_job_tayari_branding():
    # ponytail: the branding gate lives in src/config/branding.test.ts (src/ +
    # index.html only) and cannot see backend payload strings — this default
    # must be kept in sync with it by hand.
    report = TayariDoctorReport(total_channels=0, active_channels=0)
    assert report.platform_name == "Job Tayari Jobseeker Suite"


def test_run_tayari_doctor_platform_name_uses_job_tayari_branding(monkeypatch):
    # ponytail: real _probe_tool/extract_browser_cookies are environment-
    # dependent (installed bins, browser cookie files) — mock them so the
    # platform_name assertion is the only signal under test.
    monkeypatch.setattr(agent_reach, "_probe_tool", lambda _bin: (True, 45))
    monkeypatch.setattr(agent_reach, "extract_browser_cookies", lambda: {})
    # ponytail: same manual-sync note as the model default above.
    report = run_tayari_doctor()
    assert report.platform_name == "Job Tayari Jobseeker Suite"
