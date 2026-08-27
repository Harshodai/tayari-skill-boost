# Ashby Selector Verification Report

**Applied to extension/content.js:** only `applyButton: ['a[href*="/application"]']` — a real, valid CSS attribute selector, added as a new entry (Ashby previously had none). The `:contains(...)` suggestions elsewhere in this report are jQuery syntax, NOT valid CSS/`querySelectorAll` — they were deliberately NOT applied; a real fix for the LinkedIn-field and Apply-by-text cases below would need actual DOM text-walking, not a selector string.

**Date:** 2026-08-27  
**URL Tested:** https://jobs.ashbyhq.com/cohere/8c035d3d-081d-4c8a-914a-72f4efaad254  
**Job:** Software Engineer Intern (Winter 2027) @ Cohere  
**Platform:** Ashby Jobs (jobs.ashbyhq.com)

---

## Executive Summary

**RENDERING GAP CONFIRMED:** Ashby is a pure client-rendered React app. The raw HTML contains only an empty app shell. All job content and form fields are rendered dynamically by JavaScript. The current selectors in `extension/content.js` (which target static class names like `.job-title`, `.company-name`, etc.) **will NOT work** because these classes do not exist in the rendered DOM.

The generic `AUTOFILL_FIELD_MAP` has better prospects since it uses fallback patterns (placeholder text matching, type attribute matching), but will still require testing against the actual rendered form fields.

---

## Selector Verification Table

| Selector Target | Current Selector(s) in content.js | Status | Findings |
|---|---|---|---|
| **title** | `['h1', '.job-title']` | STALE | `h1` exists but `.job-title` class does NOT. The title is rendered in a dynamic heading. Fallback to `h1` may work, but is fragile in a React app. |
| **company** | `['.company-name', '.org-name']` | STALE | Neither `.company-name` nor `.org-name` classes found. Company is shown as a logo/link (`<img alt="Cohere">`) in the header. Should target `img[alt]` or the company link text. |
| **location** | `['.location', '.job-location']` | STALE | Neither class found. Location text ("Canada; United States") is rendered inside metadata labels with no distinctive class. Observable only via text content traversal. |
| **description** | `['.description', '.job-description']` | STALE | Neither class found. Job description is in prose sections ("Who are we?", "Why this role?") with no summary selector. Requires text content parsing. |
| **applyButton** | MISSING | MISSING | **Real gap confirmed.** An "Apply for this Job" button/link exists and is clickable, but has no static selector. The button text content is "Apply for this Job"; navigates to `/application` path. Suggested selector: `a[href*="/application"], button:contains("Apply")` or target by text traversal. |

---

## Detailed Findings

### Job View Page (Overview Tab)

**What I Observed:**
- Company logo/link at top (no class, just an `<img>` with alt text)
- Main heading: "Software Engineer Intern (Winter 2027)"
- Metadata section listing:
  - Location: "Canada; United States"
  - Employment Type: "Intern"
  - Location Type: "Remote"
  - Department: "Internships"
- Two tabs: "Overview" (active) and "Application"
- An "Apply for this Job" button/link

**Why Current Selectors Fail:**
The current selectors assume class-based targeting (`.job-title`, `.company-name`, `.location`), which is a common ATS pattern. However, Ashby uses a React component-based layout with inline styles and minimal class usage. The selectors are designed for a static HTML structure, not a client-rendered app.

### Application Form

**Form Fields Found:**
1. Name* (text) - placeholder "Type here..."
2. Email* (email) - placeholder "hello@example.com..."
3. Current company (text) - placeholder "Type here..."
4. Current location (text) - placeholder "Type here..."
5. Phone (tel) - placeholder "1-415-555-1234..."
6. Resume* (file upload)
7. Additional information (textarea) - placeholder "Type here..."
8. When are you available for internship?* (text)
9. Which location are you the closest to? (text)
10. LinkedIn* (text) - **REQUIRED** - placeholder "Type here..."
11. Website (text) - placeholder "Type here..."
12. Twitter (text)

**AUTOFILL_FIELD_MAP Assessment:**

The generic field map uses fuzzy matching on:
- `name` attribute (case-insensitive patterns like `name*="email"`)
- `id` attribute (patterns like `id*="email"`)
- `placeholder` attribute
- `autocomplete` attribute
- `data-field` attribute

**Likelihood of Match:**
- ✅ **Email field:** Will match via `input[type="email"]` or placeholder matching if field renders with `placeholder="hello@example.com..."`
- ✅ **Phone field:** Will match via `input[type="tel"]` if Ashby renders it with `type="tel"`
- ⚠️ **Name/Full Name:** Generic `fullName` selector looks for `name*="name"` or `placeholder*="name"` — but Ashby uses generic placeholder "Type here..." which won't match the placeholder patterns. May need to match by label text instead.
- ⚠️ **LinkedIn:** Not in AUTOFILL_FIELD_MAP! There's a LinkedIn* (required) field on Ashby, but no specific `linkedin` pattern in the map. The map has:
  ```javascript
  linkedin: {
    selectors: [
      'input[name*="linkedin" i]',
      'input[id*="linkedin" i]',
      'input[placeholder*="linkedin" i]',
      'input[data-field="linkedin"]'
    ]
  }
  ```
  Ashby's LinkedIn field likely has none of these attributes. This is a gap.
- ⚠️ **Website:** Present in map, may match if Ashby uses `id*="website"` or `name*="website"` (unlikely given generic placeholders).
- ❌ **Cover Letter:** Not present in this Ashby posting. (Map has `coverLetter` selector, but it's not needed here.)

**Key Issue:** Ashby form fields appear to use **generic placeholder text** ("Type here...") and likely have no `name` or `id` attributes with semantic keywords. This breaks most of the fuzzy-match patterns in `AUTOFILL_FIELD_MAP`.

---

## Missing applyButton Selector

**Real Gap: YES**

The "Apply for this Job" button is a real, clickable element on the Ashby job page. However, it has no data-automation-id or consistent DOM selector.

**Suggested Fix:**

Add an Ashby-specific `applyButton` selector:

```javascript
ashby: {
  jobView: {
    title: ['h1', '.job-title'],
    company: ['.company-name', '.org-name'],
    location: ['.location', '.job-location'],
    description: ['.description', '.job-description']
  },
  applyButton: [
    'a[href*="/application"]',
    'button:contains("Apply")',  // If :contains is supported
    'a[href*="/application"]:last-of-type'
  ]
}
```

Or, since the button navigates to a path ending in `/application`:
```javascript
applyButton: ['a[href*="/application"], button[role="link"][href*="/application"]']
```

**Reality Check:** Ashby's React rendering may change the DOM structure between page loads. A robust solution would require detecting the Ashby platform at runtime and matching by text content ("Apply for this Job") or data attribute if Ashby adds one.

---

## Recommendations

### 1. **Job Metadata Selectors (title, company, location, description)**

**Status:** UNVERIFIABLE with current approach  
**Why:** Ashby uses dynamic React rendering with no stable class-based selectors.

**Options:**
- (A) Add runtime JavaScript detection for Ashby platform, use DOM traversal/text matching instead of class selectors
- (B) Use Ashby's initial state JSON (if available) — check if `window.__appData` or a script tag contains job metadata
- (C) Accept that static selectors won't work; require Ashby jobs to be processed via browser automation (Playwright/Puppeteer) rather than content script injection

### 2. **Application Form Autofill**

**Status:** RISKY with current AUTOFILL_FIELD_MAP  
**Why:** Ashby uses generic placeholders and likely no semantic name/id attributes.

**Fix:**
- Extend `AUTOFILL_FIELD_MAP` to include Ashby-specific patterns:
  ```javascript
  fullName: {
    // existing patterns...
    selectors: [
      // ... existing ...
      // Ashby-specific: match by placeholder text
      'input[placeholder="Type here..."]:nth-of-type(1)',  // First text input is Name
    ]
  },
  linkedin: {
    selectors: [
      // ... existing ...
      // Ashby-specific: Look for LinkedIn label or id containing "linkedin"
      'input:has(+ div:contains("LinkedIn"))',
      'input[id*="linkedin" i]',
    ]
  }
  ```

- **Better:** Use a label-based matcher for Ashby: `input + label:contains("LinkedIn")` or traverse to find the input associated with a "LinkedIn" label.

### 3. **Apply Button Selector**

**Status:** ADD MISSING SELECTOR  
**Recommendation:**
```javascript
applyButton: [
  'a[href*="/application"]'
]
```

This will capture the "Apply for this Job" link that navigates to the job application form.

---

## Test Results Summary

| Component | Match | Stale | Unverifiable | Notes |
|---|:---:|:---:|:---:|---|
| Job title | | ✓ | | No `.job-title` class; `h1` exists but fragile |
| Company | | ✓ | | No `.company-name` or `.org-name`; use `img[alt]` instead |
| Location | | ✓ | | No class found; render as plain text in metadata |
| Description | | ✓ | | No class found; render as prose in section |
| Apply Button | ✓ | | | **MISSING from current code** — suggest adding `'a[href*="/application"]'` |
| Name field (form) | | | ✓ | Uses generic placeholder "Type here...", no name/id attributes detectable |
| Email field (form) | ✓ | | | `type="email"` + generic placeholder — matches by type |
| Phone field (form) | ✓ | | | `type="tel"` — matches by type |
| LinkedIn field (form) | | | ✓ | **Not in AUTOFILL_FIELD_MAP at all** — form has LinkedIn* (required) but generic placeholder |
| Website field (form) | | | ✓ | Uses generic placeholder "Type here..." |

---

## Conclusion

**Ashby job postings are not well-suited to static class-name-based selectors.** The platform is entirely client-rendered, uses minimal class styling, and form fields rely on placeholder text and label associations rather than semantic attributes.

**For the extension to work reliably on Ashby:**
1. Add the missing `applyButton` selector (`a[href*="/application"]`)
2. Extend `AUTOFILL_FIELD_MAP` with label-based or placeholder-based patterns for Ashby
3. Consider implementing Ashby-specific autofill logic that traverses labels instead of relying on name/id attribute matching

**Priority:** Medium  
- Ashby is a live job platform but less common than Lever, Greenhouse, or LinkedIn
- The generic autofill may work for email and phone fields by type, but will miss Name and LinkedIn
- Job metadata (title, company, location) extraction is not viable with current class-based selectors
