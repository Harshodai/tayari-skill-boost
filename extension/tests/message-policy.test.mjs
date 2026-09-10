import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const messagePolicySource = fs.readFileSync(new URL('../messagePolicy.js', import.meta.url), 'utf8');

function setupPolicyEnv() {
  const context = {
    console,
    URL,
    Set,
    process: { env: { NODE_ENV: 'test' } },
  };
  context.globalThis = context;

  vm.runInNewContext(messagePolicySource, context, { filename: 'messagePolicy.js' });
  const policy = context.globalThis.TayariMessagePolicy;
  assert.ok(policy, 'messagePolicy.js must export TayariMessagePolicy');

  return { policy };
}

const extensionId = 'test-extension-id-1234567890';
const extensionPageSender = { id: extensionId, url: `chrome-extension://${extensionId}/sidepanel.html` };
const serviceWorkerSender = { id: extensionId };
const contentScriptSender = { id: extensionId, url: 'https://www.linkedin.com/jobs/view/123456', tab: { id: 7 } };
const greenhouseScriptSender = { id: extensionId, url: 'https://boards.greenhouse.io/sourcegraph/jobs/1', tab: { id: 8 } };
const untrustedHostSender = { id: extensionId, url: 'https://attacker.site/jobs', tab: { id: 9 } };
const webAppSender = { url: 'https://tayari.app/dashboard' };
const webAppLoopbackSender = { url: 'http://127.0.0.1:5173/dashboard' };
const untrustedWebSender = { url: 'https://evil-tayari.app/dashboard' };
const foreignExtensionSender = { id: 'foreign-extension-xyz', url: `chrome-extension://${extensionId}/sidepanel.html` };

test('CONTENT_SCRIPT_ACTIONS allowlist contains only safe UI/bridge actions', () => {
  const { policy } = setupPolicyEnv();
  const allowed = policy.CONTENT_SCRIPT_ACTIONS;

  assert.ok(allowed.has('save_job'));
  assert.ok(allowed.has('get_profile_data'));
  assert.ok(allowed.has('quick_ats'));
  assert.ok(allowed.has('track_application'));
  assert.ok(allowed.has('queue_for_review'));
  assert.ok(allowed.has('open_tayari'));

  // Ensure high-risk actions are explicitly excluded
  assert.equal(allowed.has('native_request'), false);
  assert.equal(allowed.has('create_agent_task'), false);
  assert.equal(allowed.has('approve_agent_plan'), false);
  assert.equal(allowed.has('stop_agent_task'), false);
  assert.equal(allowed.has('takeover_agent_task'), false);
  assert.equal(allowed.has('omnisave_sync_now'), false);
});

test('WEB_APP_ACTIONS allowlist contains only safe sync and preferences actions', () => {
  const { policy } = setupPolicyEnv();
  const webActions = policy.WEB_APP_ACTIONS;

  assert.ok(webActions.has('get_version'));
  assert.ok(webActions.has('omnisave_preferences_get'));
  assert.ok(webActions.has('omnisave_preferences_set'));
  assert.ok(webActions.has('omnisave_sync_now'));
  assert.ok(webActions.has('extension_session_handoff'));

  // Ensure content-script actions are not in web app action set
  assert.equal(webActions.has('save_job'), false);
  assert.equal(webActions.has('get_profile_data'), false);
  assert.equal(webActions.has('track_application'), false);
});

test('isAllowedContentScriptUrl validates HTTPS protocol and approved host list', () => {
  const { policy } = setupPolicyEnv();

  assert.equal(policy.isAllowedContentScriptUrl('https://www.linkedin.com/jobs/view/123'), true);
  assert.equal(policy.isAllowedContentScriptUrl('https://boards.greenhouse.io/acme/jobs'), true);
  assert.equal(policy.isAllowedContentScriptUrl('https://jobs.lever.co/company'), true);
  assert.equal(policy.isAllowedContentScriptUrl('https://company.workday.com/en-US/apply'), true);
  assert.equal(policy.isAllowedContentScriptUrl('https://jobs.ashbyhq.com/org'), true);
  assert.equal(policy.isAllowedContentScriptUrl('https://indeed.com/viewjob?jk=1'), true);

  // Insecure HTTP is rejected
  assert.equal(policy.isAllowedContentScriptUrl('http://www.linkedin.com/jobs/view/123'), false);
  // Untrusted domain is rejected
  assert.equal(policy.isAllowedContentScriptUrl('https://malicious-job-board.com/post'), false);
  // Malformed URL is rejected
  assert.equal(policy.isAllowedContentScriptUrl('not-a-valid-url'), false);
});

test('isExtensionUrl verifies URL matches extension protocol and ID prefix', () => {
  const { policy } = setupPolicyEnv();

  assert.equal(policy.isExtensionUrl(`chrome-extension://${extensionId}/sidepanel.html`, extensionId), true);
  assert.equal(policy.isExtensionUrl(`chrome-extension://${extensionId}/`, extensionId), true);
  assert.equal(policy.isExtensionUrl(`chrome-extension://other-id/sidepanel.html`, extensionId), false);
  assert.equal(policy.isExtensionUrl('https://tayari.app/sidepanel.html', extensionId), false);
});

test('isTrustedAppOrigin validates production and dev loopback origins', () => {
  const { policy } = setupPolicyEnv();

  assert.equal(policy.isTrustedAppOrigin('https://tayari.app/home'), true);
  assert.equal(policy.isTrustedAppOrigin('https://www.tayari.app/home'), true);
  assert.equal(policy.isTrustedAppOrigin('https://tayari-skill-boost.lovable.app/app'), true);
  assert.equal(policy.isTrustedAppOrigin('http://127.0.0.1:5173/app'), true);
  assert.equal(policy.isTrustedAppOrigin('http://localhost:5173/app'), true);

  assert.equal(policy.isTrustedAppOrigin('https://evil-tayari.app'), false);
  assert.equal(policy.isTrustedAppOrigin('https://attacker.com'), false);
  assert.equal(policy.isTrustedAppOrigin(''), false);
});

test('isAuthorized allows CONTENT_SCRIPT_ACTIONS from verified ATS content scripts', () => {
  const { policy } = setupPolicyEnv();

  assert.equal(policy.isAuthorized({ action: 'save_job' }, contentScriptSender, extensionId), true);
  assert.equal(policy.isAuthorized({ action: 'get_profile_data' }, greenhouseScriptSender, extensionId), true);
  assert.equal(policy.isAuthorized({ action: 'quick_ats' }, contentScriptSender, extensionId), true);
  assert.equal(policy.isAuthorized({ action: 'track_application' }, greenhouseScriptSender, extensionId), true);
});

test('isAuthorized blocks high-risk actions originating from content scripts', () => {
  const { policy } = setupPolicyEnv();

  const blockedActions = [
    'native_request',
    'create_agent_task',
    'approve_agent_plan',
    'reject_agent_plan',
    'takeover_agent_task',
    'stop_agent_task',
    'omnisave_sync_now',
    'answer_approved_page',
  ];

  for (const action of blockedActions) {
    assert.equal(
      policy.isAuthorized({ action }, contentScriptSender, extensionId),
      false,
      `Action ${action} should be blocked from content script`
    );
  }
});

test('isAuthorized rejects content script actions from untrusted origins', () => {
  const { policy } = setupPolicyEnv();

  assert.equal(policy.isAuthorized({ action: 'save_job' }, untrustedHostSender, extensionId), false);
  assert.equal(policy.isAuthorized({ action: 'get_profile_data' }, untrustedHostSender, extensionId), false);
});

test('isAuthorized allows WEB_APP_ACTIONS from verified web app origins', () => {
  const { policy } = setupPolicyEnv();

  assert.equal(policy.isAuthorized({ action: 'get_version' }, webAppSender, extensionId), true);
  assert.equal(policy.isAuthorized({ action: 'omnisave_sync_now' }, webAppSender, extensionId), true);
  assert.equal(policy.isAuthorized({ action: 'extension_session_handoff' }, webAppLoopbackSender, extensionId), true);
});

test('isAuthorized denies content script actions requested from web app origins', () => {
  const { policy } = setupPolicyEnv();

  assert.equal(policy.isAuthorized({ action: 'save_job' }, webAppSender, extensionId), false);
  assert.equal(policy.isAuthorized({ action: 'get_profile_data' }, webAppSender, extensionId), false);
});

test('isAuthorized denies all requests from untrusted web origins or foreign extensions', () => {
  const { policy } = setupPolicyEnv();

  assert.equal(policy.isAuthorized({ action: 'get_version' }, untrustedWebSender, extensionId), false);
  assert.equal(policy.isAuthorized({ action: 'save_job' }, untrustedWebSender, extensionId), false);
  assert.equal(policy.isAuthorized({ action: 'session_status' }, foreignExtensionSender, extensionId), false);
});

test('isAuthorized permits trusted extension page and background worker actions', () => {
  const { policy } = setupPolicyEnv();

  // Extension pages (sidepanel) can perform sensitive operations
  assert.equal(policy.isAuthorized({ action: 'native_request' }, extensionPageSender, extensionId), true);
  assert.equal(policy.isAuthorized({ action: 'answer_approved_page' }, extensionPageSender, extensionId), true);

  // Background worker internal message (no tab)
  assert.equal(policy.isAuthorized({ action: 'native_status' }, serviceWorkerSender, extensionId), true);
});

test('isAuthorized rejects requests missing action or sender', () => {
  const { policy } = setupPolicyEnv();

  assert.equal(policy.isAuthorized(null, contentScriptSender, extensionId), false);
  assert.equal(policy.isAuthorized({}, contentScriptSender, extensionId), false);
  assert.equal(policy.isAuthorized({ action: 'save_job' }, null, extensionId), false);
});
