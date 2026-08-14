const assert = require("node:assert/strict");
const test = require("node:test");
const {
  SECURITY_CSP,
  assertSettingsPayload,
  hostMatchesAllowlist,
  normalizeApiBaseUrl,
  validateExternalUrl,
} = require("./security.cjs");

test("development API accepts only loopback gateway URLs", () => {
  assert.equal(normalizeApiBaseUrl("http://127.0.0.1:8085/api", true), "http://127.0.0.1:8085/api");
  assert.throws(() => normalizeApiBaseUrl("http://localhost:8085/api", true));
  assert.throws(() => normalizeApiBaseUrl("https://api.tayari.app/api", true));
});

test("packaged API requires HTTPS and rejects loopback defaults", () => {
  assert.equal(normalizeApiBaseUrl("https://api.tayari.app/api", false), "https://api.tayari.app/api");
  assert.throws(() => normalizeApiBaseUrl("http://127.0.0.1:8085/api", false));
  assert.throws(() => normalizeApiBaseUrl("https://api.tayari.app/v1", false));
});

test("external navigation is HTTPS and host allowlisted", () => {
  assert.equal(validateExternalUrl("https://www.linkedin.com/jobs/view/123"), "https://www.linkedin.com/jobs/view/123");
  assert.equal(hostMatchesAllowlist("jobs.lever.co"), true);
  assert.equal(hostMatchesAllowlist("evil-lever.co"), false);
  assert.throws(() => validateExternalUrl("http://www.linkedin.com/jobs/view/123"));
  assert.throws(() => validateExternalUrl("https://evil.example/"));
  assert.throws(() => validateExternalUrl("javascript:alert(1)"));
});

test("settings payload schema rejects unknown keys and arrays", () => {
  assert.deepEqual(assertSettingsPayload({ apiBaseUrl: "https://api.tayari.app/api" }), {
    apiBaseUrl: "https://api.tayari.app/api",
  });
  assert.throws(() => assertSettingsPayload({ apiBaseUrl: "https://api.tayari.app/api", command: "docker" }));
  assert.throws(() => assertSettingsPayload(["https://api.tayari.app/api"]));
});

test("CSP is deny-by-default and blocks framing and plugins", () => {
  assert.match(SECURITY_CSP, /default-src 'self'/);
  assert.match(SECURITY_CSP, /object-src 'none'/);
  assert.match(SECURITY_CSP, /frame-ancestors 'none'/);
  assert.match(SECURITY_CSP, /script-src 'self'/);
});
