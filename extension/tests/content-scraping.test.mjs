import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const contentScriptSource = fs.readFileSync(new URL('../content.js', import.meta.url), 'utf8');

function setupScrapingEnv({ hostname = 'example.com', href = 'https://example.com/jobs/123', title = 'Software Engineer at Acme', bodyText = 'Acme is looking for a Software Engineer to join our team.', elements = {} } = {}) {
  const context = {
    console,
    URL,
    Event: class MockEvent { constructor(type) { this.type = type; } },
    HTMLInputElement: class {},
    HTMLTextAreaElement: class {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    window: {
      location: {
        href,
        hostname,
        pathname: new URL(href).pathname,
        origin: new URL(href).origin,
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      getSelection: () => ({ toString: () => '' }),
    },
    document: {
      title,
      readyState: 'loading',
      body: {
        innerText: bodyText,
        textContent: bodyText,
        appendChild: () => {},
      },
      createElement: () => ({
        style: {},
        classList: { add() {}, remove() {} },
        appendChild() {},
        setAttribute() {},
        addEventListener() {},
        remove() {},
      }),
      querySelector: (selector) => {
        if (elements[selector]) return elements[selector];
        for (const [key, el] of Object.entries(elements)) {
          if (selector === key || selector.includes(key)) return el;
        }
        return null;
      },
      querySelectorAll: (selector) => {
        const matches = [];
        for (const [key, el] of Object.entries(elements)) {
          if (selector.includes(key)) matches.push(el);
        }
        return matches;
      },
      getElementById: (id) => elements[`#${id}`] || null,
    },
    chrome: {
      runtime: {
        id: 'tayari-extension-test',
        onMessage: { addListener: () => {} },
      }
    }
  };
  context.globalThis = context;
  context.window.window = context.window;

  vm.runInNewContext(contentScriptSource, context, { filename: 'content.js' });
  const content = context.globalThis.__TAYARI_CONTENT__;
  assert.ok(content, 'content.js must expose __TAYARI_CONTENT__');

  return { content, context };
}

test('detectPlatform accurately identifies supported job boards and ATS platforms', () => {
  const platforms = [
    { hostname: 'www.linkedin.com', expected: 'linkedin' },
    { hostname: 'indeed.com', expected: 'indeed' },
    { hostname: 'jobs.glassdoor.com', expected: 'glassdoor' },
    { hostname: 'boards.greenhouse.io', expected: 'greenhouse' },
    { hostname: 'jobs.lever.co', expected: 'lever' },
    { hostname: 'mycompany.workday.com', expected: 'workday' },
    { hostname: 'mycompany.myworkdayjobs.com', expected: 'workday' },
    { hostname: 'jobs.ashbyhq.com', expected: 'ashby' },
    { hostname: 'careers.smartrecruiters.com', expected: 'smartrecruiters' },
    { hostname: 'acme.bamboohr.com', expected: 'bamboohr' },
    { hostname: 'randomcompany.com', expected: 'generic' },
  ];

  for (const { hostname, expected } of platforms) {
    const { content } = setupScrapingEnv({ hostname, href: `https://${hostname}/jobs/42` });
    assert.equal(content.detectPlatform(), expected, `Failed platform check for ${hostname}`);
  }
});

test('detectGreenhouseJob extracts job title, company, location, and description', () => {
  const elements = {
    '.app-title': { innerText: 'Staff Backend Engineer', textContent: 'Staff Backend Engineer' },
    '.company-name': { innerText: 'Sourcegraph', textContent: 'Sourcegraph' },
    '.location': { innerText: 'Remote, US', textContent: 'Remote, US' },
    '.content': { innerText: 'We are seeking a Staff Backend Engineer proficient in Go and Kubernetes.', textContent: 'We are seeking a Staff Backend Engineer proficient in Go and Kubernetes.' },
  };

  const { content } = setupScrapingEnv({
    hostname: 'boards.greenhouse.io',
    href: 'https://boards.greenhouse.io/sourcegraph/jobs/12345',
    elements,
  });

  const job = content.detectGreenhouseJob();
  assert.ok(job);
  assert.equal(job.detected, true);
  assert.equal(job.platform, 'greenhouse');
  assert.equal(job.title, 'Staff Backend Engineer');
  assert.equal(job.company, 'Sourcegraph');
  assert.equal(job.location, 'Remote, US');
  assert.match(job.description, /Staff Backend Engineer/);
});

test('detectLeverJob extracts title, company, location, and description', () => {
  const elements = {
    '.posting-headline h2': { innerText: 'Senior Full Stack Engineer', textContent: 'Senior Full Stack Engineer' },
    '.company-name': { innerText: 'Figma', textContent: 'Figma' },
    '.posting-categories span': { innerText: 'San Francisco, CA', textContent: 'San Francisco, CA' },
    '.posting-description': { innerText: 'Join Figma to build the future of collaborative design.', textContent: 'Join Figma to build the future of collaborative design.' },
  };

  const { content } = setupScrapingEnv({
    hostname: 'jobs.lever.co',
    href: 'https://jobs.lever.co/figma/abcdef',
    elements,
  });

  const job = content.detectLeverJob();
  assert.ok(job);
  assert.equal(job.detected, true);
  assert.equal(job.platform, 'lever');
  assert.equal(job.title, 'Senior Full Stack Engineer');
  assert.equal(job.company, 'Figma');
  assert.equal(job.location, 'San Francisco, CA');
  assert.match(job.description, /collaborative design/);
});

test('detectGenericJob heuristics extract title and company when title matches job keyword', () => {
  const elements = {
    'h1': { innerText: 'Principal AI Researcher' },
    '[class*="company" i]': { innerText: 'OpenAI' },
  };

  const { content } = setupScrapingEnv({
    hostname: 'openai.com',
    href: 'https://openai.com/careers/principal-ai-researcher',
    title: 'Principal AI Researcher | Careers at OpenAI',
    bodyText: 'OpenAI is an AI research and deployment company.',
    elements,
  });

  const job = content.detectGenericJob();
  assert.ok(job);
  assert.equal(job.detected, true);
  assert.equal(job.platform, 'generic');
  assert.equal(job.title, 'Principal AI Researcher');
  assert.equal(job.company, 'OpenAI');
});

test('detectGenericJob returns null when page title has no job keywords', () => {
  const { content } = setupScrapingEnv({
    hostname: 'store.example.com',
    href: 'https://store.example.com/cart',
    title: 'Your Shopping Cart - Checkout',
    bodyText: 'Cart is empty.',
  });

  const job = content.detectGenericJob();
  assert.equal(job, null);
});

test('isJobApplicationPage detects application intent via URL patterns', () => {
  const urls = [
    'https://jobs.lever.co/company/job-id/apply',
    'https://boards.greenhouse.io/company/jobs/123/application',
    'https://company.com/careers/submit',
    'https://myworkdayjobs.com/en-US/apply/job-12',
  ];

  for (const url of urls) {
    const { content } = setupScrapingEnv({
      hostname: new URL(url).hostname,
      href: url,
    });
    assert.equal(content.isJobApplicationPage(), true, `Failed for URL: ${url}`);
  }
});

test('isJobApplicationPage detects application form through multi-input heuristic', () => {
  const elements = {
    'input[type="file"]': { type: 'file' },
    'input[type="email"]': { type: 'email' },
    'textarea[name*="cover" i]': { name: 'cover_letter' },
    'button': { textContent: 'Submit Application' },
  };

  const { content, context } = setupScrapingEnv({
    hostname: 'custom-portal.org',
    href: 'https://custom-portal.org/job-post-77',
    elements,
  });

  context.document.querySelectorAll = (selector) => {
    if (selector.includes('button')) return [elements['button']];
    return [];
  };

  assert.equal(content.isJobApplicationPage(), true);
});

test('AUTOFILL_FIELD_MAP contains expected selector coverage for standard candidate fields', () => {
  const { content } = setupScrapingEnv();
  const map = content.AUTOFILL_FIELD_MAP;

  assert.ok(map.fullName?.selectors.length > 0);
  assert.ok(map.firstName?.selectors.length > 0);
  assert.ok(map.lastName?.selectors.length > 0);
  assert.ok(map.email?.selectors.length > 0);
  assert.ok(map.phone?.selectors.length > 0);
  assert.ok(map.linkedin?.selectors.length > 0);
  assert.ok(map.coverLetter?.selectors.length > 0);

  // Exclude safety on fullName
  assert.ok(map.fullName.exclude.includes('company'));
  assert.ok(map.fullName.exclude.includes('first_name') || map.fullName.exclude.includes('username'));
});
