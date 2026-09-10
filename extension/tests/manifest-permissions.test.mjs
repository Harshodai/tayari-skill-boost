import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const manifestPath = new URL('../manifest.json', import.meta.url);
const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestRaw);

test('manifest.json parses successfully and specifies manifest_version 3', () => {
  assert.ok(manifest, 'manifest must be valid JSON');
  assert.equal(manifest.manifest_version, 3, 'Must use Manifest V3');
});

test('manifest contains required identity fields (name, version, description)', () => {
  assert.ok(typeof manifest.name === 'string' && manifest.name.length > 0);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, 'Version must follow semver format');
  assert.ok(typeof manifest.description === 'string' && manifest.description.length > 10);
});

test('background configuration uses service_worker pointing to background.js', () => {
  assert.ok(manifest.background, 'Background object must be defined');
  assert.equal(manifest.background.service_worker, 'background.js');
});

test('action defines default icons and a descriptive title', () => {
  assert.ok(manifest.action, 'Action must be defined in Manifest V3');
  assert.ok(manifest.action.default_icon['16'], 'Icon 16 is required');
  assert.ok(manifest.action.default_icon['48'], 'Icon 48 is required');
  assert.ok(manifest.action.default_icon['128'], 'Icon 128 is required');
  assert.match(manifest.action.default_title, /side panel|tayari/i);
});

test('permissions list includes all necessary extension capabilities', () => {
  const perms = new Set(manifest.permissions || []);
  const requiredPermissions = [
    'activeTab',
    'storage',
    'scripting',
    'tabs',
    'notifications',
    'sidePanel',
    'contextMenus',
    'alarms',
    'identity',
    'nativeMessaging',
  ];

  for (const perm of requiredPermissions) {
    assert.ok(perms.has(perm), `Missing required permission: ${perm}`);
  }
});

test('host_permissions covers required ATS job boards and platforms', () => {
  const hosts = manifest.host_permissions || [];
  const requiredHostPatterns = [
    'https://*.greenhouse.io/*',
    'https://*.workday.com/*',
    'https://*.lever.co/*',
    'https://*.ashbyhq.com/*',
    'https://www.linkedin.com/*',
    'https://*.indeed.com/*',
    'https://*.glassdoor.com/*',
    'https://*.smartrecruiters.com/*',
  ];

  for (const pattern of requiredHostPatterns) {
    assert.ok(hosts.includes(pattern), `Missing required ATS host pattern: ${pattern}`);
  }
});

test('host_permissions includes API endpoint and development origins', () => {
  const hosts = manifest.host_permissions || [];
  assert.ok(hosts.includes('https://api.tayari.app/*'));
  assert.ok(hosts.includes('https://tayari.app/*'));
  assert.ok(hosts.includes('http://127.0.0.1:5173/*'));
});

test('host_permissions includes Omnisave saved article sources', () => {
  const hosts = manifest.host_permissions || [];
  assert.ok(hosts.includes('https://medium.com/*'));
  assert.ok(hosts.includes('https://*.substack.com/*') || hosts.includes('https://substack.com/*'));
  assert.ok(hosts.includes('https://www.instagram.com/*'));
});

test('content_security_policy enforces strict MV3 rules (script-src self, object-src none)', () => {
  assert.ok(manifest.content_security_policy, 'CSP must be declared');
  const extensionPagesCsp = manifest.content_security_policy.extension_pages || '';
  assert.match(extensionPagesCsp, /script-src\s+'self'/);
  assert.match(extensionPagesCsp, /object-src\s+'none'/);
  assert.doesNotMatch(extensionPagesCsp, /'unsafe-eval'/, 'Must not allow unsafe-eval');
});

test('externally_connectable scopes external messages to trusted app domains and loopback ports', () => {
  assert.ok(manifest.externally_connectable, 'externally_connectable must be configured');
  const matches = manifest.externally_connectable.matches || [];

  assert.ok(matches.includes('https://tayari.app/*'));
  assert.ok(matches.includes('https://www.tayari.app/*'));
  assert.ok(matches.some((m) => m.includes('127.0.0.1:5173')));

  // Ensure no wildcards like *://*/*
  for (const pattern of matches) {
    assert.notEqual(pattern, '<all_urls>');
    assert.notEqual(pattern, '*://*/*');
  }
});

test('side_panel configuration specifies sidepanel.html', () => {
  assert.ok(manifest.side_panel, 'side_panel must be defined');
  assert.equal(manifest.side_panel.default_path, 'sidepanel.html');
});

test('content_scripts configures app_bridge.js, content.js, and omnisave_capture.js with proper scopes', () => {
  const scripts = manifest.content_scripts || [];
  assert.ok(scripts.length >= 3);

  const bridge = scripts.find((s) => s.js?.includes('app_bridge.js'));
  assert.ok(bridge);
  assert.equal(bridge.run_at, 'document_start');

  const content = scripts.find((s) => s.js?.includes('content.js'));
  assert.ok(content);
  assert.equal(content.run_at, 'document_idle');
  assert.equal(content.all_frames, true);

  const omnisave = scripts.find((s) => s.js?.includes('omnisave_capture.js'));
  assert.ok(omnisave);
  assert.equal(omnisave.run_at, 'document_idle');
});
