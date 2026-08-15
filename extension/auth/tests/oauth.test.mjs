import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from "node:vm";
import { TextEncoder } from "node:util";

async function harness({ callbackState = 'valid' } = {}) {
  const sessionStore = new Map();
  const localStore = new Map();
  const writes = [];
  const context = vm.createContext({
    console, crypto: globalThis.crypto, btoa: globalThis.btoa, TextEncoder, URL, Response,
    fetch: async () => new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 }), { status: 200 }),
    chrome: {
      storage: {
        session: {
          get: async (key) => ({ [key]: sessionStore.get(key) }),
          set: async (value) => Object.entries(value).forEach(([key, item]) => sessionStore.set(key, item)),
          remove: async (key) => (Array.isArray(key) ? key : [key]).forEach((item) => sessionStore.delete(item)),
        },
        local: {
          get: async (key) => ({ [key]: localStore.get(key) }),
          set: async (value) => Object.entries(value).forEach(([key, item]) => localStore.set(key, item)),
          remove: async (keys) => (Array.isArray(keys) ? keys : [keys]).forEach((key) => localStore.delete(key)),
        },
      },
      identity: {
        getRedirectURL: () => 'https://extension.chromiumapp.org/auth/callback',
        launchWebAuthFlow: async () => {
          const pending = sessionStore.get('tayari_extension_oauth_pending_v1');
          return `https://extension.chromiumapp.org/auth/callback?code=code-1&state=${callbackState === 'valid' ? pending.state : 'wrong'}`;
        },
      },
    },
  });
  context.globalThis = context;
  context.TayariSession = {
    write: async (value) => { writes.push(value); return value; },
    read: async () => null,
    clear: async () => {},
  };
  context.globalThis.TayariSession = context.TayariSession;
  vm.runInContext(await readFile('extension/auth/pkce.js', 'utf8'), context);
  vm.runInContext(await readFile('extension/auth/oauth.js', 'utf8'), context);
  return { context, sessionStore, writes };
}

test('PKCE flow exchanges code and clears pending state', async () => {
  const { context, sessionStore, writes } = await harness();
  const result = await context.TayariOAuth.begin({ supabaseUrl: 'https://project.supabase.co', supabaseKey: 'public' });
  assert.equal(result.access_token, 'access');
  assert.equal(writes.length, 1);
  assert.equal(sessionStore.has('tayari_extension_oauth_pending_v1'), false);
});

test('wrong callback state is rejected and pending state is cleared', async () => {
  const { context, sessionStore } = await harness({ callbackState: 'wrong' });
  await assert.rejects(() => context.TayariOAuth.begin({ supabaseUrl: 'https://project.supabase.co', supabaseKey: 'public' }), /state validation failed/);
  assert.equal(sessionStore.has('tayari_extension_oauth_pending_v1'), false);
});

test('unsupported provider is rejected before starting authorization', async () => {
  const { context, sessionStore } = await harness();
  await assert.rejects(() => context.TayariOAuth.begin({ supabaseUrl: 'https://project.supabase.co', supabaseKey: 'public' }, 'facebook'), /Unsupported sign-in provider/);
  assert.equal(sessionStore.has('tayari_extension_oauth_pending_v1'), false);
});
