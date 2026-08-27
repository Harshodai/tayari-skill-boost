# Greenhouse Selector Verification Report

**Applied to extension/content.js: nothing.** Verified independently against the actual current file before touching anything: the `id*="first"`/`id*="last"`/`id*="email"`/`id*="location"` fallback patterns this report recommends adding to `AUTOFILL_FIELD_MAP` **already exist** there (they were added in an earlier fix pass) — this report only checked each field's first `name*=...` selector against the real form and didn't check the rest of that field's fallback array, so it under-counted what already works. The real Greenhouse ids found here (`first_name`, `last_name`, `email`, `candidate-location`) are all already caught by the existing `id*=...` fallbacks. No code change was needed for the autofill map. The `jobView`/`applyButton` staleness findings (company/location/description/apply-button classes not present on this real posting) are real, but the only concrete replacement offered (`.btn.btn--rounded`) is too generic to safely hardcode — it would match unrelated buttons — so left as a documented, unfixed gap rather than a risky guess.

**Test Date**: 2026-08-27  
**Test URL**: https://job-boards.greenhouse.io/sourcegraph91/jobs/6103567004  
**Job Title**: Agent Engineer [IC4]  
**Company**: Sourcegraph  
**Page Status**: Live, currently open posting  

---

## Job Posting Header Selectors

| Selector | Status | Real Markup | Notes |
|----------|--------|------------|-------|
| `.app-title` | **STALE** | None found | Title uses `class="section-header section-header--large font-primary"` |
| `h1` | **MATCH** | `<h1 class="section-header section-header--large font-primary">Agent Engineer [IC4]</h1>` | Works correctly |
| `.heading` | **STALE** | None found | Not present on job title element |
| `.company-name` | **N/A** | Not displayed as separate field | Greenhouse doesn't show company name as selectable text on job posting page |
| `[data-qa="company-name"]` | **N/A** | Not found | Greenhouse doesn't use data-qa attributes for company field |
| `.location` | **STALE** | None found | Location ("Remote") is plain text with no class |
| `[data-qa="location"]` | **STALE** | None found | No data-qa attribute on location |
| `.posting-category:last-child` | **STALE** | None found | Not structured this way |
| `.content` | **STALE** | None found | Job description sections not wrapped in `.content` class |
| `.description` | **STALE** | None found | No description wrapper with this class |
| `[data-qa="job-description"]` | **STALE** | None found | Greenhouse doesn't use data-qa for description |
| `#application_form` | **STALE** | None found | Form element has no id attribute |
| `.apply-button` | **STALE** | `<button class="btn btn--rounded">Apply</button>` | Button uses `btn btn--rounded` classes, not `.apply-button` |

---

## Application Form Field Mapping

### Email Field - CRITICAL ISSUE

**Current selector**: `input[type="email"]`  
**Real markup**: `<input id="email" class="input input__single-line" type="text" />`  
**Status**: **FAILS** - Email field uses `type="text"`, not `type="email"`  
**Fix**: Add selector for `input#email` or `input[id*="email" i]`

### First Name Field

**Current selector pattern**: `input[name*="first" i]`  
**Real markup**: `<input id="first_name" class="input input__single-line" type="text" />`  
**Status**: **FAILS** - No `name` attribute present, relies on `id="first_name"`  
**Fix**: Add selector `input[id*="first" i]` or `input#first_name`

### Last Name Field

**Current selector pattern**: `input[name*="last" i]`  
**Real markup**: `<input id="last_name" class="input input__single-line" type="text" />`  
**Status**: **FAILS** - No `name` attribute present, relies on `id="last_name"`  
**Fix**: Add selector `input[id*="last" i]` or `input#last_name`

### Phone Field

**Current selector**: `input[type="tel"]`  
**Real markup**: `<input id="phone" class="input input__single-line iti__tel-input" type="tel" aria-label="Phone" />`  
**Status**: **MATCH** - Type attribute works correctly

### LinkedIn URL Field

**Current selector pattern**: `input[name*="linkedin" i]`  
**Real markup**: `<input id="question_19108210004" class="input input__single-line" type="text" />`  
**Status**: **FAILS** - Dynamically generated id `question_*`, no name or linkedin identifier  
**Fix**: Would require label text matching or data-attributes that aren't present

### Resume/CV Upload

**Current selector pattern**: No specific selector in AUTOFILL_FIELD_MAP  
**Real markup**: `<input id="resume" class="visually-hidden" type="file" />`  
**Status**: Identifier available as `id="resume"`  
**Note**: Extension doesn't autofill file uploads anyway

### Cover Letter Upload

**Current selector pattern**: `textarea[name*="cover" i]`  
**Real markup**: `<input id="cover_letter" class="visually-hidden" type="file" />`  
**Status**: **FAILS** - This is an input[type="file"], not a textarea  
**Note**: Cover letter is upload-only, not free-text textarea

### Location (City) Field

**Current selector pattern**: `input[name*="location" i]` or `input[name*="city" i]`  
**Real markup**: `<input id="candidate-location" class="select__input" type="text" />`  
**Status**: **FAILS** - No name attribute, uses `id="candidate-location"`  
**Fix**: Add selector `input[id*="location" i]` or `input#candidate-location`

### Custom Textarea Questions

**Current selector pattern**: `textarea[name*="cover" i]` (no general textarea pattern)  
**Real markup**: `<textarea id="question_19108212004" class="input input__multi-line"></textarea>`  
**Status**: **PARTIAL** - Textareas exist but use dynamically generated ids  
**Fix**: Would need label-based targeting since ids are non-deterministic

---

## Summary

### Selector Status Breakdown

- **Fully Working**: 1/12 (title with `h1`)
- **Stale/Non-Functional**: 11/12 job posting selectors
- **Field Map Issues**: 4/7 commonly-filled fields fail (email, first_name, last_name, location)

### Root Cause

Greenhouse's current implementation:
1. Uses **minimal CSS class naming** for job posting metadata (title, location, description)
2. Doesn't use `data-qa` attributes for job content
3. Relies on **`id` attributes** (not `name` attributes) for form field targeting
4. Uses **dynamically generated question IDs** (`question_*`) for custom fields
5. **Email field violates HTML5 spec** by using `type="text"` instead of `type="email"`

### Recommended Fixes for extension/content.js

**Greenhouse job posting selectors (lines 137-163):**
```javascript
greenhouse: {
  jobView: {
    title: [
      'main h1',           // Works
      'h1'                 // Fallback
    ],
    company: [
      // Greenhouse doesn't expose company name as clickable text
      // Consider scraping from page title or Sourcegraph logo
    ],
    location: [
      'main > div:nth-child(3)',  // Position-based (fragile)
      // OR parse from page text content
    ],
    description: [
      'main > div:not(form)'   // All divs before form (fragile)
    ]
  },
  applyButton: [
    'button[aria-label="Apply"]',  // More reliable
    'button:has-text("Apply")'     // Text-based selector
  ]
}
```

**AUTOFILL_FIELD_MAP patches needed:**

1. Add `input[id*="email" i]` before `input[type="email"]` for email
2. Add `input[id*="first" i]` for first_name
3. Add `input[id*="last" i]` for last_name
4. Add `input[id*="location" i]` and `input[id*="city" i]` for location
5. Consider label-text matching for dynamically-ID'd questions

---

## Notes

- Greenhouse's form generation is React-based with minimal inline class/data attributes
- Company name field is **not present** on the public job posting page
- Job description sections are **structurally disconnected** (multiple divs, no wrapper)
- Form fields **lack `name` attributes entirely**, relying only on `id`
- Custom question fields use **non-deterministic IDs** (`question_XXXXXXXXX`), making them harder to target reliably
- **The `h1` selector is the only one that currently works** as intended
