"""ATS vendor tiering — audit Q8.7 / Priority Stack P3.

No major ATS offers a sanctioned third-party submission API. Treating every
vendor identically forces a choice between two failure modes: over-submitting
to hostile portals (ban risk on Workday, which has the worst autofill
accuracy and the hardest detection) or under-submitting to friendly ones (lost
volume on Greenhouse/Lever/Ashby). This module tiers vendors so the engine
knows which mode each ATS is in:

  * ``friendly``      — submit OK when the user approved. Greenhouse, Lever,
                       Ashby, Workable, Recruitee, BambooHR, Jobvite.
  * ``difficult``     — prepare + stop at the approval gate, never auto-submit
                       even with approval. Workday, SmartRecruiters, iCIMS,
                       Taleo, SuccessFactors.
  * ``do_not_submit`` — skip entirely; just save the package. LinkedIn
                       (ToS-hostile, account-kill risk), and government forms
                       such as USAJobs that must be hand-filled.

Vendors are detected by the host fragments in
``submission_receipt._ATS_HOSTS`` — this module is the single source of truth
for which tier a vendor slug belongs to.
"""
from __future__ import annotations

from typing import Literal, Optional

from app.services.submission_receipt import detect_ats_vendor

ATSVendorTier = Literal["friendly", "difficult", "do_not_submit"]

VENDOR_TIERS: dict[str, ATSVendorTier] = {
    # friendly — third-party autofill tolerated, submit OK when approved
    "greenhouse": "friendly",
    "lever": "friendly",
    "ashby": "friendly",
    "workable": "friendly",
    "recruitee": "friendly",
    "bamboohr": "friendly",
    "jobvite": "friendly",
    # difficult — assisted-only; prepare and stop at the approval gate
    "workday": "difficult",
    "smartrecruiters": "difficult",
    "icims": "difficult",
    "taleo": "difficult",
    "successfactors": "difficult",
    # do_not_submit — skip entirely; manual-only
    "linkedin": "do_not_submit",
}


def tier_for_vendor(vendor: Optional[str]) -> Optional[ATSVendorTier]:
    """Return the tier for a known ATS vendor slug, or None if unknown."""
    if not vendor:
        return None
    return VENDOR_TIERS.get(vendor.lower())


def tier_for_url(url: Optional[str]) -> Optional[ATSVendorTier]:
    """Return the tier for the ATS vendor detected from ``url``, or None."""
    return tier_for_vendor(detect_ats_vendor(url))


def can_auto_submit(url: Optional[str]) -> bool:
    """True only when the URL's ATS vendor is in the friendly tier."""
    return tier_for_url(url) == "friendly"


def should_prepare_only(url: Optional[str]) -> bool:
    """True when the URL's ATS vendor is in the difficult tier."""
    return tier_for_url(url) == "difficult"


def should_skip(url: Optional[str]) -> bool:
    """True when the URL's ATS vendor is in the do-not-submit tier."""
    return tier_for_url(url) == "do_not_submit"