// Tayari Browser Extension — Background Service Worker (v3.1.0)

importScripts('auth/pkce.js', 'auth/session.js', 'auth/oauth.js', 'nativeBridge.js');
// Agentic Browser Automation MVP: Profile caching, autofill support, application tracking

const STORAGE_KEY = 'tayari_config';
const DEFAULT_CONFIG = { apiUrl: 'https://api.tayari.app/api', appUrl: 'https://tayari.app' };
const PROFILE_CACHE_KEY = 'tayari_profile_cache';
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const TRUSTED_APP_ORIGINS = new Set([
  'https://tayari.app',
  'https://www.tayari.app',
  'https://tayari-skill-boost.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8083',
  'http://localhost:8085',
]);
function isTrustedAppSender(sender) {
  try { return TRUSTED_APP_ORIGINS.has(new URL(sender?.url || '').origin); }
  catch { return false; }
}
// ============================================================
// CONFIGURATION
// ============================================================
async function getConfig() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  let config = result[STORAGE_KEY];
  if (!config) {
    const legacy = await chrome.storage.sync.get([STORAGE_KEY]);
    config = legacy[STORAGE_KEY] || DEFAULT_CONFIG;
    await chrome.storage.local.set({ [STORAGE_KEY]: { ...DEFAULT_CONFIG, ...config, token: undefined } });
    if (legacy[STORAGE_KEY]) await chrome.storage.sync.remove(STORAGE_KEY);
  }
  config = { ...DEFAULT_CONFIG, ...config };
  const session = await TayariSession.getValid(config);
  return { ...config, token: session?.access_token || null, session: session || null };
}
async function saveConfig(config) {
  const safeConfig = {
    apiUrl: config?.apiUrl || DEFAULT_CONFIG.apiUrl,
    appUrl: config?.appUrl || DEFAULT_CONFIG.appUrl,
    supabaseUrl: config?.supabaseUrl,
    supabaseKey: config?.supabaseKey,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: safeConfig });
  return safeConfig;
}
async function getAuthConfig() {
  const current = await getConfig();
  if (current.supabaseUrl && current.supabaseKey) return current;
  const response = await fetch(`${current.apiUrl}/v1/auth/extension/config`);
  if (!response.ok) throw new Error('Job Tayari authentication configuration is unavailable.');
  const remote = await response.json();
  const next = { ...current, supabaseUrl: remote.supabase_url, supabaseKey: remote.supabase_publishable_key, apiUrl: remote.api_url || current.apiUrl };
  await saveConfig(next);
  return next;
}

// ============================================================
// PROFILE DATA CACHING (for autofill)
// ============================================================

async function getProfileData() {
  // Check cache first
  const cache = await chrome.storage.local.get([PROFILE_CACHE_KEY, `${PROFILE_CACHE_KEY}_timestamp`]);
  const cachedData = cache[PROFILE_CACHE_KEY];
  const cachedTimestamp = cache[`${PROFILE_CACHE_KEY}_timestamp`];
  
  if (cachedData && cachedTimestamp && (Date.now() - cachedTimestamp < PROFILE_CACHE_TTL)) {
    return cachedData;
  }
  
  // Fetch from API
  const config = await getConfig();
  if (!config.token) return null;
  
  try {
    const res = await TayariSession.fetchJson(config, "v1/profile");
    if (!res.ok) return null;
    
    const profile = await res.json();
    
    // Transform to autofill format
    const autofillData = transformProfileToAutofill(profile);
    
    // Cache it
    await chrome.storage.local.set({
      [PROFILE_CACHE_KEY]: autofillData,
      [`${PROFILE_CACHE_KEY}_timestamp`]: Date.now()
    });
    
    return autofillData;
  } catch (e) {
    console.error('Tayari: Failed to fetch profile', e);
    return cachedData || null; // Return stale cache as fallback
  }
}

function transformProfileToAutofill(profile) {
  if (!profile) return null;
  
  const fullName = profile.full_name || '';
  const nameParts = fullName.split(' ').filter(Boolean);
  
  return {
    fullName: fullName,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    email: profile.email || '',
    phone: profile.phone || '',
    linkedinUrl: profile.links?.linkedin || '',
    website: profile.links?.portfolio || profile.links?.website || '',
    location: profile.locations?.[0] || '',
    skills: profile.skills || [],
    headline: profile.headline || '',
    summary: profile.summary || '',
    experienceYears: profile.experience_years || 0,
    desiredRoles: profile.desired_roles || []
  };
}

async function invalidateProfileCache() {
  await chrome.storage.local.remove([PROFILE_CACHE_KEY, `${PROFILE_CACHE_KEY}_timestamp`]);
}

// ============================================================
// JOB OPERATIONS
// ============================================================

async function handleSaveJob(job) {
  const config = await getConfig();
  if (!config.token) {
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    const res = await fetch(`${config.apiUrl}/v1/extension/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`
      },
      body: JSON.stringify({
        title: job.title,
        company: job.company,
        location: job.location || '',
        url: job.url,
        description: job.description || '',
        stage: job.stage || 'saved'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { success: true };
  } catch (err) {
    console.error('Tayari: save job failed', err);
    return { success: false, error: err.message };
  }
}

async function handleQuickATS(jd) {
  const config = await getConfig();
  if (!config.token) {
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    const res = await fetch(`${config.apiUrl}/v1/extension/quick-ats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`
      },
      body: JSON.stringify({
        job_description: jd
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, result: data };
  } catch (err) {
    console.error('Tayari: quick-ats failed', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// APPLICATION TRACKING
// ============================================================

async function handleTrackApplication(data) {
  const config = await getConfig();
  if (!config.token) {
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    const res = await fetch(`${config.apiUrl}/v1/autopilot/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`
      },
      body: JSON.stringify({
        job: {
          title: data.job.title,
          company: data.job.company,
          location: data.job.location || '',
          description: data.job.description || '',
          url: data.job.url,
          platform: data.platform || data.job.platform || 'unknown'
        },
        status: 'applied',
        submission_mode: 'manual_extension',
        apply_url: data.job.url
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    return { success: true, application_id: result.application_id };
  } catch (err) {
    console.error('Tayari: track application failed', err);
    return { success: false, error: err.message };
  }
}

async function handleQueueForReview(data) {
  const config = await getConfig();
  if (!config.token) {
    return { success: false, error: 'Not authenticated' };
  }
  
  try {
    const res = await fetch(`${config.apiUrl}/v1/review-queue/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`
      },
      body: JSON.stringify({
        job: {
          title: data.job.title,
          company: data.job.company,
          location: data.job.location || '',
          description: data.job.description || '',
          url: data.job.url,
          platform: data.platform || data.job.platform || 'unknown'
        },
        apply_url: data.job.url,
        notes: data.notes || 'Queued from browser extension'
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    return { success: true, application_id: result.application_id };
  } catch (err) {
    console.error('Tayari: queue for review failed', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// SIDE PANEL CONTEXT
// ============================================================
async function getActiveContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { tab: null, job: { detected: false } };
  try {
    const job = await chrome.tabs.sendMessage(tab.id, { action: 'detect_job' });
    return { tab: { id: tab.id, title: tab.title || '', url: tab.url || '' }, job: job || { detected: false } };
  } catch {
    return { tab: { id: tab.id, title: tab.title || '', url: tab.url || '' }, job: { detected: false } };
  }
}
async function approvedAutofill(tabId) {
  if (!Number.isInteger(tabId) || tabId <= 0) return { success: false, error: 'No active page selected.' };
  try {
    return await chrome.tabs.sendMessage(tabId, { action: 'autofill', approved: true });
  } catch {
    return { success: false, error: 'This page does not expose an application form.' };
  }
}
// MESSAGE HANDLING
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    switch (request.action) {
      case 'sign_in_pkce': {
        try {
          const authConfig = await getAuthConfig();
          const session = await TayariOAuth.begin(authConfig, request.provider || 'google');
          await invalidateProfileCache();
          sendResponse({ success: true, user: session.user || null });
        } catch (error) {
          sendResponse({ success: false, error: error.message || 'Sign-in failed.' });
        }
        break;
      }
      case 'sign_out': {
        try {
          await TayariOAuth.signOut(await getConfig());
          await invalidateProfileCache();
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message || 'Sign-out failed.' });
        }
        break;
      }
      case 'session_status': {
        const session = await TayariSession.read();
        sendResponse({ authenticated: Boolean(session?.access_token), user: session?.user || null });
        break;
      }
      case 'native_status': {
        sendResponse({ status: TayariNativeBridge.getStatus() });
        break;
      }
      case 'native_connect': {
        try {
          TayariNativeBridge.ensure();
          sendResponse({ success: true, status: TayariNativeBridge.getStatus() });
        } catch (error) {
          sendResponse({ success: false, status: TayariNativeBridge.getStatus(), error: error.message });
        }
        break;
      }
      case 'native_request': {
        try {
          const result = await TayariNativeBridge.request(request.method, request.params || {}, request.capability || null);
          sendResponse({ success: true, result });
        } catch (error) {
          sendResponse({ success: false, error: error.message || 'Native bridge request failed.' });
        }
        break;
      }
      case 'save_job': {
        const result = await handleSaveJob(request.job);
        sendResponse(result);
        break;
      }
      
      case 'quick_ats': {
        const result = await handleQuickATS(request.job_description);
        sendResponse(result);
        break;
      }
      
      case 'track_application': {
        const result = await handleTrackApplication(request);
        sendResponse(result);
        break;
      }
      
      case 'queue_for_review': {
        const result = await handleQueueForReview(request);
        sendResponse(result);
        break;
      }
      
      case 'get_active_context': {
        sendResponse(await getActiveContext());
        break;
      }
      case 'approved_autofill': {
        if (request.approved !== true) {
          sendResponse({ success: false, error: 'Explicit approval is required before filling fields.' });
          break;
        }
        const context = await getActiveContext();
        sendResponse(await approvedAutofill(request.tabId || context.tab?.id));
        break;
      }
      case 'get_profile_data': {
        const profile = await getProfileData();
        sendResponse({ profile });
        break;
      }
      
      case 'refresh_profile': {
        await invalidateProfileCache();
        const profile = await getProfileData();
        sendResponse({ profile });
        break;
      }
      
      case 'open_tayari': {
        const config = await getConfig();
        const appUrl = config.appUrl || 'https://tayari.app';
      const requestedPath = typeof request.path === 'string' && request.path.startsWith('/') ? request.path : '/';
      const url = `${appUrl.replace(/\/$/, '')}${requestedPath}`;
        chrome.tabs.create({ url });
        sendResponse({ success: true });
        break;
      }
      
      case 'get_config': {
        const config = await getConfig();
        sendResponse(config);
        break;
      }
      
      case 'save_config': {
        await saveConfig(request.config);
        sendResponse({ success: true });
        break;
      }
      
      case 'ping': {
        sendResponse({ pong: true, version: '2.0.0' });
        break;
      }
      
      default: {
        sendResponse({ error: 'Unknown action' });
      }
    }
  })();
  
  return true; // async response
});

// ============================================================
// EXTERNAL MESSAGE HANDLING (from Tayari web app)
// ============================================================

// ============================================================
// EXTERNAL MESSAGE HANDLING (from Tayari web app)
// ============================================================
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (!isTrustedAppSender(sender)) {
    sendResponse({ success: false, error: 'Untrusted application origin.' });
    return false;
  }
  if (request.action === 'set_token') {
    sendResponse({ success: false, error: 'Token push is disabled. Use secure extension sign-in.' });
    return false;
  }
  if (request.action === 'clear_token') {
    void TayariOAuth.signOut(getConfig()).then(() => invalidateProfileCache());
    sendResponse({ success: true });
    return false;
  }
  if (request.action === 'get_version') {
    sendResponse({ version: '3.1.0', features: ['pkce_auth', 'job_detection', 'autofill', 'native_bridge'] });
    return false;
  }
  sendResponse({ error: 'Unknown external action' });
  return false;
});

// ============================================================
// INSTALLATION & UPDATES
// ============================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Job Tayari extension installed');
    chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    // Open onboarding page
    chrome.tabs.create({ url: 'http://localhost:8083/extension-onboarding' });
  } else if (details.reason === 'update') {
    console.log('Job Tayari extension updated from', details.previousVersion, 'to 3.0.0');
    chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    // Invalidate caches on update
    invalidateProfileCache();
  }
});

// ============================================================
// TAB CHANGE LISTENER (for updating icon badge)
// ============================================================

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isJobPage = /linkedin.com\/jobs|indeed.com|glassdoor.com|greenhouse.io|lever.co|workday.com|ashbyhq.com|smartrecruiters.com|apply/i.test(tab.url);
    if (isJobPage) {
      chrome.action.setBadgeText({ text: '●', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});

// ============================================================
// CONTEXT MENU (right-click actions)
// ============================================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'tayari-save-job',
    title: 'Save Job to Tayari',
    contexts: ['page', 'link'],
    documentUrlPatterns: [
      'https://www.linkedin.com/jobs/*',
      'https://*.indeed.com/*',
      'https://*.glassdoor.com/*',
      'https://*.greenhouse.io/*',
      'https://*.lever.co/*',
      'https://*.workday.com/*',
      'https://jobs.*/*',
      'https://careers.*/*'
    ]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'tayari-save-job') {
    try {
      const result = await chrome.tabs.sendMessage(tab.id, { action: 'detect_job' });
      if (result && result.detected) {
        const saveResult = await handleSaveJob(result);
        if (saveResult.success) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Job Saved to Tayari',
            message: `${result.title} at ${result.company}`
          });
        } else {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Failed to Save Job',
            message: saveResult.error || 'Please sign in to Tayari'
          });
        }
      } else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'No Job Detected',
          message: 'Could not detect job details on this page.'
        });
      }
    } catch (e) {
      console.error('Context menu save failed', e);
    }
  }
});

// ============================================================
// ALARMS (periodic tasks)
// ============================================================

chrome.alarms.create('refresh-profile-cache', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refresh-profile-cache') {
    const config = await getConfig();
    if (config.token) {
      await getProfileData(); // Refresh cache
    }
  }
});
