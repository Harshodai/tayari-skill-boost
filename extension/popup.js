// Tayari Browser Extension — Popup Controller (v2.0.0)
// Bridges popup UI with background service worker and content script

const CONFIG = { apiUrl: 'http://localhost:8085/api', token: null };

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

let currentTab = null;
let currentState = 'loading'; // loading, not_authenticated, no_job, job_detected, application_detected

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    // Check authentication
    const config = await sendMessage('get_config');
    if (config) Object.assign(CONFIG, config);

    if (!CONFIG.token) {
      showState('not_authenticated');
      return;
    }

    // Check if job or application form detected on page
    try {
      const pageInfo = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      if (pageInfo?.formDetected) {
        showState('application_detected');
        await loadApplicationInfo(tab.id);
      } else if (pageInfo?.detected) {
        showState('job_detected');
        await loadJobInfo(tab.id);
      } else {
        showState('no_job');
      }
    } catch (e) {
      // Content script not loaded on this page
      showState('no_job');
    }

    // Load stats
    await loadStats();

    // Setup event listeners
    setupEventListeners();

    // Populate settings
    $('api-url').value = CONFIG.apiUrl;

  } catch (e) {
    console.error('Popup init error:', e);
    showMessage('Error initializing. Please refresh.', 'error');
  }
});

// ============================================================
// STATE MANAGEMENT
// ============================================================

function showState(state) {
  currentState = state;
  
  // Hide all states
  $('not-authenticated').classList.add('hidden');
  $('job-detected').classList.add('hidden');
  $('application-detected').classList.add('hidden');
  $('no-job').classList.add('hidden');
  $('authenticated').classList.add('hidden');

  $('auth-status').textContent = '';
  $('auth-status').className = 'status';

  switch (state) {
    case 'not_authenticated':
      $('not-authenticated').classList.remove('hidden');
      $('auth-status').textContent = '⚠️ Sign in required';
      $('auth-status').classList.add('warning');
      break;
    case 'job_detected':
      $('authenticated').classList.remove('hidden');
      $('job-detected').classList.remove('hidden');
      $('auth-status').textContent = '✓ Signed in';
      $('auth-status').classList.add('success');
      break;
    case 'application_detected':
      $('authenticated').classList.remove('hidden');
      $('application-detected').classList.remove('hidden');
      $('auth-status').textContent = '✓ Signed in';
      $('auth-status').classList.add('success');
      break;
    case 'no_job':
      $('authenticated').classList.remove('hidden');
      $('no-job').classList.remove('hidden');
      $('auth-status').textContent = '✓ Signed in';
      $('auth-status').classList.add('success');
      break;
  }
}

// ============================================================
// JOB INFO LOADING
// ============================================================

async function loadJobInfo(tabId) {
  try {
    const info = await chrome.tabs.sendMessage(tabId, { action: 'detect_job' });
    if (info && info.detected) {
      $('detected-title').textContent = info.title || 'Unknown Job';
      $('detected-company').textContent = info.company || 'Unknown Company';
      $('detected-location').textContent = info.location || '';
      $('detected-platform').textContent = info.platform || 'Job Site';
    }
  } catch (e) {
    console.error('Failed to load job info:', e);
  }
}

// ============================================================
// APPLICATION INFO LOADING
// ============================================================

async function loadApplicationInfo(tabId) {
  try {
    const info = await chrome.tabs.sendMessage(tabId, { action: 'detect_job' });
    if (info && info.detected) {
      $('app-form-job').textContent = `${info.title} at ${info.company}`;
    }
  } catch (e) {
    console.error('Failed to load application info:', e);
  }
}

// ============================================================
// STATS LOADING
// ============================================================

async function loadStats() {
  try {
    const res = await fetch(`${CONFIG.apiUrl}/v1/stats`, {
      headers: { Authorization: `Bearer ${CONFIG.token}` }
    });
    if (!res.ok) return;
    
    const stats = await res.json();
    
    const saved = stats.saved_jobs || 0;
    const applied = stats.applied || 0;
    const interviews = stats.interviews || 0;
    const reviewQueue = stats.review_queue_count || 0;
    
    // Update all stat displays
    $('stat-saved').textContent = saved;
    $('stat-applied').textContent = applied;
    $('stat-interviews').textContent = interviews;
    $('quick-saved').textContent = saved;
    $('quick-applied').textContent = applied;
    $('quick-interviews').textContent = interviews;
    if ($('quick-review')) {
      $('quick-review').textContent = reviewQueue;
    }
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {
  // Authentication
  $('btn-open-tayari').addEventListener('click', () => {
    sendMessage('open_tayari', { path: '/auth?next=%2Fextension-onboarding' });
  });

  $('btn-create-account').addEventListener('click', () => sendMessage('open_tayari', { path: '/auth?mode=signup&next=%2Fextension-onboarding' }));

  // Job actions
  $('btn-save').addEventListener('click', async () => {
    if (!currentTab) return;
    
    try {
      const info = await chrome.tabs.sendMessage(currentTab.id, { action: 'detect_job' });
      if (info && info.detected) {
        info.stage = $('stage-selector').value;
        const result = await sendMessage('save_job', info);
        if (result.success) {
          showMessage('Job saved to Tayari! 🎉', 'success');
          await loadStats();
        } else {
          showMessage(result.error || 'Failed to save job', 'error');
        }
      }
    } catch (e) {
      showMessage('Error saving job', 'error');
    }
  });

  $('btn-ats').addEventListener('click', async () => {
    if (!currentTab) return;
    
    $('ats-results').classList.add('hidden');
    showMessage('Analyzing against your latest resume...', 'info');
    
    try {
      const info = await chrome.tabs.sendMessage(currentTab.id, { action: 'detect_job' });
      const jd = (info && info.description) || "";
      if (jd.length < 40) {
        showMessage("Couldn't read job description from this page", 'error');
        return;
      }
      
      const res = await sendMessage('quick_ats', { job_description: jd });
      if (res && res.success && res.result) {
        $('ats-results').classList.remove('hidden');
        const r = res.result;
        $('ats-score-value').textContent = r.overall_score ?? '0';
        $('ats-summary').textContent = r.summary || '';
        
        // matched
        const matchedDiv = $('ats-matched');
        matchedDiv.innerHTML = '';
        if (r.matched_keywords && r.matched_keywords.length > 0) {
          r.matched_keywords.slice(0, 8).forEach(k => {
            const pill = document.createElement('span');
            pill.className = 'pill ok';
            pill.textContent = k;
            matchedDiv.appendChild(pill);
          });
        } else {
          matchedDiv.innerHTML = '<span class="text-muted">None matched</span>';
        }
        
        // missing
        const missingDiv = $('ats-missing');
        missingDiv.innerHTML = '';
        if (r.missing_keywords && r.missing_keywords.length > 0) {
          r.missing_keywords.slice(0, 8).forEach(k => {
            const pill = document.createElement('span');
            pill.className = 'pill bad';
            pill.textContent = k;
            missingDiv.appendChild(pill);
          });
        } else {
          missingDiv.innerHTML = '<span class="text-muted">None missing</span>';
        }
      } else {
        showMessage(res?.error || 'ATS analysis failed', 'error');
      }
    } catch (e) {
      console.error(e);
      showMessage('Error running ATS analysis', 'error');
    }
  });

  $('btn-optimize').addEventListener('click', async () => {
    if (!currentTab) return;
    
    try {
      const info = await chrome.tabs.sendMessage(currentTab.id, { action: 'detect_job' });
      if (info && info.detected) {
        sendMessage('open_tayari', {
          path: `/resume-optimize?job=${encodeURIComponent(info.title)}&company=${encodeURIComponent(info.company)}&description=${encodeURIComponent(info.description || '')}`
        });
      }
    } catch (e) {
      showMessage('Error opening resume optimizer', 'error');
    }
  });

  $('btn-cover-letter').addEventListener('click', async () => {
    if (!currentTab) return;
    
    try {
      const info = await chrome.tabs.sendMessage(currentTab.id, { action: 'detect_job' });
      if (info && info.detected) {
        sendMessage('open_tayari', {
          path: `/cover-letter?job=${encodeURIComponent(info.title)}&company=${encodeURIComponent(info.company)}&description=${encodeURIComponent(info.description || '')}`
        });
      }
    } catch (e) {
      showMessage('Error opening cover letter generator', 'error');
    }
  });

  // Application form actions
  $('btn-autofill').addEventListener('click', async () => {
    if (!currentTab) return;
    
    $('autofill-status').textContent = 'Autofilling...';
    $('autofill-status').className = 'autofill-status loading';
    
    try {
      const result = await chrome.tabs.sendMessage(currentTab.id, { action: 'autofill', approved: true });
      if (result && result.success) {
        const filled = result.filled || 0;
        $('autofill-status').textContent = `✅ Filled ${filled} field(s)`;
        $('autofill-status').className = 'autofill-status success';
        if (result.errors && result.errors.length > 0) {
          console.warn('Autofill errors:', result.errors);
        }
      } else {
        $('autofill-status').textContent = result?.error || '❌ Autofill failed';
        $('autofill-status').className = 'autofill-status error';
      }
    } catch (e) {
      $('autofill-status').textContent = '❌ Error: ' + e.message;
      $('autofill-status').className = 'autofill-status error';
    }
  });

  $('btn-track-app').addEventListener('click', async () => {
    if (!currentTab) return;
    
    try {
      const info = await chrome.tabs.sendMessage(currentTab.id, { action: 'detect_job' });
      if (info && info.detected) {
        const result = await sendMessage('track_application', {
          job: info,
          platform: info.platform
        });
        if (result.success) {
          showMessage('Application tracked! 🎉', 'success');
          await loadStats();
        } else {
          showMessage(result.error || 'Failed to track application', 'error');
        }
      }
    } catch (e) {
      showMessage('Error tracking application', 'error');
    }
  });

  $('btn-queue-review').addEventListener('click', async () => {
    if (!currentTab) return;
    
    try {
      const info = await chrome.tabs.sendMessage(currentTab.id, { action: 'detect_job' });
      if (info && info.detected) {
        const result = await sendMessage('queue_for_review', {
          job: info,
          platform: info.platform
        });
        if (result.success) {
          showMessage('Queued for review! 🎉', 'success');
          await loadStats();
        } else {
          showMessage(result.error || 'Failed to queue for review', 'error');
        }
      }
    } catch (e) {
      showMessage('Error queuing for review', 'error');
    }
  });

  $('btn-queue-review-app').addEventListener('click', async () => {
    if (!currentTab) return;
    
    try {
      const info = await chrome.tabs.sendMessage(currentTab.id, { action: 'detect_job' });
      if (info && info.detected) {
        const result = await sendMessage('queue_for_review', {
          job: info,
          platform: info.platform
        });
        if (result.success) {
          showMessage('Queued for review! 🎉', 'success');
          await loadStats();
        } else {
          showMessage(result.error || 'Failed to queue for review', 'error');
        }
      }
    } catch (e) {
      showMessage('Error queuing for review', 'error');
    }
  });

  // Settings
  $('btn-refresh-profile').addEventListener('click', async () => {
    const btn = $('btn-refresh-profile');
    btn.textContent = 'Refreshing...';
    btn.disabled = true;
    
    try {
      const result = await sendMessage('refresh_profile');
      if (result.profile) {
        showMessage('Profile refreshed! ✓', 'success');
      } else {
        showMessage('Failed to refresh profile', 'error');
      }
    } catch (e) {
      showMessage('Error refreshing profile', 'error');
    } finally {
      btn.textContent = 'Refresh Profile';
      btn.disabled = false;
    }
  });

  $('btn-save-settings').addEventListener('click', async () => {
    CONFIG.apiUrl = $('api-url').value;
    await sendMessage('save_config', { config: CONFIG });
    showMessage('Settings saved ✓', 'success');
  });
}

// ============================================================
// HELPERS
// ============================================================

function sendMessage(action, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      resolve(response);
    });
  });
}

function showMessage(text, type = 'info') {
  const el = $('message');
  el.textContent = text;
  el.className = `message ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => {
    el.classList.add('hidden');
  }, 3000);
}
