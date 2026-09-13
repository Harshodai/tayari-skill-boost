  function normalizePageText(value, limit = 12000) {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, limit);
  }
  function getPageContext() {
    const selection = normalizePageText(window.getSelection?.()?.toString?.() || '', 4000);
    const main = document.querySelector('main, article, [role="main"]');
    const visibleText = normalizePageText(main?.innerText || document.body?.innerText || '', 12000);
    return {
      url: location.href,
      origin: location.origin,
      title: document.title,
      selection,
      visibleText,
      job: currentJob || detectJob() || { detected: false },
      capturedAt: new Date().toISOString(),
      contentTrust: 'untrusted',
    };
  }
// Tayari Browser Extension — Content Script (Job Detection + Autofill + Application Tracking)
// v2.0.0 — Agentic Browser Automation MVP

(function() {
  'use strict';

  // ====================================================================
  // PLATFORM SELECTORS — Comprehensive job detection across platforms
  // ====================================================================

  const PLATFORM_SELECTORS = {
    linkedin: {
      jobView: {
        title: [
          '.job-details-jobs-unified-top-card__job-title h1',
          '.job-details-jobs-unified-top-card__job-title',
          '[data-test-id="job-title"]',
          'h1[data-test-id="job-title"]'
        ],
        company: [
          '.job-details-jobs-unified-top-card__company-name a',
          '.job-details-jobs-unified-top-card__company-name',
          '[data-test-id="company-name"]',
          '.topcard__org-name-link'
        ],
        location: [
          '.job-details-jobs-unified-top-card__bullet',
          '.job-details-jobs-unified-top-card__primary-description-container',
          '[data-test-id="job-location"]',
          '.topcard__flavor--bullet'
        ],
        description: [
          '.jobs-description__content',
          '.job-details-jobs-unified-top-card__job-description',
          '[data-test-id="job-description"]',
          '.description__text'
        ],
        salary: [
          '.job-details-jobs-unified-top-card__job-insight-text',
          '[data-test-id="job-salary"]'
        ],
        easyApply: [
          '.jobs-apply-button[aria-label*="Easy Apply"]',
          'button[data-control-name="jobdetails_topcard_inapply"]'
        ]
      },
      jobSearch: {
        cards: '.jobs-search-results__list-item, .job-card-container',
        title: '.job-card-list__title, .job-card-container__link',
        company: '.job-card-container__company-name, .artdeco-entity-lockup__subtitle',
        location: '.job-card-container__metadata-wrapper'
      }
    },

    indeed: {
      jobView: {
        title: [
          '.jobsearch-JobInfoHeader-title h1',
          '[data-testid="jobsearch-JobInfoHeader-title"]',
          'h1.jobTitle'
        ],
        company: [
          '.jobsearch-InlineCompanyRating div:first-child',
          '[data-testid="company-name"]',
          '[data-testid="inlineHeader-companyName"]',
          '.companyName'
        ],
        location: [
          '.jobsearch-JobInfoHeader-subtitle div:last-child',
          '[data-testid="job-location"]',
          '[data-testid="inlineHeader-locale"]',
          '.companyLocation'
        ],
        description: [
          '.jobsearch-JobComponent-description',
          '[data-testid="job-description"]',
          '#jobDescriptionText'
        ],
        salary: [
          '.jobsearch-JobInfoHeader-salary',
          '[data-testid="job-salary"]'
        ]
      },
      applyButton: [
        '.css-1oxck4p-ApplyButton',
        '[data-testid="job-apply-button"]',
        '.ia-ApplyButton'
      ]
    },

    glassdoor: {
      jobView: {
        title: [
          '[data-test="job-title"]',
          '.JobDetails_title__',
          'h1[data-test="job-title"]'
        ],
        company: [
          '[data-test="employer-name"]',
          '.JobDetails_employerName__',
          '[data-test="employer-short-name"]'
        ],
        location: [
          '[data-test="location"]',
          '.JobDetails_location__'
        ],
        description: [
          '[data-test="job-description"]',
          '.JobDetails_description__',
          '.jobDescriptionContent'
        ],
        salary: [
          '[data-test="salary-estimate"]',
          '.SalaryEstimate_salaryEstimate__'
        ]
      }
    },

    greenhouse: {
      jobView: {
        title: [
          '.app-title',
          'h1',
          '.heading'
        ],
        company: [
          '.company-name',
          '[data-qa="company-name"]'
        ],
        location: [
          '.location',
          '[data-qa="location"]',
          '.posting-category:last-child'
        ],
        description: [
          '.content',
          '.description',
          '[data-qa="job-description"]'
        ]
      },
      applyButton: [
        '#application_form',
        '.apply-button'
      ]
    },

    lever: {
      jobView: {
        title: [
          '.posting-headline h2',
          '.posting-title',
          'h1'
        ],
        company: [
          '.company-name',
          '.main-header-logo'
        ],
        location: [
          '.posting-categories span',
          '.location'
        ],
        description: [
          '.content',
          '.posting-description'
        ]
      },
      applyButton: [
        '.postings-btn'
      ]
    },

    workday: {
      jobView: {
        title: [
          '[data-automation-id="jobPostingHeader"]',
          'h1',
          '.job-title'
        ],
        company: [
          '.company-name',
          '[data-automation-id="companyName"]'
        ],
        location: [
          '[data-automation-id="jobLocation"]',
          '[data-automation-id="locations"]',
          '.location'
        ],
        description: [
          '[data-automation-id="jobDescription"]',
          '[data-automation-id="jobPostingDescription"]',
          '.job-description'
        ]
      },
      // Live-verified 2026-08-27 against a real myworkdayjobs.com posting
      // (see extension/tests/fixtures/workday-notes.md): that tenant used
      // data-automation-id="adventureButton", data-automation-id="locations",
      // and data-automation-id="jobPostingDescription" instead of the
      // originally-assumed ids. Workday's automation-id naming is tenant-
      // customizable, so both old and new ids are kept as fallbacks rather
      // than replacing one company's evidence for another's.
      applyButton: [
        '[data-automation-id="applyButton"]',
        '[data-automation-id="adventureButton"]'
      ]
    },

    ashby: {
      jobView: {
        title: [
          'h1',
          '.job-title'
        ],
        company: [
          '.company-name',
          '.org-name'
        ],
        location: [
          '.location',
          '.job-location'
        ],
        description: [
          '.description',
          '.job-description'
        ]
      },
      // Live-verified 2026-08-27 (extension/tests/fixtures/ashby-notes.md):
      // Ashby's real "Apply for this Job" control links to an /application
      // sub-path; there was previously no applyButton entry for Ashby at all.
      applyButton: [
        'a[href*="/application"]'
      ]
    },

    smartrecruiters: {
      jobView: {
        title: [
          'h1',
          '.job-title'
        ],
        company: [
          '.company-name',
          '.employer-name'
        ],
        location: [
          '.location',
          '.job-location'
        ],
        description: [
          '.description',
          '.job-description'
        ]
      }
    }
  };

  // ====================================================================
  // AUTOFILL FIELD MAPPING — Map form fields to profile data
  // ====================================================================

  const AUTOFILL_FIELD_MAP = {
    // Full Name
    fullName: {
      selectors: [
        'input[name*="name" i]:not([name*="company" i]):not([name*="user" i])',
        'input[id*="name" i]:not([id*="company" i])',
        'input[placeholder*="full name" i]',
        'input[placeholder*="name" i]:not([placeholder*="company" i])',
        'input[aria-label*="name" i]',
        'input[autocomplete="name"]',
        'input[data-field="name"]',
        'input[data-field="fullName"]'
      ],
      exclude: ['company', 'username', 'last_name', 'first_name']
    },
    // First Name
    firstName: {
      selectors: [
        'input[name*="first" i]',
        'input[id*="first" i]',
        'input[placeholder*="first" i]',
        'input[data-field="firstName"]',
        'input[autocomplete="given-name"]'
      ]
    },
    // Last Name
    lastName: {
      selectors: [
        'input[name*="last" i]',
        'input[id*="last" i]',
        'input[placeholder*="last" i]',
        'input[data-field="lastName"]',
        'input[autocomplete="family-name"]'
      ]
    },
    // Email
    email: {
      selectors: [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[id*="email" i]',
        'input[placeholder*="email" i]',
        'input[autocomplete="email"]',
        'input[data-field="email"]'
      ]
    },
    // Phone
    phone: {
      selectors: [
        'input[type="tel"]',
        'input[name*="phone" i]',
        'input[id*="phone" i]',
        'input[placeholder*="phone" i]',
        'input[autocomplete="tel"]',
        'input[data-field="phone"]'
      ]
    },
    // LinkedIn URL
    linkedin: {
      selectors: [
        'input[name*="linkedin" i]',
        'input[id*="linkedin" i]',
        'input[placeholder*="linkedin" i]',
        'input[data-field="linkedin"]'
      ]
    },
    // Website/Portfolio
    website: {
      selectors: [
        'input[name*="website" i]',
        'input[id*="website" i]',
        'input[name*="portfolio" i]',
        'input[id*="portfolio" i]',
        'input[placeholder*="website" i]',
        'input[placeholder*="portfolio" i]',
        'input[data-field="website"]'
      ]
    },
    // Location / City
    location: {
      selectors: [
        'input[name*="location" i]',
        'input[id*="location" i]',
        'input[name*="city" i]',
        'input[id*="city" i]',
        'input[placeholder*="city" i]',
        'input[placeholder*="location" i]',
        'input[data-field="location"]'
      ]
    },
    // Cover Letter
    coverLetter: {
      selectors: [
        'textarea[name*="cover" i]',
        'textarea[id*="cover" i]',
        'textarea[placeholder*="cover" i]',
        'textarea[name*="letter" i]',
        'textarea[data-field="coverLetter"]'
      ]
    }
  };

  // ====================================================================
  // UTILITY FUNCTIONS
  // ====================================================================

  function getText(selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.innerText?.trim() || el.textContent?.trim() || '';
        if (text) return text;
      }
    }
    return '';
  }

  function getElement(selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function detectPlatform() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('indeed.com')) return 'indeed';
    if (host.includes('glassdoor.com')) return 'glassdoor';
    if (host.includes('greenhouse.io')) return 'greenhouse';
    if (host.includes('lever.co')) return 'lever';
    if (host.includes('workday.com')) return 'workday';
    if (host.includes('ashbyhq.com')) return 'ashby';
    if (host.includes('smartrecruiters.com')) return 'smartrecruiters';
    if (host.includes('myworkdayjobs.com')) return 'workday';
    if (host.includes('bamboohr.com')) return 'bamboohr';
    if (host.includes('applytojob.com')) return 'applytojob';
    if (host.includes('recruitee.com')) return 'recruitee';
    if (host.includes('teamtailor.com')) return 'teamtailor';
    if (host.includes('recruiterbox.com')) return 'recruiterbox';
    if (host.includes('jobvite.com')) return 'jobvite';
    if (host.includes('bullhornstaffing.com')) return 'bullhorn';
    return 'generic';
  }

  function isJobApplicationPage() {
    const url = window.location.href.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    
    // Check for application-related URL patterns
    const applicationPatterns = [
      '/apply', '/application', '/apply-now', '/submit',
      '/form', '/candidate', '/jobapp', '/applytojob',
      'workday.com/en-US/apply'
    ];
    
    for (const pattern of applicationPatterns) {
      if (url.includes(pattern)) return true;
    }
    
    // Check for application forms using standard DOM methods
    let formCount = 0;
    
    // Resume upload
    if (document.querySelector('input[type="file"]')) formCount++;
    
    // Cover letter textarea
    const coverTextarea = document.querySelector('textarea[name*="cover" i]');
    if (coverTextarea) formCount++;
    
    // Email input
    if (document.querySelector('input[type="email"]')) formCount++;
    
    // Submit/Apply buttons (check text content)
    const buttons = document.querySelectorAll('button, input[type="submit"]');
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (text.includes('submit') || text.includes('apply')) {
        formCount++;
        break;
      }
    }
    
    return formCount >= 2;
  }

  // ====================================================================
  // JOB DETECTION
  // ====================================================================

  function detectLinkedInJob() {
    const selectors = PLATFORM_SELECTORS.linkedin.jobView;
    const title = getText(selectors.title);
    const company = getText(selectors.company);
    if (!title || !company) return null;
    
    return {
      detected: true,
      platform: 'linkedin',
      title,
      company,
      location: getText(selectors.location),
      description: getText(selectors.description),
      salary: getText(selectors.salary),
      url: window.location.href,
      easyApply: !!getElement(selectors.easyApply),
      isApplicationPage: isJobApplicationPage()
    };
  }

  function detectIndeedJob() {
    const selectors = PLATFORM_SELECTORS.indeed.jobView;
    const title = getText(selectors.title);
    const company = getText(selectors.company);
    if (!title || !company) return null;
    
    return {
      detected: true,
      platform: 'indeed',
      title,
      company,
      location: getText(selectors.location),
      description: getText(selectors.description),
      salary: getText(selectors.salary),
      url: window.location.href,
      isApplicationPage: isJobApplicationPage()
    };
  }

  function detectGlassdoorJob() {
    const selectors = PLATFORM_SELECTORS.glassdoor.jobView;
    const title = getText(selectors.title);
    const company = getText(selectors.company);
    if (!title || !company) return null;
    
    return {
      detected: true,
      platform: 'glassdoor',
      title,
      company,
      location: getText(selectors.location),
      description: getText(selectors.description),
      salary: getText(selectors.salary),
      url: window.location.href,
      isApplicationPage: isJobApplicationPage()
    };
  }

  function detectGreenhouseJob() {
    const selectors = PLATFORM_SELECTORS.greenhouse.jobView;
    const title = getText(selectors.title);
    if (!title) return null;
    
    return {
      detected: true,
      platform: 'greenhouse',
      title,
      company: getText(selectors.company) || document.querySelector('.company-name')?.textContent?.trim() || '',
      location: getText(selectors.location),
      description: getText(selectors.description),
      url: window.location.href,
      isApplicationPage: isJobApplicationPage() || !!document.querySelector('#application_form')
    };
  }

  function detectLeverJob() {
    const selectors = PLATFORM_SELECTORS.lever.jobView;
    const title = getText(selectors.title);
    if (!title) return null;
    
    return {
      detected: true,
      platform: 'lever',
      title,
      company: getText(selectors.company) || document.querySelector('.main-header-logo')?.textContent?.trim() || '',
      location: getText(selectors.location),
      description: getText(selectors.description),
      url: window.location.href,
      isApplicationPage: isJobApplicationPage()
    };
  }

  function detectWorkdayJob() {
    const selectors = PLATFORM_SELECTORS.workday.jobView;
    const title = getText(selectors.title);
    if (!title) return null;
    
    return {
      detected: true,
      platform: 'workday',
      title,
      company: getText(selectors.company) || '',
      location: getText(selectors.location),
      description: getText(selectors.description),
      url: window.location.href,
      isApplicationPage: isJobApplicationPage()
    };
  }

  function detectGenericJob() {
    const title = document.title;
    if (!/job|career|position|role|opening|vacancy/i.test(title)) return null;

    const h1 = document.querySelector('h1');
    const jobTitle = h1 ? h1.innerText.trim() : title.split(/[-|–—]/)[0].trim();

    const companyEl = document.querySelector('[class*="company" i], [class*="employer" i], [data-testid*="company"], [class*="org" i]');
    const company = companyEl ? companyEl.innerText.trim() : '';

    if (!jobTitle) return null;
    
    return {
      detected: true,
      platform: 'generic',
      title: jobTitle,
      company,
      location: '',
      description: document.body.innerText.slice(0, 2000),
      url: window.location.href,
      isApplicationPage: isJobApplicationPage()
    };
  }

  function detectJob() {
    const platform = detectPlatform();
    switch (platform) {
      case 'linkedin': return detectLinkedInJob();
      case 'indeed': return detectIndeedJob();
      case 'glassdoor': return detectGlassdoorJob();
      case 'greenhouse': return detectGreenhouseJob();
      case 'lever': return detectLeverJob();
      case 'workday': return detectWorkdayJob();
      default: return detectGenericJob();
    }
  }

  // ====================================================================
  // AUTOFILL ENGINE
  // ====================================================================

  let profileData = null;
  let autofillEnabled = true;
  // ponytail: distinguishes "the background call itself failed" from
  // "the call succeeded but there's genuinely no profile data" — the click
  // handler below used to show "make sure your profile is complete" for
  // BOTH cases, misattributing a communication failure (extension context
  // invalidated, service worker asleep) to an incomplete profile.
  let lastProfileLoadFailed = false;
  // ponytail: distinguishes "background served last known cache because a
  // fresh fetch just failed" from a normal fresh load — the profile object
  // itself is identical in shape either way, so without this flag a stale
  // (possibly outdated) profile silently autofills into a real application
  // with no indication it wasn't just fetched.
  let lastProfileWasStale = false;

  async function loadProfileData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get_profile_data' });
      lastProfileLoadFailed = false;
      lastProfileWasStale = !!(response && response.stale);
      if (response && response.profile) {
        profileData = response.profile;
        return profileData;
      }
    } catch (e) {
      console.error('Tayari: Failed to load profile data', e);
      lastProfileLoadFailed = true;
    }
    return null;
  }

  function findField(fieldConfig) {
    for (const selector of fieldConfig.selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (!el.disabled && !el.readOnly) {
            // Check exclude patterns
            if (fieldConfig.exclude) {
              const name = (el.name || '').toLowerCase();
              const id = (el.id || '').toLowerCase();
              const placeholder = (el.placeholder || '').toLowerCase();
              const isExcluded = fieldConfig.exclude.some(ex => 
                name.includes(ex) || id.includes(ex) || placeholder.includes(ex)
              );
              if (isExcluded) continue;
            }
            return el;
          }
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    return null;
  }

  function fillField(element, value) {
    if (!element || !value) return false;
    if (element.value && element.value.trim() === value.trim()) return false; // Already filled

    // Focus the element
    element.focus();
    element.click();
    
    // Clear existing value
    element.value = '';
    
    // Set the value
    element.value = value;
    
    // Trigger events to ensure form validation picks up the change
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Visual feedback
    element.style.backgroundColor = '#e0f2fe';
    setTimeout(() => {
      element.style.backgroundColor = '';
      element.style.transition = 'background-color 0.5s ease';
    }, 1000);
    
    return true;
  }

  function autofillForm() {
    // ponytail: this used to return {filled, fields} with no `success` key
    // at all. popup.js's Autofill button checks `result.success` and always
    // fell into the "❌ Autofill failed" branch — even on a fully successful
    // fill — because `success` was always undefined. The in-page floating
    // panel's own button checks `result.filled > 0` directly so it was never
    // affected, which is why this went unnoticed.
    if (!profileData || !autofillEnabled) return { success: false, filled: 0, fields: [], error: 'Profile data not available.' };
    
    const results = [];
    let filledCount = 0;

    // Full Name
    if (profileData.fullName) {
      const field = findField(AUTOFILL_FIELD_MAP.fullName);
      if (field && fillField(field, profileData.fullName)) {
        filledCount++;
        results.push({ field: 'Full Name', value: profileData.fullName });
      }
    }

    // First Name
    if (profileData.firstName) {
      const field = findField(AUTOFILL_FIELD_MAP.firstName);
      if (field && fillField(field, profileData.firstName)) {
        filledCount++;
        results.push({ field: 'First Name', value: profileData.firstName });
      }
    }

    // Last Name
    if (profileData.lastName) {
      const field = findField(AUTOFILL_FIELD_MAP.lastName);
      if (field && fillField(field, profileData.lastName)) {
        filledCount++;
        results.push({ field: 'Last Name', value: profileData.lastName });
      }
    }

    // Email
    if (profileData.email) {
      const field = findField(AUTOFILL_FIELD_MAP.email);
      if (field && fillField(field, profileData.email)) {
        filledCount++;
        results.push({ field: 'Email', value: profileData.email });
      }
    }

    // Phone
    if (profileData.phone) {
      const field = findField(AUTOFILL_FIELD_MAP.phone);
      if (field && fillField(field, profileData.phone)) {
        filledCount++;
        results.push({ field: 'Phone', value: profileData.phone });
      }
    }

    // LinkedIn
    if (profileData.linkedinUrl) {
      const field = findField(AUTOFILL_FIELD_MAP.linkedin);
      if (field && fillField(field, profileData.linkedinUrl)) {
        filledCount++;
        results.push({ field: 'LinkedIn', value: profileData.linkedinUrl });
      }
    }

    // Website
    if (profileData.website) {
      const field = findField(AUTOFILL_FIELD_MAP.website);
      if (field && fillField(field, profileData.website)) {
        filledCount++;
        results.push({ field: 'Website', value: profileData.website });
      }
    }

    // Location
    if (profileData.location) {
      const field = findField(AUTOFILL_FIELD_MAP.location);
      if (field && fillField(field, profileData.location)) {
        filledCount++;
        results.push({ field: 'Location', value: profileData.location });
      }
    }

    // Cover Letter
    if (profileData.coverLetter) {
      const field = findField(AUTOFILL_FIELD_MAP.coverLetter);
      if (field && fillField(field, profileData.coverLetter)) {
        filledCount++;
        results.push({ field: 'Cover Letter', value: 'Generated cover letter' });
      }
    }

    return { success: true, filled: filledCount, fields: results };
  }

  // ====================================================================
  // UI COMPONENTS
  // ====================================================================

  function createFloatingPanel(job) {
    if (document.getElementById('tayari-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'tayari-panel';
    panel.className = 'tayari-panel';
    
    const isApplication = job.isApplicationPage;
    
    panel.innerHTML = `
      <div class="tayari-panel-header">
        <div class="tayari-logo">Tayari</div>
        <button class="tayari-close" id="tayari-close">×</button>
      </div>
      <div class="tayari-panel-body">
        ${!isApplication ? `
          <div class="tayari-job-card">
            <div class="tayari-job-title">${escapeHtml(job.title)}</div>
            <div class="tayari-job-company">${escapeHtml(job.company)}</div>
            ${job.location ? `<div class="tayari-job-location">📍 ${escapeHtml(job.location)}</div>` : ''}
            ${job.salary ? `<div class="tayari-job-salary">💰 ${escapeHtml(job.salary)}</div>` : ''}
            ${job.easyApply ? '<div class="tayari-job-easy-apply">⚡ Easy Apply Available</div>' : ''}
          </div>
          <div class="tayari-actions">
            <button class="tayari-btn tayari-btn-primary" id="tayari-btn-save">
              <span class="tayari-icon">💾</span> Save to Tayari
            </button>
            <button class="tayari-btn tayari-btn-secondary" id="tayari-btn-queue">
              <span class="tayari-icon">📋</span> Queue for Review
            </button>
            <button class="tayari-btn tayari-btn-secondary" id="tayari-btn-optimize">
              <span class="tayari-icon">⚡</span> Optimize Resume
            </button>
            <button class="tayari-btn tayari-btn-secondary" id="tayari-btn-cover">
              <span class="tayari-icon">📝</span> Cover Letter
            </button>
          </div>
        ` : `
          <div class="tayari-application-mode">
            <div class="tayari-status">🚀 Application Form Detected</div>
            <div class="tayari-job-info">
              <div class="tayari-job-title">${escapeHtml(job.title || 'Job Application')}</div>
              <div class="tayari-job-company">${escapeHtml(job.company || 'Unknown Company')}</div>
            </div>
            <label class="tayari-approval-row" for="tayari-autofill-approval">
              <input type="checkbox" id="tayari-autofill-approval" />
              <span>I approve filling visible application fields. I will review every answer before submitting.</span>
            </label>
            <div class="tayari-actions">
              <button class="tayari-btn tayari-btn-primary" id="tayari-btn-autofill" disabled>
                <span class="tayari-icon">📝</span> Autofill Form
              </button>
              <button class="tayari-btn tayari-btn-secondary" id="tayari-btn-track">
                <span class="tayari-icon">📋</span> Track Application
              </button>
              <button class="tayari-btn tayari-btn-secondary" id="tayari-btn-queue-app">
                <span class="tayari-icon">📋</span> Queue for Review
              </button>
            </div>
            <div class="tayari-autofill-status" id="tayari-autofill-status"></div>
          </div>
        `}
      </div>
    `;

    document.body.appendChild(panel);

    // Close button
    document.getElementById('tayari-close').addEventListener('click', () => {
      panel.remove();
    });

    if (!isApplication) {
      // Save button
      document.getElementById('tayari-btn-save').addEventListener('click', async () => {
        const btn = document.getElementById('tayari-btn-save');
        btn.innerHTML = '<span class="tayari-icon">⏳</span> Saving...';
        btn.disabled = true;
        
        try {
          const res = await chrome.runtime.sendMessage({ action: 'save_job', job });
          if (res && res.success) {
            btn.innerHTML = '<span class="tayari-icon">✅</span> Saved!';
            btn.classList.add('tayari-btn-success');
            setTimeout(() => {
              btn.innerHTML = '<span class="tayari-icon">💾</span> Save to Tayari';
              btn.classList.remove('tayari-btn-success');
              btn.disabled = false;
            }, 2000);
          } else {
            throw new Error('Failed');
          }
        } catch (e) {
          btn.innerHTML = '<span class="tayari-icon">❌</span> Error';
          btn.classList.add('tayari-btn-error');
          setTimeout(() => {
            btn.innerHTML = '<span class="tayari-icon">💾</span> Save to Tayari';
            btn.classList.remove('tayari-btn-error');
            btn.disabled = false;
          }, 2000);
        }
      });

      // Queue for Review button
      document.getElementById('tayari-btn-queue').addEventListener('click', async () => {
        const btn = document.getElementById('tayari-btn-queue');
        btn.innerHTML = '<span class="tayari-icon">⏳</span> Queuing...';
        btn.disabled = true;
        
        try {
          const res = await chrome.runtime.sendMessage({ action: 'queue_for_review', job, platform: job.platform });
          if (res && res.success) {
            btn.innerHTML = '<span class="tayari-icon">✅</span> Queued!';
            btn.classList.add('tayari-btn-success');
            setTimeout(() => {
              btn.innerHTML = '<span class="tayari-icon">📋</span> Queue for Review';
              btn.classList.remove('tayari-btn-success');
              btn.disabled = false;
            }, 2000);
          } else {
            throw new Error('Failed');
          }
        } catch (e) {
          btn.innerHTML = '<span class="tayari-icon">❌</span> Error';
          btn.classList.add('tayari-btn-error');
          setTimeout(() => {
            btn.innerHTML = '<span class="tayari-icon">📋</span> Queue for Review';
            btn.classList.remove('tayari-btn-error');
            btn.disabled = false;
          }, 2000);
        }
      });

      // Optimize button
      document.getElementById('tayari-btn-optimize').addEventListener('click', () => {
        const params = new URLSearchParams({
          job_title: job.title || '',
          company: job.company || '',
          description: (job.description || '').slice(0, 500),
          platform: job.platform
        });
        chrome.runtime.sendMessage({ 
          action: 'open_tayari', 
          path: `/resume?${params.toString()}` 
        });
      });

      // Cover letter button
      document.getElementById('tayari-btn-cover').addEventListener('click', () => {
        const params = new URLSearchParams({
          job_title: job.title || '',
          company: job.company || '',
          description: (job.description || '').slice(0, 500)
        });
        chrome.runtime.sendMessage({ 
          action: 'open_tayari', 
          path: `/cover-letter?${params.toString()}` 
        });
      });
    } else {
      // Autofill approval is explicit in every mutation-capable surface.
      const autofillApproval = document.getElementById('tayari-autofill-approval');
      const autofillButton = document.getElementById('tayari-btn-autofill');
      autofillApproval.addEventListener('change', () => { autofillButton.disabled = !autofillApproval.checked; });

      // Autofill button
      autofillButton.addEventListener('click', async () => {
        if (!autofillApproval.checked) return;
        const btn = document.getElementById('tayari-btn-autofill');
        const status = document.getElementById('tayari-autofill-status');
        
        btn.innerHTML = '<span class="tayari-icon">⏳</span> Filling...';
        btn.disabled = true;
        
        await loadProfileData();
        const result = autofillForm();
        
        if (result.filled > 0) {
          btn.innerHTML = `<span class="tayari-icon">✅</span> ${result.filled} Fields Filled`;
          btn.classList.add('tayari-btn-success');
          const fieldList = result.fields.map((field) => `✓ ${String(field.field || '').slice(0, 160)}`).join('\n');
          status.textContent = lastProfileWasStale
            ? `${fieldList}\n⚠️ Using your last-known profile — a fresh sync failed. Double-check these fields before submitting.`
            : fieldList;
          status.classList.add('tayari-status-success');
        } else if (lastProfileLoadFailed) {
          btn.innerHTML = '<span class="tayari-icon">❌</span> Autofill Failed';
          status.textContent = 'Could not load your profile data. Check your connection and try again.';
          status.classList.add('tayari-status-warning');
        } else {
          btn.innerHTML = '<span class="tayari-icon">⚠️</span> No Fields Found';
          status.textContent = 'No matching form fields found. Make sure your profile is complete in Tayari.';
          status.classList.add('tayari-status-warning');
        }
        setTimeout(() => {
          btn.innerHTML = '<span class="tayari-icon">📝</span> Autofill Form';
          btn.classList.remove('tayari-btn-success', 'tayari-btn-warning');
          autofillApproval.checked = false;
          btn.disabled = true;
        }, 3000);
      });

      // Track application button
      document.getElementById('tayari-btn-track').addEventListener('click', async () => {
        const btn = document.getElementById('tayari-btn-track');
        btn.innerHTML = '<span class="tayari-icon">⏳</span> Tracking...';
        btn.disabled = true;
        
        try {
          const res = await chrome.runtime.sendMessage({ 
            action: 'track_application', 
            job: job,
            platform: job.platform
          });
          if (res && res.success) {
            btn.innerHTML = '<span class="tayari-icon">✅</span> Tracked!';
            btn.classList.add('tayari-btn-success');
          } else {
            throw new Error('Failed');
          }
        } catch (e) {
          btn.innerHTML = '<span class="tayari-icon">❌</span> Error';
          btn.classList.add('tayari-btn-error');
        }
        
        setTimeout(() => {
          btn.innerHTML = '<span class="tayari-icon">📋</span> Track Application';
          btn.classList.remove('tayari-btn-success', 'tayari-btn-error');
          btn.disabled = false;
        }, 2000);
      });

      // Queue for Review button (application mode)
      document.getElementById('tayari-btn-queue-app').addEventListener('click', async () => {
        const btn = document.getElementById('tayari-btn-queue-app');
        btn.innerHTML = '<span class="tayari-icon">⏳</span> Queuing...';
        btn.disabled = true;
        
        try {
          const res = await chrome.runtime.sendMessage({ 
            action: 'queue_for_review', 
            job: job,
            platform: job.platform
          });
          if (res && res.success) {
            btn.innerHTML = '<span class="tayari-icon">✅</span> Queued!';
            btn.classList.add('tayari-btn-success');
          } else {
            throw new Error('Failed');
          }
        } catch (e) {
          btn.innerHTML = '<span class="tayari-icon">❌</span> Error';
          btn.classList.add('tayari-btn-error');
        }
        
        setTimeout(() => {
          btn.innerHTML = '<span class="tayari-icon">📋</span> Queue for Review';
          btn.classList.remove('tayari-btn-success', 'tayari-btn-error');
          btn.disabled = false;
        }, 2000);
      });
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ====================================================================
  // INITIALIZATION
  // ====================================================================

  let currentJob = null;
  let panelInjected = false;

  function init() {
    const job = detectJob();
    
    if (job && job.detected) {
      currentJob = job;
      
      // Only inject panel if job details changed or panel doesn't exist
      if (!panelInjected || !document.getElementById('tayari-panel')) {
        // Remove old panel if exists
        const oldPanel = document.getElementById('tayari-panel');
        if (oldPanel) oldPanel.remove();
        
        createFloatingPanel(job);
        panelInjected = true;
      }
    } else {
      // No job detected, remove panel
      const panel = document.getElementById('tayari-panel');
      if (panel) panel.remove();
      panelInjected = false;
      currentJob = null;
    }
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'detect_job') {
      sendResponse(currentJob || detectJob() || { detected: false });
      return true;
    }
    
    if (request.action === 'execute_authorized_bridge_action') {
      if (request.bridgeAction !== 'approved_autofill' || request.approved !== true) {
        sendResponse({ success: false, error: 'Only the reviewed candidate-input bridge action is supported.' });
        return true;
      }
      loadProfileData().then(() => {
        const result = autofillForm();
        sendResponse({ ...result, execution: 'server_authorized_candidate_input' });
      });
      return true;
    }

    if (request.action === 'autofill' || request.action === 'autofill_form') {
      if (request.approved !== true) {
        sendResponse({ success: false, error: 'Explicit approval is required before filling fields.' });
        return true;
      }
      loadProfileData().then(() => {
        const result = autofillForm();
        sendResponse(result);
      });
      return true;
    }
    
    if (request.action === 'get_page_context') {
      sendResponse(getPageContext());
      return true;
    }
    if (request.action === 'get_job_data') {
      sendResponse(currentJob || { detected: false });
      return true;
    }
    
    if (request.action === 'ping') {
      sendResponse({ 
        pong: true, 
        platform: detectPlatform(),
        formDetected: isJobApplicationPage(),
        detected: !!currentJob?.detected
      });
      return true;
    }
    
    return false;
  });

  // Initialize on load
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  // Watch for SPA navigation changes
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      panelInjected = false;
      setTimeout(init, 500); // Delay for SPA to render
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Also re-check periodically for dynamic content
  setInterval(() => {
    if (!document.getElementById('tayari-panel') && detectJob()?.detected) {
      panelInjected = false;
      init();
    }
  }, 3000);

})();
