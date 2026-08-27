# Workday Selector Verification Results

**Applied to extension/content.js:** added `adventureButton`/`locations`/`jobPostingDescription` as ADDITIONAL fallback entries alongside the existing `applyButton`/`jobLocation`/`jobDescription` ones — not replacements. This report's evidence comes from a single tenant (Amgen); Workday's `data-automation-id` values are tenant-customizable, so replacing the original ids outright could break other Workday deployments that still use them. `companyName` was left unchanged since no real replacement was found.

**Date:** 2026-08-27
**Test URL:** https://amgen.wd1.myworkdayjobs.com/en-US/Careers/job/Machine-Learning-Engineer--AI-Studio_R-250796
**Page Title:** Machine Learning Engineer, AI Studio
**Company:** Amgen
**Hostname:** amgen.wd1.myworkdayjobs.com (matches `*.myworkdayjobs.com` alias)

## Test Method

1. Searched for real, currently-live Workday job postings via WebSearch
2. Opened the Amgen Machine Learning Engineer posting in a real browser
3. Waited for full page load (JavaScript SPA rendering)
4. Inspected rendered DOM via JavaScript to locate `data-automation-id` attributes
5. Compared against selectors in `extension/content.js` lines 190-213

## Critical Finding

**Workday is a JavaScript SPA.** Raw HTML fetches (curl/WebFetch) return an empty app shell with zero real content. The page structure shown here is from the **fully rendered DOM** after JavaScript execution, which is what the extension will interact with.

## Selector Verification Results

| Selector Target | Current Selector | Found In Real Page | Status | Notes |
|---|---|---|---|---|
| Job Title Header | `[data-automation-id="jobPostingHeader"]` | **YES** — H2 element | **MATCH** ✓ | Correct ID found, contains "Machine Learning Engineer, AI Studio" |
| Apply Button | `[data-automation-id="applyButton"]` | **NO** | **STALE** ✗ | Real ID is `data-automation-id="adventureButton"` on anchor tag with href `/apply` |
| Location | `[data-automation-id="jobLocation"]` | **NO** | **STALE** ✗ | Real ID is `data-automation-id="locations"` (plural), contains "United States - Remote" |
| Description | `[data-automation-id="jobDescription"]` | **NO** | **STALE** ✗ | Real ID is `data-automation-id="jobPostingDescription"`, contains full job description text |
| Company Name | `[data-automation-id="companyName"]` | **NO** | **STALE** ✗ | No such automation ID exists on the page. Company name "Amgen" rendered in header banner but not in dedicated automation element |

## All Data-Automation-IDs Found on Page

```
accessibilitySkipToMainContent
header
logoLink
logo
headerTitle
navigationContainer
utilityButtonBar
utilityButtonBarLanguageMenu
utilityMenuButton
utility-button-bar-divider
utilityButtonSignIn
navigationItem-Amgen
navigationItem-Search for Jobs
hammyMenuIcon
banner
jobPostingPage (container div)
jobPostingHeader (job title) ← CORRECT
adventureButton (apply button) ← NOT "applyButton"
job-posting-details
remoteType
locations (not jobLocation) ← STALE
time
postedOn
requisitionId
jobPostingDescription (not jobDescription) ← STALE
similar-jobs-heading
similarJobsCard
remoteType
locations
time
postedOn
expandable-outer
expandable-inner
jobSidebar
sidebar
imageSection
image
richText
readMore
footerContainer
followUs
socialIcon (multiple)
privacyLink
logo
```

## Fallback Selectors

The extension has fallback selectors (lines 191-208). These work for some fields:
- `title: ['[data-automation-id="jobPostingHeader"]', 'h1', '.job-title']` — First selector **MATCHES**, fallbacks not needed
- `company: ['.company-name', '[data-automation-id="companyName"]']` — Neither fallback exists (no `.company-name` class found)
- `location: ['[data-automation-id="jobLocation"]', '.location']` — First fails, second NOT verified
- `description: ['[data-automation-id="jobDescription"]', '.job-description']` — First fails, second NOT verified

## Autofill Field Map

The generic AUTOFILL_FIELD_MAP (lines 262–361) uses `name`, `id`, `placeholder`, `data-field`, and `autocomplete` attributes. Since the job posting page itself does NOT have application form fields (they appear only after clicking Apply), this map's applicability cannot be fully verified from the job listing view alone. However, the map is generic enough to likely work with Workday's application form fields when encountered.

## Recommendations

**URGENT - Update extension/content.js:**

1. **Apply Button (line 211):** Change `[data-automation-id="applyButton"]` to `[data-automation-id="adventureButton"]`
2. **Location (line 202):** Change `[data-automation-id="jobLocation"]` to `[data-automation-id="locations"]`
3. **Description (line 206):** Change `[data-automation-id="jobDescription"]` to `[data-automation-id="jobPostingDescription"]`
4. **Company Name (line 199):** Remove or comment out `[data-automation-id="companyName"]` and rely only on the `.company-name` fallback (which is also not found) OR extract company from page title/header or a different selector. **Workday does not provide a dedicated company name automation ID.**

## Verification Date & Confidence

- **Date Verified:** 2026-08-27 (today)
- **Page Status:** Live, currently accepting applications (deadline August 31, 2026)
- **Confidence:** HIGH — Real browser rendering with live DOM inspection, not mocked data
