import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const contentScriptSource = fs.readFileSync(new URL('../content.js', import.meta.url), 'utf8');

function setupTestEnvironment() {
  const domEvents = [];
  const timeouts = [];

  class MockEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = !!options.bubbles;
      this.cancelable = !!options.cancelable;
    }
  }

  // Simulate prototype descriptor with React-like tracking
  const inputSetterCalls = [];
  class MockHTMLInputElement {
    constructor() {
      this._value = '';
      this.tagName = 'INPUT';
      this.nodeName = 'INPUT';
      this.focused = false;
      this.clicked = false;
      this.style = { backgroundColor: '', transition: '' };
      this.listeners = new Map();
    }
    focus() { this.focused = true; }
    click() { this.clicked = true; }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatchEvent(event) {
      domEvents.push({ element: this, event });
      const fns = this.listeners.get(event.type) || [];
      fns.forEach((fn) => fn(event));
      return true;
    }
  }

  Object.defineProperty(MockHTMLInputElement.prototype, 'value', {
    configurable: true,
    enumerable: true,
    get() {
      return this._value;
    },
    set(val) {
      inputSetterCalls.push({ element: this, value: val });
      this._value = val;
    }
  });

  const textareaSetterCalls = [];
  class MockHTMLTextAreaElement {
    constructor() {
      this._value = '';
      this.tagName = 'TEXTAREA';
      this.nodeName = 'TEXTAREA';
      this.focused = false;
      this.clicked = false;
      this.style = { backgroundColor: '', transition: '' };
      this.listeners = new Map();
    }
    focus() { this.focused = true; }
    click() { this.clicked = true; }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    }
    dispatchEvent(event) {
      domEvents.push({ element: this, event });
      const fns = this.listeners.get(event.type) || [];
      fns.forEach((fn) => fn(event));
      return true;
    }
  }

  Object.defineProperty(MockHTMLTextAreaElement.prototype, 'value', {
    configurable: true,
    enumerable: true,
    get() {
      return this._value;
    },
    set(val) {
      textareaSetterCalls.push({ element: this, value: val });
      this._value = val;
    }
  });

  const context = {
    console,
    URL,
    Event: MockEvent,
    HTMLInputElement: MockHTMLInputElement,
    HTMLTextAreaElement: MockHTMLTextAreaElement,
    setTimeout: (fn, delay) => {
      timeouts.push({ fn, delay });
      return timeouts.length;
    },
    clearTimeout: () => {},
    setInterval: () => ({ unref() {} }),
    clearInterval: () => {},
    window: {
      HTMLInputElement: MockHTMLInputElement,
      HTMLTextAreaElement: MockHTMLTextAreaElement,
      location: { href: 'https://boards.greenhouse.io/acme/jobs/123', hostname: 'boards.greenhouse.io', origin: 'https://boards.greenhouse.io' },
      addEventListener: () => {},
      removeEventListener: () => {},
      getSelection: () => ({ toString: () => '' }),
    },
    document: {
      title: 'Senior Software Engineer at Acme',
      body: { innerText: 'Job description' },
      readyState: 'complete',
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
    },
    chrome: {
      runtime: {
        id: 'tayari-extension-test',
        onMessage: { addListener: () => {} },
        sendMessage: async () => ({ success: true }),
      }
    }
  };
  context.globalThis = context;
  context.window.window = context.window;

  vm.runInNewContext(contentScriptSource, context, { filename: 'content.js' });

  const content = context.globalThis.__TAYARI_CONTENT__;
  assert.ok(content, 'content.js must expose __TAYARI_CONTENT__');

  return {
    content,
    MockHTMLInputElement,
    MockHTMLTextAreaElement,
    inputSetterCalls,
    textareaSetterCalls,
    domEvents,
    timeouts,
    context
  };
}

test('fillField returns false when element or value is missing', () => {
  const { content, MockHTMLInputElement } = setupTestEnvironment();
  const input = new MockHTMLInputElement();

  assert.equal(content.fillField(null, 'test'), false);
  assert.equal(content.fillField(input, null), false);
  assert.equal(content.fillField(input, ''), false);
});

test('fillField skips filling and returns false when element already has matching value', () => {
  const { content, MockHTMLInputElement, inputSetterCalls, domEvents } = setupTestEnvironment();
  const input = new MockHTMLInputElement();
  input.value = 'Jane Doe';
  // Reset tracker after test setup
  inputSetterCalls.length = 0;

  const result = content.fillField(input, '  Jane Doe  ');
  assert.equal(result, false);
  assert.equal(inputSetterCalls.length, 0);
  assert.equal(domEvents.length, 0);
});

test('fillField focuses and clicks the target element', () => {
  const { content, MockHTMLInputElement } = setupTestEnvironment();
  const input = new MockHTMLInputElement();

  const result = content.fillField(input, 'Jane Doe');
  assert.equal(result, true);
  assert.equal(input.focused, true);
  assert.equal(input.clicked, true);
});

test('fillField uses HTMLInputElement prototype setter for React input fields', () => {
  const { content, MockHTMLInputElement, inputSetterCalls } = setupTestEnvironment();
  const input = new MockHTMLInputElement();

  const result = content.fillField(input, 'Ada Lovelace');
  assert.equal(result, true);
  // Must clear value first then set new value via native setter
  assert.equal(inputSetterCalls.length, 2);
  assert.equal(inputSetterCalls[0].value, '');
  assert.equal(inputSetterCalls[1].value, 'Ada Lovelace');
  assert.equal(input.value, 'Ada Lovelace');
});

test('fillField uses HTMLTextAreaElement prototype setter for TEXTAREA elements', () => {
  const { content, MockHTMLTextAreaElement, textareaSetterCalls, inputSetterCalls } = setupTestEnvironment();
  const textarea = new MockHTMLTextAreaElement();

  const result = content.fillField(textarea, 'Experienced in building scalable systems.');
  assert.equal(result, true);
  assert.equal(textareaSetterCalls.length, 2);
  assert.equal(textareaSetterCalls[0].value, '');
  assert.equal(textareaSetterCalls[1].value, 'Experienced in building scalable systems.');
  assert.equal(inputSetterCalls.length, 0);
  assert.equal(textarea.value, 'Experienced in building scalable systems.');
});

test('fillField falls back to direct .value property assignment when prototype setter is missing', () => {
  const { content, context } = setupTestEnvironment();
  // Remove prototype descriptor to simulate non-React / standard fallback environment
  delete context.window.HTMLInputElement.prototype.value;

  const plainElement = {
    tagName: 'INPUT',
    value: '',
    focused: false,
    clicked: false,
    focus() { this.focused = true; },
    click() { this.clicked = true; },
    dispatchEvent() { return true; },
    style: { backgroundColor: '' }
  };

  const result = content.fillField(plainElement, 'fallback value');
  assert.equal(result, true);
  assert.equal(plainElement.value, 'fallback value');
});

test('fillField dispatches bubbling input, change, and blur events', () => {
  const { content, MockHTMLInputElement, domEvents } = setupTestEnvironment();
  const input = new MockHTMLInputElement();

  content.fillField(input, 'test@example.com');
  assert.equal(domEvents.length, 3);
  assert.equal(domEvents[0].event.type, 'input');
  assert.equal(domEvents[0].event.bubbles, true);
  assert.equal(domEvents[1].event.type, 'change');
  assert.equal(domEvents[1].event.bubbles, true);
  assert.equal(domEvents[2].event.type, 'blur');
  assert.equal(domEvents[2].event.bubbles, true);
});

test('fillField applies visual feedback (#e0f2fe) and sets transition timeout reset', () => {
  const { content, MockHTMLInputElement, timeouts } = setupTestEnvironment();
  const input = new MockHTMLInputElement();

  content.fillField(input, 'Grace Hopper');
  assert.equal(input.style.backgroundColor, '#e0f2fe');
  assert.equal(timeouts.length, 1);
  assert.equal(timeouts[0].delay, 1000);

  // Execute timeout callback
  timeouts[0].fn();
  assert.equal(input.style.backgroundColor, '');
  assert.match(input.style.transition, /background-color/);
});

test('findField locates matching element and respects exclusions', () => {
  const { content, MockHTMLInputElement, context } = setupTestEnvironment();

  const nameInput = new MockHTMLInputElement();
  nameInput.name = 'full_name';

  const companyInput = new MockHTMLInputElement();
  companyInput.name = 'company_name';

  context.document.querySelectorAll = (selector) => {
    if (selector.includes('name')) {
      return [companyInput, nameInput];
    }
    return [];
  };

  const fieldConfig = {
    selectors: ['input[name*="name"]'],
    exclude: ['company']
  };

  const matched = content.findField(fieldConfig);
  assert.equal(matched, nameInput);
});
