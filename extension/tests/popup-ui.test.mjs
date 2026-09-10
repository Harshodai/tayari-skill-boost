import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const popupScriptSource = fs.readFileSync(new URL('../popup.js', import.meta.url), 'utf8');

function createMockElement(id = '', tagName = 'div') {
  const classes = new Set();
  const listeners = new Map();
  const children = [];

  return {
    id,
    tagName: tagName.toUpperCase(),
    value: '',
    textContent: '',
    innerHTML: '',
    disabled: false,
    className: '',
    classList: {
      add: (cls) => classes.add(cls),
      remove: (cls) => classes.delete(cls),
      contains: (cls) => classes.has(cls),
      toggle: (cls) => (classes.has(cls) ? classes.delete(cls) : classes.add(cls)),
    },
    style: {},
    appendChild: (child) => { children.push(child); return child; },
    addEventListener: (event, fn) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    click: async () => {
      const fns = listeners.get('click') || [];
      for (const fn of fns) await fn();
    },
    _classes: classes,
    _children: children,
    _listeners: listeners,
  };
}

function setupPopupEnv({ runtimeMessages = {}, tabMessages = {}, statsResponse = { saved_jobs: 3, applied: 1, interviews: 0, review_queue_count: 2 } } = {}) {
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) {
      elements.set(id, createMockElement(id));
    }
    return elements.get(id);
  };

  // Pre-create known UI IDs
  const knownIds = [
    'not-authenticated', 'job-detected', 'application-detected', 'no-job', 'authenticated',
    'auth-status', 'detected-title', 'detected-company', 'detected-location', 'detected-platform',
    'app-form-job', 'stat-saved', 'stat-applied', 'stat-interviews', 'quick-saved', 'quick-applied',
    'quick-interviews', 'quick-review', 'stage-selector', 'btn-save', 'btn-ats', 'btn-queue-review',
    'btn-optimize', 'btn-cover-letter', 'btn-autofill', 'btn-track-app', 'btn-queue-review-app',
    'btn-refresh-profile', 'btn-save-settings', 'btn-open-tayari', 'btn-create-account',
    'ats-results', 'ats-score-value', 'ats-summary', 'ats-matched', 'ats-missing',
    'autofill-status', 'api-url', 'message'
  ];
  knownIds.forEach(getEl);

  const runtimeCalls = [];
  const tabCalls = [];
  const domListeners = new Map();

  const defaultRuntime = {
    get_config: () => ({ token: 'mock-token', apiUrl: 'https://api.tayari.app/api' }),
    ...runtimeMessages,
  };

  const context = {
    console,
    URL,
    encodeURIComponent,
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {},
    document: {
      getElementById: (id) => getEl(id),
      querySelectorAll: () => [],
      createElement: (tag) => createMockElement('', tag),
      addEventListener: (evt, fn) => {
        if (!domListeners.has(evt)) domListeners.set(evt, []);
        domListeners.get(evt).push(fn);
      }
    },
    chrome: {
      tabs: {
        query: async () => [{ id: 101, url: 'https://www.linkedin.com/jobs/view/999' }],
        sendMessage: async (tabId, message) => {
          tabCalls.push({ tabId, message });
          if (tabMessages[message.action]) {
            return tabMessages[message.action](message);
          }
          return { success: true };
        }
      },
      runtime: {
        sendMessage: (msg, callback) => {
          runtimeCalls.push(msg);
          let response = { success: true };
          if (defaultRuntime[msg.action]) {
            response = defaultRuntime[msg.action](msg);
          }
          if (typeof callback === 'function') callback(response);
          return Promise.resolve(response);
        }
      }
    },
    TayariSession: {
      fetchJson: async () => ({
        ok: true,
        json: async () => statsResponse
      })
    }
  };
  context.globalThis = context;

  vm.runInNewContext(popupScriptSource, context, { filename: 'popup.js' });

  const initPopup = async () => {
    const fns = domListeners.get('DOMContentLoaded') || [];
    for (const fn of fns) await fn();
  };

  return {
    context,
    getEl,
    runtimeCalls,
    tabCalls,
    domListeners,
    initPopup
  };
}

test('showState toggles panel visibility and updates auth badge for each state', () => {
  const { context, getEl } = setupPopupEnv();

  // Test not_authenticated
  context.showState('not_authenticated');
  assert.equal(getEl('not-authenticated')._classes.has('hidden'), false);
  assert.equal(getEl('job-detected')._classes.has('hidden'), true);
  assert.equal(getEl('authenticated')._classes.has('hidden'), true);
  assert.match(getEl('auth-status').textContent, /Sign in required/);

  // Test job_detected
  context.showState('job_detected');
  assert.equal(getEl('authenticated')._classes.has('hidden'), false);
  assert.equal(getEl('job-detected')._classes.has('hidden'), false);
  assert.equal(getEl('not-authenticated')._classes.has('hidden'), true);
  assert.match(getEl('auth-status').textContent, /Signed in/);

  // Test application_detected
  context.showState('application_detected');
  assert.equal(getEl('authenticated')._classes.has('hidden'), false);
  assert.equal(getEl('application-detected')._classes.has('hidden'), false);

  // Test no_job
  context.showState('no_job');
  assert.equal(getEl('authenticated')._classes.has('hidden'), false);
  assert.equal(getEl('no-job')._classes.has('hidden'), false);
});

test('loadJobInfo populates detected job card fields', async () => {
  const { context, getEl, tabCalls } = setupPopupEnv({
    tabMessages: {
      detect_job: () => ({
        detected: true,
        title: 'Principal Systems Architect',
        company: 'Cloudflare',
        location: 'Austin, TX',
        platform: 'Greenhouse'
      })
    }
  });

  await context.loadJobInfo(101);
  assert.equal(tabCalls.length, 1);
  assert.equal(tabCalls[0].message.action, 'detect_job');
  assert.equal(getEl('detected-title').textContent, 'Principal Systems Architect');
  assert.equal(getEl('detected-company').textContent, 'Cloudflare');
  assert.equal(getEl('detected-location').textContent, 'Austin, TX');
  assert.equal(getEl('detected-platform').textContent, 'Greenhouse');
});

test('loadApplicationInfo populates application form job text', async () => {
  const { context, getEl } = setupPopupEnv({
    tabMessages: {
      detect_job: () => ({
        detected: true,
        title: 'Backend Engineer',
        company: 'GitHub'
      })
    }
  });

  await context.loadApplicationInfo(101);
  assert.equal(getEl('app-form-job').textContent, 'Backend Engineer at GitHub');
});

test('loadStats fetches stats and updates dashboard counters', async () => {
  const { context, getEl } = setupPopupEnv({
    statsResponse: { saved_jobs: 12, applied: 7, interviews: 3, review_queue_count: 5 }
  });

  await context.loadStats();
  assert.equal(getEl('stat-saved').textContent, 12);
  assert.equal(getEl('stat-applied').textContent, 7);
  assert.equal(getEl('stat-interviews').textContent, 3);
  assert.equal(getEl('quick-review').textContent, 5);
});

test('showMessage sets banner text and severity style', () => {
  const { context, getEl } = setupPopupEnv();

  context.showMessage('Application submitted successfully!', 'success');
  const msgEl = getEl('message');
  assert.equal(msgEl.textContent, 'Application submitted successfully!');
  assert.match(msgEl.className, /success/);
});

test('Save button sends save_job with selected pipeline stage', async () => {
  let savedPayload = null;
  const { getEl, initPopup } = setupPopupEnv({
    tabMessages: {
      detect_job: () => ({
        detected: true,
        title: 'Staff Engineer',
        company: 'Stripe',
        platform: 'lever'
      })
    },
    runtimeMessages: {
      save_job: (msg) => {
        savedPayload = msg;
        return { success: true };
      }
    }
  });

  await initPopup();
  getEl('stage-selector').value = 'interview';

  await getEl('btn-save').click();

  assert.ok(savedPayload);
  assert.equal(savedPayload.title, 'Staff Engineer');
  assert.equal(savedPayload.company, 'Stripe');
  assert.equal(savedPayload.stage, 'interview');
});

test('Instant ATS check shows error when description is too short', async () => {
  const { getEl, initPopup } = setupPopupEnv({
    tabMessages: {
      detect_job: () => ({ detected: true, description: 'Too short' })
    }
  });

  await initPopup();

  await getEl('btn-ats').click();
  const msg = getEl('message');
  assert.match(msg.textContent, /Couldn't read job description/);
});

test('Instant ATS check executes analysis and renders score and keyword pills', async () => {
  const { getEl, initPopup } = setupPopupEnv({
    tabMessages: {
      detect_job: () => ({
        detected: true,
        description: 'We are seeking a senior engineer with deep experience in Go, Docker, distributed systems, and PostgreSQL.'
      })
    },
    runtimeMessages: {
      quick_ats: () => ({
        success: true,
        result: {
          overall_score: 88,
          summary: 'Strong match for systems experience.',
          matched_keywords: ['Go', 'Docker', 'PostgreSQL'],
          missing_keywords: ['Kubernetes']
        }
      })
    }
  });

  await initPopup();

  await getEl('btn-ats').click();

  assert.equal(getEl('ats-score-value').textContent, 88);
  assert.equal(getEl('ats-summary').textContent, 'Strong match for systems experience.');
  assert.equal(getEl('ats-results')._classes.has('hidden'), false);
  assert.equal(getEl('ats-matched')._children.length, 3);
  assert.equal(getEl('ats-missing')._children.length, 1);
});

test('Autofill button sends approved autofill request to tab and updates status banner', async () => {
  let sentApproved = null;
  const { getEl, initPopup } = setupPopupEnv({
    tabMessages: {
      autofill: (req) => {
        sentApproved = req.approved;
        return { success: true, filled: 6 };
      }
    }
  });

  await initPopup();

  await getEl('btn-autofill').click();

  assert.equal(sentApproved, true);
  assert.equal(getEl('autofill-status').textContent, '✅ Filled 6 field(s)');
  assert.match(getEl('autofill-status').className, /success/);
});

test('Settings save button updates CONFIG and persists via save_config message', async () => {
  let persistedConfig = null;
  const { context, getEl } = setupPopupEnv({
    runtimeMessages: {
      save_config: (msg) => {
        persistedConfig = msg.config;
        return { success: true };
      }
    }
  });

  context.setupEventListeners();
  getEl('api-url').value = 'https://custom-api.tayari.app';

  await getEl('btn-save-settings').click();

  assert.ok(persistedConfig);
  assert.equal(persistedConfig.apiUrl, 'https://custom-api.tayari.app');
  assert.match(getEl('message').textContent, /Settings saved/);
});
