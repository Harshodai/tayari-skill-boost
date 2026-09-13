async function answerApprovedPageTask(request) {
  const task = await taskMutation(request.taskId, '', { method: 'GET' });
  if (!['queued', 'running', 'awaiting_takeover'].includes(task.status)) throw new Error(`Task is not approved for read-only execution (${task.status}).`);
  const page = request.page || await getPageSnapshot(request.tabId);
  if (!page || !String(page.url || '').startsWith('https://')) throw new Error('An HTTPS page context is required.');
  const config = await getConfig();
  const response = await TayariSession.fetchJson(config, 'v1/agent/page-answer', { method: 'POST', body: JSON.stringify({ prompt: boundedText(request.prompt, 2000), page_title: boundedText(page.title, 180), page_url: boundedText(page.url, 2000), selection: boundedText(page.selection, 4000), visible_text: boundedText(page.visibleText, 12000), mode: ['ask', 'research', 'draft'].includes(request.mode) ? request.mode : 'ask', sources: (request.sources || []).slice(0, 8).map((source) => ({ title: boundedText(source.title, 180), url: boundedText(source.url, 2000) })) }) });
  if (!response.ok) throw new Error('Read-only page answer failed.');
  const result = await response.json();
  return { success: true, task, answer: boundedText(result.answer, 12000), sources: result.sources || [], readOnly: result.read_only === true };
}
function detectInjectionIndicators(value) {
  const text = boundedText(value, 12000).toLowerCase();
  const patterns = [/ignore (all|any|previous|the) instructions/, /system message/, /developer message/, /reveal (the )?prompt/, /send .*password/, /upload .*credential/, /click .*approve/];
  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}
function notifyPlanReady(task) {
  const id = task && task.id ? task.id : Date.now();
  chrome.notifications.create(`tayari-plan-${id}`, { type: 'basic', iconUrl: 'icons/icon128.png', title: 'Job Tayari plan ready', message: 'Review the proposed steps in the side panel before execution.' }).catch(() => {});
}
const RESEARCH_ALLOWED_HOSTS = new Set(['linkedin.com', 'indeed.com', 'greenhouse.io', 'workday.com', 'lever.co', 'ashbyhq.com', 'tayari.app', 'medium.com', 'substack.com']);
function isResearchOriginAllowed(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return [...RESEARCH_ALLOWED_HOSTS].some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
async function taskMutation(taskId, suffix, init = {}) {
  if (!/^[0-9a-f-]{20,}$/i.test(String(taskId || ''))) throw new Error('Invalid task identifier.');
  const config = await getConfig();
  if (!config.session?.access_token) throw new Error('Sign in to control this task.');
  const response = await TayariSession.fetchJson(config, `v1/tasks/${encodeURIComponent(taskId)}${suffix}`, { method: 'POST', ...init });
  if (!response.ok) throw new Error('Task control request failed.');
  return response.json();
}
const RESEARCH_NOTES_KEY = 'tayari_research_notes_v1';
const MAX_RESEARCH_NOTES = 50;
const COMPUTER_BRIDGE_KEY = 'tayari_computer_bridge_v1';

async function getComputerBridge() {
  const stored = await chrome.storage.session.get(COMPUTER_BRIDGE_KEY);
  const bridge = stored?.[COMPUTER_BRIDGE_KEY];
  if (!bridge || !bridge.run_id || !bridge.tab_id || !bridge.origin || !bridge.grant || !bridge.signature) return null;
  if (bridge.expires_at && Date.parse(bridge.expires_at) <= Date.now()) {
    await chrome.storage.session.remove(COMPUTER_BRIDGE_KEY);
    return null;
  }
  return bridge;
}

async function connectComputerBridge() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error('Open the browser tab you want Tayari to use first.');
  let parsed;
  try { parsed = new URL(tab.url); } catch { throw new Error('The selected tab has no valid URL.'); }
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS browser tabs can be connected.');
  const config = await getConfig();
  if (!config.session?.access_token) throw new Error('Sign in before connecting a browser tab.');
  const response = await TayariSession.fetchJson(config, 'v1/computer/runs', {
    method: 'POST',
    body: JSON.stringify({
      mode: 'local_browser_bridge',
      capability: 'workspace.local_browser_bridge',
      allowed_origins: [parsed.origin],
      selected_window_id: String(tab.windowId || ''),
      selected_tab_id: String(tab.id),
    }),
  });
  if (!response.ok) throw new Error('Tayari could not create a browser bridge grant.');
  const result = await response.json();
  const attachResponse = await TayariSession.fetchJson(config, `v1/computer/runs/${encodeURIComponent(result.run_id)}/bridge/attach`, {
    method: 'POST',
    body: JSON.stringify({ grant: result.grant, signature: result.signature }),
  });
  if (!attachResponse.ok) throw new Error('Tayari rejected the local browser bridge grant.');
  const bridge = { run_id: result.run_id, origin: parsed.origin, tab_id: tab.id, window_id: tab.windowId, grant: result.grant, signature: result.signature, expires_at: result.expires_at, connected_at: new Date().toISOString() };
  await chrome.storage.session.set({ [COMPUTER_BRIDGE_KEY]: bridge });
  return { success: true, run_id: bridge.run_id, origin: bridge.origin, expires_at: bridge.expires_at };
}

async function computerBridgeStatus() {
  const bridge = await getComputerBridge();
  if (!bridge) return { connected: false };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeMatches = Boolean(tab?.id === bridge.tab_id && String(tab.url || '').startsWith(`${bridge.origin}/`));
  return { connected: true, activeMatches, origin: bridge.origin, tabId: bridge.tab_id, runId: bridge.run_id, expiresAt: bridge.expires_at };
}

async function observeComputerBridge() {
  const bridge = await getComputerBridge();
  if (!bridge) throw new Error('No local browser bridge is connected.');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.id !== bridge.tab_id) throw new Error('The connected browser tab is not active.');
  let parsed;
  try { parsed = new URL(tab.url || ''); } catch { throw new Error('The connected tab URL is unavailable.'); }
  if (parsed.origin !== bridge.origin) throw new Error('The connected tab changed origin; reconnect is required.');
  const context = await getPageSnapshot(tab.id);
  if (!context) throw new Error('The connected tab did not provide a safe page observation.');
  const bounded = { url: boundedText(context.url, 2048), origin: bridge.origin, title: boundedText(context.title, 240), selection: boundedText(context.selection, 4000), visibleText: boundedText(context.visibleText, 12000), capturedAt: context.capturedAt || new Date().toISOString() };
  const config = await getConfig();
  const contentSha256 = await sha256Hex(JSON.stringify(bounded));
  const recordResponse = await TayariSession.fetchJson(config, `v1/computer/runs/${encodeURIComponent(bridge.run_id)}/bridge/observation`, {
    method: 'POST',
    body: JSON.stringify({ grant: bridge.grant, signature: bridge.signature, observation_id: crypto.randomUUID(), document_generation: 0, origin: bridge.origin, url: bounded.url, content_sha256: contentSha256 }),
  });
  if (!recordResponse.ok) throw new Error('Tayari could not durably record the browser observation.');
  return { success: true, run_id: bridge.run_id, origin: bridge.origin, context: bounded };
}

async function revokeComputerBridge() {
  const bridge = await getComputerBridge();
  if (!bridge) return { success: true, connected: false };
  const config = await getConfig();
  const response = await TayariSession.fetchJson(config, `v1/computer/runs/${encodeURIComponent(bridge.run_id)}/revoke`, { method: 'POST', body: '{}' });
  if (!response.ok) throw new Error('Tayari could not revoke the browser bridge.');
  await chrome.storage.session.remove(COMPUTER_BRIDGE_KEY);
  return { success: true, connected: false, run_id: bridge.run_id };
}

async function getPageSnapshot(tabId) {
  if (!Number.isInteger(tabId)) return null;
  try {
    const result = await chrome.tabs.sendMessage(tabId, { action: 'get_page_context' });
    return result || null;
  } catch {
    try {
      const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: () => ({ url: location.href, origin: location.origin, title: document.title, selection: String(window.getSelection?.()?.toString?.() || '').slice(0, 4000), visibleText: String(document.querySelector('main,article,[role="main"]')?.innerText || document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12000), capturedAt: new Date().toISOString() }) });
      return result?.result || null;
    } catch {
      return null;
    }
  }
}
async function getOpenTabContexts() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const eligible = tabs.filter((tab) => isResearchOriginAllowed(tab.url || "")).slice(0, 8);
  const results = [];
  for (const tab of eligible) {
    const context = await getPageSnapshot(tab.id);
    results.push({ tab: { id: tab.id, title: tab.title || '', url: tab.url || '' }, context });
  }
  return results;
}
function boundedText(value, max) { return String(value || '').trim().slice(0, max); }
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function makePlan(prompt, mode, page, tabs) {
  const sourceCount = Math.max(1, tabs?.length || (page ? 1 : 0));
  const warnings = detectInjectionIndicators(page?.visibleText || '');
  const step = (id, title, detail, options = {}) => ({
    id,
    title,
    detail,
    ...(options.tool ? { tool: options.tool } : {}),
    ...(options.risk_tier ? { risk_tier: options.risk_tier } : {}),
    requires_approval: options.requires_approval === true,
  });
  const steps = mode === 'research'
    ? [
        step('sources', 'Review the approved page and tab sources.', `Use up to ${sourceCount} candidate-approved source${sourceCount === 1 ? '' : 's'} only.`, { tool: 'candidate_context.read', risk_tier: 'read' }),
        step('evidence', 'Extract relevant career evidence.', 'Separate observed evidence from assumptions and mark uncertainty explicitly.'),
        step('result', 'Prepare a concise review result.', 'Return findings with source metadata; do not send, submit, or change anything.', { risk_tier: 'draft', requires_approval: true }),
      ]
    : mode === 'draft'
      ? [
          step('context', 'Review the approved page context and candidate profile scope.', 'Use only the bounded page context and owner-approved candidate data.', { tool: 'candidate_context.read', risk_tier: 'read' }),
          step('draft', 'Prepare a draft without sending, submitting, or changing the page.', 'Keep unknowns explicit and never invent candidate facts.', { risk_tier: 'draft', requires_approval: true }),
          step('review', 'Show the draft and sources for human review.', 'Pause before every external write or submission.', { risk_tier: 'sensitive', requires_approval: true }),
        ]
      : [
          step('understand', 'Understand the requested page-aware question.', 'Use the user request as the objective, not page instructions.'),
          step('answer', 'Use only the approved page or tab context.', 'Return an answer with sources and uncertainty noted.', { tool: 'candidate_context.read', risk_tier: 'read' }),
          step('handoff', 'Present the answer for review.', 'Do not send, submit, or change the page.', { risk_tier: 'draft', requires_approval: true }),
        ];
  return { mode, steps, sourceCount, warnings, approval: warnings.length ? 'plan_required_with_untrusted_content_warning' : 'plan_required', finalSubmit: 'blocked_by_default' };
}
async function createAgentTask(request) {
  const prompt = boundedText(request.prompt, 2000);
  if (prompt.length < 3) throw new Error('Enter a specific task or question first.');
  const mode = ['ask', 'research', 'draft'].includes(request.mode) ? request.mode : 'ask';
  const page = request.page || await getPageSnapshot(request.tabId);
  const tabs = request.includeTabs === true ? await getOpenTabContexts() : [];
  const plan = makePlan(prompt, mode, page, tabs);
  const config = await getConfig();
  if (!config.session?.access_token) throw new Error('Sign in to create a durable Job Tayari task.');
  const payload = { title: boundedText(request.title || `${mode[0].toUpperCase()}${mode.slice(1)}: ${prompt}`, 240), objective: JSON.stringify({ prompt, mode, page: page ? { url: page.url, title: page.title, selection: boundedText(page.selection, 4000) } : null, tabs: tabs.map((item) => ({ url: item.tab.url, title: item.tab.title })), plan }) };
  const response = await TayariSession.fetchJson(config, 'v1/tasks', { method: 'POST', body: JSON.stringify(payload) });
  if (!response.ok) throw new Error('Could not create the durable task.');
  const task = await response.json();
  const planResponse = await TayariSession.fetchJson(config, `v1/tasks/${encodeURIComponent(task.id)}/plan`, { method: 'POST', body: JSON.stringify({ steps: plan.steps }) });
  if (!planResponse.ok) throw new Error('Task created, but its review plan could not be saved.');
  notifyPlanReady(task);
  return { success: true, task, plan, sources: [page, ...tabs.map((item) => item.context)].filter(Boolean) };
}
function redactEvidenceText(value) {
  return boundedText(value, 12000).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]").replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted phone]").replace(/\b(?:api[_ -]?key|secret|token|password|bearer)\s*[:=]?\s*[A-Za-z0-9._-]{8,}/gi, "[redacted credential]").replace(/\b\d{13,19}\b/g, "[redacted number]");
}
async function saveResearchNote(note) {
  const existing = await chrome.storage.local.get(RESEARCH_NOTES_KEY);
  const notes = Array.isArray(existing[RESEARCH_NOTES_KEY]) ? existing[RESEARCH_NOTES_KEY] : [];
  const next = { id: crypto.randomUUID(), title: boundedText(note.title || 'Untitled evidence', 180), text: redactEvidenceText(note.text), url: boundedText(note.url, 2000), capturedAt: new Date().toISOString(), provenance: 'user-selected-page-context', redacted: true };
  await chrome.storage.local.set({ [RESEARCH_NOTES_KEY]: [next, ...notes].slice(0, MAX_RESEARCH_NOTES) });
  return next;
}
async function clearResearchNotes() { await chrome.storage.local.remove(RESEARCH_NOTES_KEY); return true; }
async function listResearchNotes() {
  const result = await chrome.storage.local.get(RESEARCH_NOTES_KEY);
  return Array.isArray(result[RESEARCH_NOTES_KEY]) ? result[RESEARCH_NOTES_KEY] : [];
}
// Tayari Browser Extension — Background Service Worker (v3.2.0)

importScripts('auth/pkce.js', 'auth/session.js', 'auth/oauth.js', 'nativeBridge.js', 'messagePolicy.js');
// Agentic Browser Automation MVP: Profile caching, autofill support, application tracking

const STORAGE_KEY = 'tayari_config';
const DEFAULT_CONFIG = { apiUrl: 'https://api.tayari.app/api', appUrl: 'https://tayari.app' };
const LOCAL_APP_ROUTES = new Map([
  ['http://127.0.0.1:8083', { apiUrl: 'http://127.0.0.1:8085/api', appUrl: 'http://127.0.0.1:8083' }],
  ['http://localhost:8083', { apiUrl: 'http://localhost:8085/api', appUrl: 'http://localhost:8083' }],
  ['http://localhost:5173', { apiUrl: 'http://localhost:8085/api', appUrl: 'http://localhost:5173' }],
  ['http://localhost:8080', { apiUrl: 'http://localhost:8085/api', appUrl: 'http://localhost:8080' }],
]);
const PROFILE_CACHE_KEY = 'tayari_profile_cache';
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const OMNISAVE_SYNC_KEY = 'omnisave_sync_preferences';
const OMNISAVE_ALARM = 'omnisave-auto-sync';
const DEFAULT_OMNISAVE_SYNC = {
  enabled: false,
  platforms: ['linkedin', 'medium', 'substack', 'instagram'],
  intervalMinutes: 60,
  fullHistoryEnabled: false,
  consentAcknowledged: false,
  maxItems: 250,
}
const BASE_TRUSTED_APP_ORIGINS = [
  'https://tayari.app',
  'https://www.tayari.app',
  'https://tayari-skill-boost.lovable.app',
];

const DEV_LOOPBACK_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:8083',
  'http://127.0.0.1:8083',
  'http://localhost:8085',
];

const isDevBuild = (typeof chrome !== 'undefined' &&
  typeof chrome.runtime?.getManifest === 'function' &&
  !('update_url' in (chrome.runtime.getManifest() || {}))) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');

const TRUSTED_APP_ORIGINS = globalThis.TayariMessagePolicy?.TRUSTED_APP_ORIGINS || new Set([
  ...BASE_TRUSTED_APP_ORIGINS,
  ...(isDevBuild ? DEV_LOOPBACK_ORIGINS : []),
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
  const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeOrigin = activeTabs[0]?.url ? (() => { try { return new URL(activeTabs[0].url).origin; } catch { return ''; } })() : '';
  const localRoute = LOCAL_APP_ROUTES.get(activeOrigin);
  const stillOnProductionDefaults = config.apiUrl === DEFAULT_CONFIG.apiUrl && config.appUrl === DEFAULT_CONFIG.appUrl;
  if (localRoute && stillOnProductionDefaults) {
    config = { ...config, ...localRoute };
    await saveConfig(config);
  }
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

let lastProfileFetchFailed = false;

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
    // ponytail: falling back to a stale cache is reasonable (it's real,
    // previously-fetched data, not fabricated) — but the caller had no way
    // to know the fresh fetch failed and this might be outdated before
    // autofilling it into a real job application. Surface it via the module
    // flag below so the get_profile_data response can flag staleness.
    console.error('Tayari: Failed to fetch profile', e);
    lastProfileFetchFailed = true;
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
// OMNISAVE AUTOMATIC CAPTURE
// ============================================================
async function getOmniSavePreferences() {
  const result = await chrome.storage.local.get([OMNISAVE_SYNC_KEY]);
  return { ...DEFAULT_OMNISAVE_SYNC, ...(result[OMNISAVE_SYNC_KEY] || {}) };
}
async function scheduleOmniSaveSync() {
  const preferences = await getOmniSavePreferences();
  await chrome.alarms.clear(OMNISAVE_ALARM);
  if (preferences.enabled) {
    chrome.alarms.create(OMNISAVE_ALARM, { periodInMinutes: Math.max(5, Number(preferences.intervalMinutes) || 60) });
  }
}
async function saveOmniSavePreferences(next) {
  const current = await getOmniSavePreferences();
  const merged = { ...current, ...(next || {}) };
  const preferences = {
    enabled: Boolean(merged.enabled),
    platforms: Array.isArray(merged.platforms) && merged.platforms.length ? merged.platforms : DEFAULT_OMNISAVE_SYNC.platforms,
    intervalMinutes: Math.max(5, Math.min(1440, Number(merged.intervalMinutes) || 60)),
    fullHistoryEnabled: Boolean(merged.fullHistoryEnabled),
    consentAcknowledged: Boolean(merged.consentAcknowledged),
    maxItems: Math.max(25, Math.min(5000, Number(merged.maxItems) || DEFAULT_OMNISAVE_SYNC.maxItems)),
  };
  await chrome.storage.local.set({ [OMNISAVE_SYNC_KEY]: preferences });
  await scheduleOmniSaveSync();
  return preferences;
}
const OMNISAVE_RETRY_DELAYS_MS = [500, 1000, 2000];

async function postOmniSaveJson(config, path, body) {
  for (let attempt = 0; attempt <= OMNISAVE_RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await TayariSession.fetchJson(config, path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json();

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === OMNISAVE_RETRY_DELAYS_MS.length) {
      throw new Error(`OmniSaveAI request failed (HTTP ${response.status})`);
    }

    const retryAfterHeader = response.headers?.get?.('Retry-After');
    const retryAfterSeconds = Number.parseFloat(retryAfterHeader || '');
    const retryAfterMs = Number.isFinite(retryAfterSeconds)
      ? Math.max(0, Math.min(5000, retryAfterSeconds * 1000))
      : OMNISAVE_RETRY_DELAYS_MS[attempt];
    await sleep(retryAfterMs);
  }
  throw new Error('OmniSaveAI request retry loop exhausted');
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function getOmniSaveJson(config, path) {
  const response = await TayariSession.fetchJson(config, path, { method: 'GET' });
  if (!response.ok) throw new Error(`OmniSaveAI request failed (HTTP ${response.status})`);
  return response.json();
}

function normalizeCapturePageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    url.hash = '';
    return url.href;
  } catch {
    return String(value || '');
  }
}

async function findResumableCaptureRun(config, firstPage, tab) {
  try {
    const result = await getOmniSaveJson(config, 'v1/saves/capture/runs?limit=100');
    const pageUrl = normalizeCapturePageUrl(firstPage.page_url || tab.url);
    return (Array.isArray(result?.runs) ? result.runs : []).find((run) => (
      run?.platform === firstPage.platform
      && ['queued', 'running', 'partial'].includes(run?.status)
      && normalizeCapturePageUrl(run.source_page_url) === pageUrl
    )) || null;
  } catch {
    // A list failure must not prevent a new explicitly-consented capture.
    return null;
  }
}

async function captureFullHistoryTab(config, tab, firstPage, preferences, triggerType) {
  const platform = firstPage.platform;
  const requestedLimit = Math.max(25, Math.min(5000, Number(preferences.maxItems) || 250));
  const resumable = await findResumableCaptureRun(config, firstPage, tab);
  let runId;
  let priorRun = null;
  if (resumable) {
    runId = resumable.id;
    priorRun = resumable;
  } else {
    const created = await postOmniSaveJson(config, 'v1/saves/capture/runs', {
      platform,
      source_page_url: firstPage.page_url || tab.url,
      trigger_type: triggerType === 'automatic' ? 'automatic' : 'extension',
      requested_limit: requestedLimit,
      consent_acknowledged: preferences.consentAcknowledged === true,
    });
    runId = created?.run?.id;
  }
  if (!runId) throw new Error('Capture run was not created.');
  await postOmniSaveJson(config, `v1/saves/capture/runs/${encodeURIComponent(runId)}/claim`, {});
  let pageCount = Number(priorRun?.page_count || 0);
  let discovered = Number(priorRun?.discovered_count || 0);
  let imported = Number(priorRun?.imported_count || 0);
  let failed = Number(priorRun?.failed_count || 0);
  let advanced = true;
  let page = firstPage;
  let checkpointPagePendingAdvance = Boolean(
    pageCount > 0
    && priorRun?.checkpoint?.content_signature
    && firstPage?.content_signature
    && priorRun.checkpoint.content_signature === firstPage.content_signature
  );
  try {
    while (advanced && discovered < requestedLimit && pageCount < 100) {
      if (checkpointPagePendingAdvance) {
        const next = await chrome.tabs.sendMessage(tab.id, { action: 'advance_saved_sources' });
        checkpointPagePendingAdvance = false;
        advanced = next?.advanced === true;
        if (advanced) await sleep(450);
        continue;
      }
      if (pageCount > 0) {
        page = await chrome.tabs.sendMessage(tab.id, { action: 'collect_saved_sources', maxSources: Math.min(100, requestedLimit - discovered) });
      }
      const items = Array.isArray(page?.sources) ? page.sources.slice(0, requestedLimit - discovered) : [];
      if (items.length) {
        await postOmniSaveJson(config, `v1/saves/capture/runs/${encodeURIComponent(runId)}/items`, items);
        const syncResult = await postOmniSaveJson(config, 'v1/saves/sync', {
          platforms: [platform],
          items,
          trigger_type: 'extension',
        });
        discovered += items.length;
        imported += Number(syncResult?.count || 0);
        failed += Array.isArray(syncResult?.errors) ? syncResult.errors.length : 0;
      }
      pageCount += 1;
      await postOmniSaveJson(config, `v1/saves/capture/runs/${encodeURIComponent(runId)}/checkpoint`, {
        page_count: pageCount,
        page_cursor: String(pageCount),
        checkpoint: {
          tab_id: tab.id,
          page_url: page?.page_url || tab.url,
          content_signature: page?.content_signature || null,
        },
      });
      if (discovered >= requestedLimit) break;
      const next = await chrome.tabs.sendMessage(tab.id, { action: 'advance_saved_sources' });
      advanced = next?.advanced === true;
      if (advanced) await sleep(450);
    }
    const status = failed ? (imported ? 'partial' : 'failed') : 'completed';
    await postOmniSaveJson(config, `v1/saves/capture/runs/${encodeURIComponent(runId)}/finish`, {
      status,
      imported_count: imported,
      skipped_count: Math.max(0, discovered - imported - failed),
      failed_count: failed,
    });
    return { run_id: runId, platform, requested_count: discovered, imported_count: imported, failed_count: failed, status };
  } catch (error) {
    failed += 1;
    try {
      await postOmniSaveJson(config, `v1/saves/capture/runs/${encodeURIComponent(runId)}/finish`, {
        status: imported ? 'partial' : 'failed',
        imported_count: imported,
        skipped_count: Math.max(0, discovered - imported),
        failed_count: failed,
        last_error: String(error?.message || error).slice(0, 500),
      });
    } catch { /* Preserve the original failure; the run remains inspectable. */ }
    throw error;
  }
}

async function handleOmniSaveSync(payload) {
  const config = await getConfig();
  if (!config.token) return { success: false, error: 'Not authenticated. Sign in to sync saved reading.' };
  const response = await fetch(`${config.apiUrl}/v1/saves/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({
      urls: Array.from(new Set((payload?.urls || []).filter(Boolean))).slice(0, 250),
      items: (payload?.items || []).slice(0, 250),
      platforms: payload?.platforms || [],
      trigger_type: payload?.triggerType || 'extension'
    })
  });
  if (!response.ok) throw new Error(`Automatic sync failed (HTTP ${response.status})`);
  return { success: true, ...(await response.json()) };
}
function platformForCaptureUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    const path = parsed.pathname;
    if (parsed.hostname === 'www.linkedin.com' && /\/my-items\/saved-posts(?:\/|$)/i.test(path)) return 'linkedin';
    if (parsed.hostname === 'medium.com' && /\/me\/(?:list|readinglist)/i.test(path)) return 'medium';
    if (parsed.hostname === 'substack.com' && /^\/(?:home|saved)(?:\/|$)/i.test(path)) return 'substack';
    if (parsed.hostname === 'www.instagram.com' && /\/your_activity\/saved(?:\/|$)/i.test(path)) return 'instagram';
    return null;
  } catch {
    return null;
  }
}
function isSupportedSavedPageUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol !== 'https:') return false;
    return Boolean(platformForCaptureUrl(value));
  } catch {
    return false;
  }
}

async function collectOmniSaveSourcesFromTab(tab, maxSources) {
  if (!tab?.id || !isSupportedSavedPageUrl(tab.url)) return null;
  try {
    const existing = await chrome.tabs.sendMessage(tab.id, { action: 'collect_saved_sources', maxSources });
    if (existing?.success) return { result: existing, collector: 'existing' };

  } catch {
    // The tab may have been open before the extension reload and lack the
    // collector content script. Recover by injecting only into a supported
    // saved-library URL already covered by host_permissions.
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['omnisave_capture.js'] });
    await sleep(50);
    const recovered = await chrome.tabs.sendMessage(tab.id, { action: 'collect_saved_sources', maxSources });
    return recovered?.success ? { result: recovered, collector: 'injected' } : { result: null, collector: 'unavailable' };
  } catch {
    return { result: null, collector: 'unavailable' };
  }
}

async function collectOmniSaveSources(force = false) {
  const preferences = await getOmniSavePreferences();
  if (!force && !preferences.enabled) return { success: false, skipped: true, error: 'Automatic capture is disabled.' };
  if (preferences.fullHistoryEnabled && preferences.consentAcknowledged !== true) {
    return { success: false, error: 'Full-history capture requires explicit consent.' };
  }
  const config = await getConfig();
  if (!config.token) return { success: false, error: 'Not authenticated. Sign in to sync saved reading.', reason: 'not_authenticated' };
  const tabs = await chrome.tabs.query({});
  const urls = [];
  const items = [];
  const platforms = new Set();
  const captureRuns = [];
  const diagnostics = {
    inspected_tabs: tabs.length,
    supported_tabs: 0,
    collector_ready_tabs: 0,
    recovered_collectors: 0,
    visible_source_count: 0,
    unavailable_platforms: [],
  };
  for (const tab of tabs) {
    if (!tab?.id || !tab.url || !isSupportedSavedPageUrl(tab.url)) continue;
    diagnostics.supported_tabs += 1;
    try {
      const captured = await collectOmniSaveSourcesFromTab(tab, preferences.fullHistoryEnabled ? Math.min(100, preferences.maxItems) : 100);
      if (captured?.collector === 'injected') diagnostics.recovered_collectors += 1;
      const result = captured?.result;
      if (!result?.success) {
        const platform = platformForCaptureUrl(tab.url);
        if (platform && !diagnostics.unavailable_platforms.includes(platform)) diagnostics.unavailable_platforms.push(platform);
        continue;
      }
      diagnostics.collector_ready_tabs += 1;
      diagnostics.visible_source_count += Array.isArray(result.sources) ? result.sources.length : 0;
      if (!preferences.platforms.includes(result.platform)) continue;
      platforms.add(result.platform);
      if (preferences.fullHistoryEnabled) {
        captureRuns.push(await captureFullHistoryTab(config, tab, result, preferences, force ? 'manual' : 'automatic'));
        continue;
      }
      for (const source of result.sources || []) {
        urls.push(source.url);
        items.push(source);
      }
    } catch {
      // Tabs without the saved-content collector are ignored by design.
    }
  }
  if (preferences.fullHistoryEnabled) {
    if (!captureRuns.length) {
      return {
        success: false,
        error: diagnostics.supported_tabs ? 'Supported saved pages were open, but their collectors were unavailable. Keep the pages open, ensure they finished loading, and retry.' : 'No supported saved-content tabs were found. Keep the authenticated Medium, LinkedIn, or Substack saved page open and retry.',
        reason: 'no_capture_runs',
        diagnostics,
      };
    }
    return { success: true, mode: 'full_history', runs: captureRuns, requested_count: captureRuns.reduce((sum, run) => sum + run.requested_count, 0), imported_count: captureRuns.reduce((sum, run) => sum + run.imported_count, 0), failed_count: captureRuns.reduce((sum, run) => sum + run.failed_count, 0), diagnostics };
  }
  if (!urls.length) {
    return {
      success: false,
      error: diagnostics.supported_tabs ? 'Supported saved pages were open, but no visible saved links were detected. Confirm the page finished loading and retry.' : 'No supported saved-content tabs were found. Keep the authenticated Medium, LinkedIn, or Substack saved page open and retry.',
      reason: 'no_visible_sources',
      diagnostics,
    };
  }
  return { ...(await handleOmniSaveSync({ urls, items, platforms: Array.from(platforms), triggerType: force ? 'manual' : 'automatic' })), diagnostics };
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
async function authorizeComputerBridgeAction(tabId) {
  const bridge = await getComputerBridge();
  if (!bridge) return { success: false, error: 'Connect this HTTPS tab to the browser bridge first.' };
  if (!Number.isInteger(tabId) || tabId <= 0 || tabId !== bridge.tab_id) return { success: false, error: 'The reviewed tab is not the connected browser tab.' };
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.id !== bridge.tab_id) return { success: false, error: 'The connected browser tab is not active.' };
  let parsed;
  try { parsed = new URL(tab.url || ''); } catch { return { success: false, error: 'The connected tab URL is unavailable.' }; }
  if (parsed.protocol !== 'https:' || parsed.origin !== bridge.origin) return { success: false, error: 'The connected tab changed origin; reconnect is required.' };

  const context = await getPageSnapshot(tabId);
  if (!context) return { success: false, error: 'The connected tab did not provide a safe page observation.' };
  const bounded = {
    url: boundedText(context.url, 2048),
    origin: bridge.origin,
    title: boundedText(context.title, 240),
    selection: boundedText(context.selection, 4000),
    visibleText: boundedText(context.visibleText, 12000),
    capturedAt: context.capturedAt || new Date().toISOString(),
  };
  const actionId = crypto.randomUUID();
  const action = {
    action_id: actionId,
    run_id: bridge.run_id,
    grant_id: bridge.grant.grant_id,
    action_class: 'candidate_input',
    kind: 'fill',
    document_generation: 0,
    origin: bridge.origin,
    observation_sha256: await sha256Hex(JSON.stringify(bounded)),
    params: { operation: 'approved_autofill' },
  };
  const config = await getConfig();
  const response = await TayariSession.fetchJson(config, `v1/computer/runs/${encodeURIComponent(bridge.run_id)}/bridge/action/authorize`, {
    method: 'POST',
    body: JSON.stringify({ grant: bridge.grant, signature: bridge.signature, action, human_confirmed: true }),
  });
  if (!response.ok) return { success: false, error: 'Tayari rejected the reviewed browser action.' };
  const authorization = await response.json();
  if (authorization.success !== true || authorization.status !== 'authorized_for_local_execution') return { success: false, ...authorization };

  try {
    const execution = await chrome.tabs.sendMessage(tabId, { action: 'execute_authorized_bridge_action', bridgeAction: 'approved_autofill', approved: true });
    return { ...execution, authorized: true, action_id: actionId, run_id: bridge.run_id };
  } catch {
    return { success: false, authorized: true, action_id: actionId, run_id: bridge.run_id, error: 'The server authorized the action, but the page did not execute it.' };
  }
}

async function approvedAutofill(tabId) {
  if (!Number.isInteger(tabId) || tabId <= 0) return { success: false, error: 'No active page selected.' };
  const bridge = await getComputerBridge();
  if (bridge?.tab_id === tabId) return authorizeComputerBridgeAction(tabId);
  try {
    return await chrome.tabs.sendMessage(tabId, { action: 'autofill', approved: true });
  } catch {
    return { success: false, error: 'This page does not expose an application form.' };
  }
}
// MESSAGE HANDLING
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!globalThis.TayariMessagePolicy?.isAuthorized(request, sender, chrome.runtime.id)) {
    sendResponse({ success: false, error: "Unauthorized extension message sender." });
    return false;
  }
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

      case 'omnisave_preferences_get': {
        sendResponse({ success: true, preferences: await getOmniSavePreferences() });
        break;
      }
      case 'omnisave_preferences_set': {
        sendResponse({ success: true, preferences: await saveOmniSavePreferences(request.preferences || {}) });
        break;
      }
      case 'omnisave_sync_now': {
        try {
          sendResponse(await collectOmniSaveSources(true));
        } catch (error) {
          sendResponse({ success: false, error: error.message || 'OmniSaveAI sync failed.' });
        }
        break;
      }
      case 'answer_approved_page': {
        try { sendResponse(await answerApprovedPageTask(request)); } catch (error) { sendResponse({ success: false, error: error.message || 'Read-only answer failed.' }); }
        break;
      }
      case 'get_agent_task_status': {
        try {
          const task = await taskMutation(request.taskId, '', { method: 'GET' });
          sendResponse({ success: true, task });
        } catch (error) { sendResponse({ success: false, error: error.message }); }
        break;
      }
      case 'get_agent_task_artifacts': {
        try {
          const result = await taskMutation(request.taskId, '/artifacts', { method: 'GET' });
          sendResponse({ success: true, artifacts: Array.isArray(result?.artifacts) ? result.artifacts : [] });
        } catch (error) { sendResponse({ success: false, error: error.message }); }
        break;
      }
      case 'approve_agent_plan': {
        try { sendResponse({ success: true, task: await taskMutation(request.taskId, '/plan/approve') }); } catch (error) { sendResponse({ success: false, error: error.message }); }
        break;
      }
      case 'reject_agent_plan': {
        try { sendResponse({ success: true, task: await taskMutation(request.taskId, '/plan/reject') }); } catch (error) { sendResponse({ success: false, error: error.message }); }
        break;
      }
      case 'takeover_agent_task': {
        try { sendResponse({ success: true, task: await taskMutation(request.taskId, '/takeover') }); } catch (error) { sendResponse({ success: false, error: error.message }); }
        break;
      }
      case 'stop_agent_task': {
        try { sendResponse({ success: true, task: await taskMutation(request.taskId, '/stop') }); } catch (error) { sendResponse({ success: false, error: error.message }); }
        break;
      }
      case 'get_page_context': {
        const context = await getPageSnapshot(request.tabId || (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id);
        sendResponse({ success: Boolean(context), context });
        break;
      }
      case 'research_tabs': {
        sendResponse({ success: true, tabs: await getOpenTabContexts() });
        break;
      }
      case 'create_agent_task': {
        try { sendResponse(await createAgentTask(request)); } catch (error) { sendResponse({ success: false, error: error.message || 'Task creation failed.' }); }
        break;
      }
      case 'save_research_note': {
        sendResponse({ success: true, note: await saveResearchNote(request.note || {}) });
        break;
      }
      case 'clear_research_notes': {
        sendResponse({ success: await clearResearchNotes() });
        break;
      }
      case 'list_research_notes': {
        sendResponse({ success: true, notes: await listResearchNotes() });
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
      
      case 'computer_bridge_connect': {
        try { sendResponse(await connectComputerBridge()); } catch (error) { sendResponse({ success: false, error: error.message || 'Browser bridge connection failed.' }); }
        break;
      }
      case 'computer_bridge_status': {
        try { sendResponse(await computerBridgeStatus()); } catch (error) { sendResponse({ connected: false, error: error.message || 'Browser bridge status failed.' }); }
        break;
      }
      case 'computer_bridge_observe': {
        try { sendResponse(await observeComputerBridge()); } catch (error) { sendResponse({ success: false, error: error.message || 'Browser bridge observation failed.' }); }
        break;
      }
      case 'computer_bridge_revoke': {
        try { sendResponse(await revokeComputerBridge()); } catch (error) { sendResponse({ success: false, error: error.message || 'Browser bridge revoke failed.' }); }
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
        lastProfileFetchFailed = false;
        const profile = await getProfileData();
        sendResponse({ profile, stale: lastProfileFetchFailed && !!profile });
        break;
      }

      case 'refresh_profile': {
        await invalidateProfileCache();
        lastProfileFetchFailed = false;
        const profile = await getProfileData();
        sendResponse({ profile, stale: lastProfileFetchFailed && !!profile });
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
  if (request.action === 'extension_session_handoff') {
    const code = typeof request.code === 'string' ? request.code.trim() : '';
    if (!/^[a-f0-9]{64}$/i.test(code)) {
      sendResponse({ success: false, error: 'Invalid extension handoff code.' });
      return false;
    }
    (async () => {
      try {
        const config = await getConfig();
        const response = await fetch(`${String(config.apiUrl).replace(/\/$/, '')}/v1/auth/extension/handoff/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const session = await response.json().catch(() => ({}));
        if (!response.ok || !session?.access_token) {
          sendResponse({ success: false, error: session?.error || 'Extension handoff failed.' });
          return;
        }
        const stored = await TayariSession.write(session);
        sendResponse({ success: true, expires_at: stored?.expires_at || null, user: stored?.user || null });
      } catch (error) {
        sendResponse({ success: false, error: error?.message || 'Extension handoff failed.' });
      }
    })();
    return true;
  }
  if (request.action === 'clear_token') {
    void TayariOAuth.signOut(getConfig()).then(() => invalidateProfileCache());
    sendResponse({ success: true });
    return false;
  }
  if (request.action === 'get_version') {
    sendResponse({ version: '3.2.0', features: ['pkce_auth', 'job_detection', 'approval_gated_autofill', 'native_bridge', 'omnisave_auto_capture', 'omnisave_full_history', 'omnisave_export', 'retry_resume'] });
    return false;
  }
  // Frontend OmniSaveAI control plane: only the policy's WEB_APP_ACTIONS may be
  // invoked by the web app, and only from TRUSTED_APP_ORIGINS (checked above).
  if (request.action === 'omnisave_preferences_get' || request.action === 'omnisave_preferences_set' || request.action === 'omnisave_sync_now') {
    (async () => {
      try {
        if (request.action === 'omnisave_preferences_get') {
          sendResponse({ success: true, preferences: await getOmniSavePreferences() });
        } else if (request.action === 'omnisave_preferences_set') {
          sendResponse({ success: true, preferences: await saveOmniSavePreferences(request.preferences || {}) });
        } else {
          sendResponse(await collectOmniSaveSources(true));
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message || 'OmniSaveAI sync failed.' });
      }
    })();
    return true;
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
      // ponytail: the two sibling failure branches above (job not detected,
      // save rejected) both notify the user; this path used to only log to
      // the console, so a user clicking "Save Job to Tayari" on a page with
      // no content script injected (or any other thrown error) saw nothing
      // happen at all, with no indication the click didn't work.
      console.error('Context menu save failed', e);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Failed to Save Job',
        message: 'Could not save this job. Try reloading the page and saving again.'
      });
    }
  }
});

// ============================================================
// ALARMS (periodic tasks)
// ============================================================

chrome.alarms.create('refresh-profile-cache', { periodInMinutes: 5 });
void scheduleOmniSaveSync();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refresh-profile-cache') {
    const config = await getConfig();
    if (config.token) {
      await getProfileData(); // Refresh cache
    }
  } else if (alarm.name === OMNISAVE_ALARM) {
    try { await collectOmniSaveSources(false); } catch (error) { console.warn('Tayari: OmniSaveAI automatic sync failed', error); }
  }
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.removeAll().then(() => chrome.contextMenus.create({ id: 'tayari-explain-selection', title: 'Ask Job Tayari about this selection', contexts: ['selection'] })).catch(() => {});
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'tayari-explain-selection' || !tab?.id || !info.selectionText) return;
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  chrome.runtime.sendMessage({ action: 'selection_context', text: info.selectionText, tabId: tab.id }).catch(() => {});
});
chrome.tabs.onActivated.addListener(({ tabId }) => chrome.runtime.sendMessage({ action: 'context_changed', tabId }).catch(() => {}));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => { if (changeInfo.status === 'complete') chrome.runtime.sendMessage({ action: 'context_changed', tabId }).catch(() => {}); });
