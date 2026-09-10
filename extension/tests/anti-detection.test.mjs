import test from 'node:test';
import assert from 'node:assert/strict';

test('anti-detection: masks automation indicators and provides jitter helper', async () => {
  // In Node 22, navigator exists on globalThis. Define mock properties if needed.
  try {
    Object.defineProperty(globalThis.navigator, 'webdriver', {
      value: true,
      configurable: true,
      writable: true,
    });
  } catch (e) {}

  globalThis.window = {
    navigator: globalThis.navigator,
    addEventListener: () => {},
  };
  globalThis.document = {
    title: 'Test Job',
    body: { innerText: '' },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  globalThis.location = {
    href: 'https://jobs.lever.co/company/job-123',
    origin: 'https://jobs.lever.co',
  };

  // Import content.js
  await import('../content.js');

  const content = globalThis.__TAYARI_CONTENT__;
  assert.ok(content, '__TAYARI_CONTENT__ should be exposed');

  // Verify navigator.webdriver is undefined
  assert.strictEqual(globalThis.navigator.webdriver, undefined, 'webdriver flag must be masked');

  // Verify getHumanJitterDelay
  assert.strictEqual(typeof content.getHumanJitterDelay, 'function');
  const delay = content.getHumanJitterDelay(20, 50);
  assert.ok(delay >= 20 && delay <= 50, `delay ${delay} should be between 20 and 50`);
});
