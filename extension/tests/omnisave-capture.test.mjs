import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../omnisave_capture.js', import.meta.url), 'utf8');

function makeCard({ text, title, author } = {}) {
  return {
    innerText: text || title || '',
    textContent: text || title || '',
    querySelector(selector) {
      if (selector.includes('h1') || selector.includes('h2') || selector.includes('h3') || selector.includes('h4') || selector.includes('[role="heading"]')) {
        return title ? { innerText: title, textContent: title } : null;
      }
      if (selector.includes('[rel="author"]') || selector.includes('.byline') || selector.includes('[data-testid*="author"]') || selector.includes('a[href*="/@"]')) {
        return author ? { innerText: author, textContent: author } : null;
      }
      return null;
    },
    querySelectorAll() { return []; },
  };
}

function makeAnchor(href, options = {}) {
  const card = makeCard(options);
  return {
    href,
    innerText: options.anchorText || options.title || href,
    textContent: options.anchorText || options.title || href,
    parentElement: card,
    closest() { return card; },
  };
}

function loadCollector(pageUrl, anchors) {
  let handler;
  const url = new URL(pageUrl);
  const context = {
    URL,
    window: {
      location: {
        href: url.href,
        hostname: url.hostname,
        pathname: url.pathname,
        origin: url.origin,
      },
      scrollY: 0,
      getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
      scrollTo() {},
    },
    document: {
      title: 'Saved library',
      querySelectorAll(selector) {
        if (selector === 'a[href]') return anchors;
        return [];
      },
      body: { scrollHeight: 1000 },
      documentElement: { scrollHeight: 1000 },
    },
    chrome: {
      runtime: {
        onMessage: { addListener(fn) { handler = fn; } },
      },
    },
    setTimeout,
    Promise,
  };
  vm.runInNewContext(source, context, { filename: 'omnisave_capture.js' });
  assert.equal(typeof handler, 'function', 'collector must register a runtime message handler');
  return {
    collect(maxSources = 100) {
      let response;
      const keepChannelOpen = handler({ action: 'collect_saved_sources', maxSources }, {}, (value) => { response = value; });
      assert.equal(keepChannelOpen, true);
      return response;
    },
  };
}

test('collects visible LinkedIn saved post links, normalizes hashes, and deduplicates URLs', () => {
  const collector = loadCollector('https://www.linkedin.com/my-items/saved-posts/', [
    makeAnchor('https://www.linkedin.com/feed/update/urn:li:activity:101#comments', { title: 'Post one', author: 'Author One', text: 'Post one visible text' }),
    makeAnchor('https://www.linkedin.com/feed/update/urn:li:activity:101', { title: 'Duplicate post', author: 'Author One' }),
    makeAnchor('https://www.linkedin.com/posts/author_post-abc-123', { title: 'Post two', author: 'Author Two' }),
    makeAnchor('https://www.linkedin.com/jobs/view/999', { title: 'Unrelated job' }),
  ]);
  const result = collector.collect();
  assert.equal(result.success, true);
  assert.equal(result.platform, 'linkedin');
  assert.deepEqual(Array.from(result.sources, (item) => item.url), [
    'https://www.linkedin.com/feed/update/urn:li:activity:101',
    'https://www.linkedin.com/posts/author_post-abc-123',
  ]);
  assert.equal(result.sources[0].title, 'Post one');
});

test('collects Medium reading-list article links and ignores non-article navigation', () => {
  const collector = loadCollector('https://medium.com/me/lists', [
    makeAnchor('https://medium.com/p/story-one', { title: 'Story one', author: 'Writer One' }),
    makeAnchor('https://medium.com/@writer/story-two', { title: 'Story two', author: 'Writer Two' }),
    makeAnchor('https://medium.com/membership', { title: 'Membership' }),
    makeAnchor('https://example.com/p/not-medium', { title: 'External' }),
  ]);
  const result = collector.collect();
  assert.equal(result.success, true);
  assert.equal(result.platform, 'medium');
  assert.deepEqual(Array.from(result.sources, (item) => item.url), [
    'https://medium.com/p/story-one',
    'https://medium.com/@writer/story-two',
  ]);
});

test('collects Substack saved links from the saved page and publication hosts', () => {
  const collector = loadCollector('https://substack.com/saved', [
    makeAnchor('https://substack.com/home/post-123', { title: 'Saved home post' }),
    makeAnchor('https://newsletter.substack.com/p/post-456', { title: 'Saved newsletter post' }),
    makeAnchor('https://substack.com/saved', { title: 'Saved library navigation' }),
    makeAnchor('https://example.com/publication/post-789', { title: 'External post' }),
  ]);
  const result = collector.collect();
  assert.equal(result.success, true);
  assert.equal(result.platform, 'substack');
  assert.deepEqual(Array.from(result.sources, (item) => item.url), [
    'https://substack.com/home/post-123',
    'https://newsletter.substack.com/p/post-456',
  ]);
});

test('returns an explicit unsupported-page result instead of pretending to capture', () => {
  const collector = loadCollector('https://medium.com/@writer/publication', [
    makeAnchor('https://medium.com/p/story-one', { title: 'Story one' }),
  ]);
  const result = collector.collect();
  assert.equal(result.success, false);
  assert.equal(result.error, 'This is not a supported saved-content page.');
  assert.equal(result.platform, null);
  assert.deepEqual(Array.from(result.sources), []);
});

test('honors the bounded source limit', () => {
  const collector = loadCollector('https://www.linkedin.com/my-items/saved-posts/', [
    makeAnchor('https://www.linkedin.com/feed/update/urn:li:activity:1', { title: 'One' }),
    makeAnchor('https://www.linkedin.com/feed/update/urn:li:activity:2', { title: 'Two' }),
    makeAnchor('https://www.linkedin.com/feed/update/urn:li:activity:3', { title: 'Three' }),
  ]);
  const result = collector.collect(2);
  assert.equal(result.sources.length, 2);
});
