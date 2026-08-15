# Tayari Browser Extension v2.0.0

**Agentic Browser Automation MVP** — Detect jobs, autofill applications, and track your job search directly from your browser.

## Features

- **Job Detection** — Automatically detects job listings on LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, Workday, Ashby, and SmartRecruiters
- **Autofill Engine** — Fills application forms with your Tayari profile data (name, email, phone, LinkedIn, website, skills, cover letter)
- **Application Tracking** — Track applications directly from the job page with one click
- **Save Jobs** — Save jobs to your Tayari dashboard from any job listing page
- **Resume Optimization** — Open Tayari's resume optimizer pre-filled with job details
- **Cover Letter Generator** — Generate cover letters from the extension popup
- **Smart Badge** — Extension icon shows a blue dot when you're on a job page

## Installation

### Development (Local)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `/extension` directory from this repo
5. The extension icon will appear in your toolbar

### Production (Chrome Web Store)

Coming in Week 4-5 of the roadmap.

## Setup

1. **Sign in to Tayari** — Open the extension popup and click "Open Tayari" to sign in
2. **Complete your profile** — Fill in your profile at http://localhost:5173/profile so autofill has data to work with
3. **Enable autofill** — In the extension settings, ensure "Enable Autofill" is checked

## How to Use

### Detecting Jobs
When you visit a job listing page (LinkedIn, Indeed, etc.), the extension automatically:
- Detects the job title, company, location, and description
- Shows a floating Tayari panel in the bottom-right corner
- Allows you to save the job, optimize your resume, or generate a cover letter

### Autofilling Applications
When you visit an application form page:
- The floating panel switches to "Application Mode"
- Click **Autofill Form** to automatically fill in your details
- The extension intelligently maps form fields to your profile data
- Click **Track Application** to record the application in your Tayari dashboard

### Using the Popup
Click the extension icon in your toolbar to:
- See currently detected job details
- Save the job to Tayari
- Optimize resume for this job
- Generate a cover letter
- View your job search stats (saved, applied, interviews)
- Access extension settings

### Context Menu (Right-Click)
Right-click anywhere on a job page and select **"Save Job to Tayari"** to quickly save without opening the popup.

### Queue for Review

When you find a job you're interested in but want to review it later:
- Click **Queue for Review** in the floating panel or popup
- The job will be added to your Tayari Review Queue
- Visit `/review-queue` in the Tayari app to approve, reject, or modify before applying
- This is the "Human-in-the-Loop" safety mechanism for autopilot applications

## Supported Platforms

| Platform | Job Detection | Autofill | Notes |
|----------|--------------|----------|-------|
| LinkedIn | ✅ | ✅ | Full support including Easy Apply detection |
| Indeed | ✅ | ✅ | Job view and search results |
| Glassdoor | ✅ | ✅ | Job listings and applications |
| Greenhouse | ✅ | ✅ | ATS application forms |
| Lever | ✅ | ✅ | ATS application forms |
| Workday | ✅ | ✅ | Workday-hosted application forms |
| Ashby | ✅ | ✅ | Ashby ATS forms |
| SmartRecruiters | ✅ | ✅ | SmartRecruiters application forms |
| Generic / Others | ✅ | ✅ | Fallback detection for any job page |

## Architecture

```
extension/
├── manifest.json       # Manifest V3 with permissions
├── background.js       # Service worker: auth, caching, API calls
├── content.js          # Content script: job detection, autofill, UI panel
├── content.css         # Styles for floating panel and animations
├── popup.html          # Extension popup UI
├── popup.js            # Popup controller
├── popup.css           # Popup styles
├── icons/              # Extension icons (16x16, 48x48, 128x128)
└── README.md           # This file
```

### How It Works

1. **Content Script Injection** — `content.js` is injected into all pages matching `https://*/*` and specific job sites
2. **Platform Detection** — The script uses CSS selectors to identify which platform you're on and extract job data
3. **SPA Navigation** — A MutationObserver watches for URL changes and re-runs detection on SPA navigation (LinkedIn, etc.)
4. **Floating Panel** — A context-aware UI panel is injected into the page with relevant actions
5. **Autofill Engine** — Maps form fields to your profile data using name/label/id matching
6. **Background Service** — `background.js` handles API calls to the Tayari backend, caches profile data, and manages authentication
7. **Token Sync** — The Tayari web app sends your JWT token to the extension via external messaging for seamless auth

## API Endpoints Used

The extension communicates with the Tayari backend at `http://localhost:8085/api`
(configurable in the extension's settings popup):

- `GET /api/v1/profile` — Fetch profile data for autofill
- `POST /api/v1/jobs/save` — Save a detected job
- `POST /api/v1/autopilot/applications` — Track an application
- `GET /api/v1/stats` — Get user's job search stats
- `POST /api/v1/resumes/{id}/optimize` — Optimize resume for a job
- `POST /api/v1/cover-letter/generate` — Generate cover letter

## Permissions

The extension requires these permissions:

- `activeTab` — Access current tab for job detection and autofill
- `storage` — Store configuration and profile cache locally
- `scripting` — Inject content scripts into job pages
- `tabs` — Detect page changes and update badge
- `clipboardWrite` — Copy generated cover letters to clipboard
- `notifications` — Show save/apply confirmations
- `contextMenus` — Right-click "Save Job to Tayari" action

Host permissions for job sites and apply URLs are also declared in `manifest.json`.

## Development

### Reloading the Extension
After making changes to any extension file:
1. Go to `chrome://extensions/`
2. Find Tayari Job Companion
3. Click the refresh icon (↻) or press `Ctrl+R` (Cmd+R on Mac)

### Debugging

**Content Script:**
- Open Chrome DevTools on a job page (F12)
- Go to Sources → Content scripts → Tayari Job Companion
- Set breakpoints in `content.js`

**Background Script:**
- Go to `chrome://extensions/`
- Find Tayari Job Companion
- Click "Service worker" link
- This opens a dedicated DevTools for the background script

**Popup:**
- Right-click the extension icon → Inspect popup
- Or: click the extension icon, then right-click inside popup → Inspect

### Testing Autofill

1. Go to a job application form (e.g., Greenhouse, Lever)
2. Open the extension popup
3. Click **Autofill Form**
4. Check the console for detailed field mapping logs

### Testing Job Detection

1. Go to LinkedIn Jobs or Indeed
2. Click on a job listing
3. The floating panel should appear within 2-3 seconds
4. If not, check console for detection errors

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Not authenticated" error | Sign in to Tayari web app and refresh the page |
| Job not detected | Try refreshing the page. SPA navigation may need a moment to detect |
| Autofill not working | Ensure your profile is complete at http://localhost:5173/profile |
| Fields not filled correctly | Some custom forms may need manual entry. The extension shows which fields were filled |
| Extension not appearing | Check that the extension is enabled in `chrome://extensions/` |
| Token expired | Sign out and back in to Tayari web app |

## Roadmap

- **v2.1.0** — Cover letter generation directly in the popup
- **v2.2.0** — Smart apply suggestions (detect if you're qualified)
- **v2.3.0** — Application tracking with status updates from email
- **v2.4.0** — Chrome Web Store release
- **v3.0.0** — Cloud agent integration (Browser-Use / Skyvern) for automated applications

## Changelog

### v2.0.0 (Current)
- Complete rewrite with comprehensive job detection across 8 platforms
- Autofill engine for application forms
- Application tracking from any job page
- Context menu right-click save
- Smart badge indicator on job pages
- Profile caching for faster autofill
- SPA navigation support (LinkedIn, etc.)

### v1.0.0 (Previous)
- Basic job detection for LinkedIn and Indeed
- Save jobs to Tayari
- Simple popup UI

## License

MIT — See LICENSE in repository root.

## Side panel and agentic workflow

Job Tayari 3.0 uses Chrome's side panel as the persistent browser workspace. Click the Job Tayari toolbar icon to open it beside the current page. The panel reads the current supported job page, keeps the same signed-in session as the Job Tayari web app, and exposes reviewable actions for saving a role, running fit analysis, opening the workspace, and queueing an application for human review.

Autofill is approval-gated. The side panel shows an explicit approval checkbox before it can fill fields, and the content script rejects autofill messages that do not carry the approval flag. Job Tayari never clicks a final Submit button automatically; the user remains responsible for reviewing answers and completing submission.

To load the unpacked extension during development, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this `extension/` directory. The release workflow also packages `Job-Tayari-Chrome-Extension.zip` alongside desktop installers.

## Page-aware agent workspace

Version 3.2 adds a review-first agent workspace to the side panel. Users can ask about the active page, use selected text, research across up to eight approved open tabs, or create a draft-only task. Every durable task is created in `awaiting_plan_approval`, and the side panel renders the proposed steps before the user can approve, reject, take over, or stop the task.

The Evidence shelf stores bounded, locally redacted notes with source URLs and capture timestamps. Email addresses, phone-like values, credential-like strings, and long numeric values are redacted before local persistence. Users can clear the shelf at any time. Page text is treated as untrusted content and cannot expand the task scope or authorize a browser action.

A context-menu command, “Ask Job Tayari about this selection,” opens the side panel and inserts selected text into the prompt. Existing job detection, fit analysis, queueing, and approval-gated autofill remain available. Final application submission is not exposed by the extension.

The workspace intentionally does not provide arbitrary shell execution, password or MFA entry, CAPTCHA bypass, unrestricted cookie manipulation, silent message sending, or automatic final submission. Native messaging remains limited to the typed methods documented in `native-host/policy.go`.

Approved plans can now run the bounded read-only page-answer path through the authenticated gateway. The answer is rendered with its source list in the side panel. The “Open control room” action hands the durable task to `/desktop/tasks/:taskId`; the desktop protocol accepts only UUID task links and forwards them through the isolated preload bridge.
