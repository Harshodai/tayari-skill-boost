import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../../messagePolicy.js', import.meta.url), 'utf8');
const context = { globalThis: {}, URL };
vm.runInNewContext(source, context, { filename: 'messagePolicy.js' });
const policy = context.globalThis.TayariMessagePolicy;
const extensionId = 'abcdefghijklmnopabcdefghijklmnop';

const extensionPage = { id: extensionId, url: `chrome-extension://${extensionId}/sidepanel.html` };
const contentScript = { id: extensionId, url: 'https://www.linkedin.com/jobs/view/123', tab: { id: 7 } };
const foreignExtension = { id: 'foreign-extension-id', url: `chrome-extension://${extensionId}/sidepanel.html` };

for (const action of ['native_request', 'omnisave_sync_now', 'answer_approved_page', 'approve_agent_plan', 'reject_agent_plan', 'takeover_agent_task', 'stop_agent_task']) {
  test(`denies ${action} from a content script`, () => {
    assert.equal(policy.isAuthorized({ action }, contentScript, extensionId), false);
  });
}

test('allows sensitive actions from the extension side panel', () => {
  assert.equal(policy.isAuthorized({ action: 'answer_approved_page' }, extensionPage, extensionId), true);
  assert.equal(policy.isAuthorized({ action: 'native_request' }, extensionPage, extensionId), true);
});

test('allows only legacy page UI actions from a content script', () => {
  assert.equal(policy.isAuthorized({ action: 'save_job' }, contentScript, extensionId), true);
  assert.equal(policy.isAuthorized({ action: 'queue_for_review' }, contentScript, extensionId), true);
  assert.equal(policy.isAuthorized({ action: 'create_agent_task' }, contentScript, extensionId), false);
});

test('denies messages from another extension', () => {
  assert.equal(policy.isAuthorized({ action: 'session_status' }, foreignExtension, extensionId), false);
});

test('allows service-worker internal messages with the extension id', () => {
  assert.equal(policy.isAuthorized({ action: 'native_status' }, { id: extensionId }, extensionId), true);
});

test('denies legacy content-script actions from an unapproved origin', () => {
  assert.equal(policy.isAuthorized({ action: 'save_job' }, { id: extensionId, url: 'https://attacker.example', tab: { id: 7 } }, extensionId), false);
});

const webApp = { id: 'someone-else', url: 'http://localhost:5173/omnisave' };
const attackerPage = { id: 'someone-else', url: 'https://attacker.example/omnisave' };

test('allows WEB_APP_ACTIONS from a trusted frontend origin without an extension id', () => {
  for (const action of ['get_version', 'omnisave_preferences_get', 'omnisave_preferences_set', 'omnisave_sync_now']) {
    assert.equal(policy.isAuthorized({ action }, webApp, extensionId), true);
  }
});

test('denies content-script actions from a trusted frontend origin', () => {
  for (const action of ['save_job', 'get_profile_data', 'queue_for_review', 'answer_approved_page', 'native_request']) {
    assert.equal(policy.isAuthorized({ action }, webApp, extensionId), false);
  }
});

test('denies web-app actions from an untrusted origin', () => {
  assert.equal(policy.isAuthorized({ action: 'omnisave_preferences_get' }, attackerPage, extensionId), false);
  assert.equal(policy.isAuthorized({ action: 'omnisave_sync_now' }, { id: 'someone-else', url: 'https://tayari.app.evil.example/x' }, extensionId), false);
});

test('denies web-app actions when the sender has no URL', () => {
  assert.equal(policy.isAuthorized({ action: 'omnisave_preferences_get' }, { id: 'someone-else' }, extensionId), false);
});
