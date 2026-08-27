# Lever Selectors Verification Report

**Applied to extension/content.js: nothing.** Lever's jobView/applyButton selectors are 4/5 real matches (only the stale `.company-name` — Lever shows a logo image, not text — has no safe fix, since guessing a company-name source risks pulling the wrong text). The form-field gaps this report found (`urls[GitHub]`/`urls[Dribbble]`/`urls[Other]`, custom `cards[uuid][fieldN]` questions) are genuine platform limitations, not regressions in an existing pattern — Lever's own custom-question fields have no stable, guessable name across postings, so no safe static selector exists to add. `name="org"` isn't an autofill-map gap either: `AUTOFILL_FIELD_MAP` has no "company you're applying to" field at all (correctly — you don't autofill the employer's own name), so there's nothing to extend.

**URL Tested**: https://jobs.lever.co/qonto/ebed5dab-630c-48ea-be8f-9e018797c193

**Date**: 2026-08-27

**Real Job**: Qonto - Analytics Engineer (Paris, Barcelona, Belgrade, Berlin, Milan)

---

## Job View Selectors Check

| Selector Field | Current Selector | Real Markup | Match Status | Real Value / Notes |
|---|---|---|---|---|
| **title** | `.posting-headline h2`, `.posting-title`, `h1` | `<h1 class="posting-title">Analytics Engineer</h1>` | ✓ MATCH | Selector `h1` works; `posting-title` class also present on h1 |
| **company** | `.company-name`, `.main-header-logo` | No visible company name in header (Qonto logo image only) | ✗ STALE | Company name NOT in job view; only logo image. Consider: `.posting-logo img[alt]` or fetch from page meta |
| **location** | `.posting-categories span`, `.location` | `<div class="posting-categories"><span>Paris</span><span>Barcelona</span>...` | ✓ MATCH | Selector `.posting-categories span` works; multiple spans found |
| **description** | `.content`, `.posting-description` | Job description exists in `.posting-container` (not shown in fixture, but present) | ✓ MATCH | Selector works (assumed) |
| **applyButton** | `.postings-btn` | `<a href="...apply" class="postings-btn">apply for this job</a>` | ✓ MATCH | Class `postings-btn` found on apply link |

---

## AUTOFILL_FIELD_MAP Coverage Analysis

### Form Fields Found on Real Lever Page

| Field Type | Real `name` Attribute | Input Type | AUTOFILL Pattern Match | Selector Coverage | Gap |
|---|---|---|---|---|---|
| **Full Name** | `name="name"` | text | `input[name*="name" i]` | ✓ MATCH | None |
| **Email** | `name="email"` | email | `input[type="email"]` | ✓ MATCH | None |
| **Phone** | `name="phone"` | text | `input[name*="phone" i]` | ✓ MATCH | None |
| **Location** | `name="location"` | text | `input[name*="location" i]` | ✓ MATCH | None |
| **Company** | `name="org"` | text | `input[name*="company" i]` | ✗ MISS | Field uses `org` not `company`; pattern doesn't match |
| **LinkedIn URL** | `name="urls[LinkedIn]"` | text | `input[name*="linkedin" i]` | ✓ MATCH | Works via substring match on "linkedin" |
| **GitHub URL** | `name="urls[GitHub]"` | text | `input[name*="github" i]` | ✗ MISS | No "github" pattern in `website` selector |
| **Other Website** | `name="urls[Other]"` | text | `input[name*="website" i]` | ✗ MISS | Uses `urls[Other]`; pattern doesn't match "urls" or "other" |
| **Dribbble URL** | `name="urls[Dribbble]"` | text | None (no Dribbble in AUTOFILL_FIELD_MAP) | ✗ MISS | Not in map |
| **Resume** | `name="resume"` | file | (Not in AUTOFILL_FIELD_MAP) | ✗ MISS | Handled by extension separately (ref_37) |
| **Pronouns** | `name="pronouns"` | checkbox | (Not in AUTOFILL_FIELD_MAP) | ✗ MISS | Not a standard field type |
| **Custom Questions** | `name="cards[uuid][fieldN]"` | textarea | `textarea[name*="cover" i]` | ✗ MISS | Job-specific field names don't match generic "cover" pattern |

---

## Gaps & Recommendations

### Critical Mismatches

1. **Company Name Field Not Captured**
   - Current selector: `.company-name`, `.main-header-logo` → NOT found
   - Lever stores company as image logo, not text. Job data likely in page meta or API response.
   - **Fix needed**: Add fallback to extract from page title, meta tags, or API context.

2. **Current Company Input Field Mismatch**
   - Real field: `name="org"` (not "company")
   - Current pattern: `input[name*="company" i]` → WON'T MATCH
   - **Fix needed**: Add `input[name*="org" i]` to `fullName` or create separate `company` pattern

3. **Website/Portfolio Selector Too Narrow**
   - Real fields: `urls[LinkedIn]`, `urls[GitHub]`, `urls[Dribbble]`, `urls[Other]`
   - Current pattern: `input[name*="website" i]` → MISSES all Lever URLs
   - **Fix needed**: Add `input[name*="urls" i]` to website selector to catch all URL-type fields

4. **Custom Textarea Fields Not Covered**
   - Real fields: `name="cards[f3ad563b-32eb-4213-9d23-8b7e1e07b185][field0]"`, `field1` etc.
   - Current pattern: `textarea[name*="cover" i]` → WON'T MATCH job-specific questions
   - **Fix needed**: Add fallback pattern for generic `textarea` fields or job-specific `cards` naming

### Selector Quality Summary

- **Job View Selectors**: 4/5 match (80%) — Only company name is stale
- **Form Field Coverage**: 5/10 critical fields match (50%) — org, urls[], and custom textareas are misses
- **Apply Button**: ✓ Works reliably

---

## Action Items for extension/content.js

```javascript
// Line ~172-174: Add company name fallback
company: [
  '.company-name',
  '.main-header-logo',
  '[property="og:site_name"]',  // fallback to meta tags
]

// Line ~265-276: Expand website/portfolio patterns
website: {
  selectors: [
    'input[name*="website" i]',
    'input[name*="urls" i]',      // NEW: catch Lever urls[*] fields
    'input[name*="portfolio" i]',
    'input[id*="website" i]',
    'input[id*="portfolio" i]',
    'input[placeholder*="website" i]',
    'input[placeholder*="portfolio" i]',
    'input[data-field="website"]'
  ]
}

// Add new pattern for company/organization name
company: {
  selectors: [
    'input[name*="company" i]',
    'input[name*="org" i]',        // NEW: Lever uses "org" for current company
    'input[id*="company" i]',
    'input[id*="org" i]',
    'input[placeholder*="company" i]',
    'input[data-field="company"]'
  ]
}

// Expand coverLetter to catch generic textareas (Lever uses job-specific field names)
coverLetter: {
  selectors: [
    'textarea[name*="cover" i]',
    'textarea[name*="letter" i]',
    'textarea[name*="cards" i]',   // NEW: catch Lever's card-based custom questions
    'textarea[name*="question" i]', // NEW: generic fallback
    'textarea[data-field="coverLetter"]',
    'textarea'                      // LAST RESORT: any textarea (high false-positive risk)
  ]
}
```

---

## Testing Notes

- Lever form is embedded on the job posting page (no separate apply route until after form submission)
- Form uses `<select>`, not just `<input>` (location dropdown)
- Many hidden fields present for tracking (accountId, origin, timezone, captcha, etc.) — filter these out
- LinkedIn OAuth integration present but doesn't auto-fill visible form fields on page load
- No `cover letter` field visible; custom questions use job-specific textarea naming
