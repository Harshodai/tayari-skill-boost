import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const sessionScriptSource = fs.readFileSync(new URL('../auth/session.js', import.meta.url), 'utf8');

function setupAuthEnv({ initialStorage = {}, fetchHandler = null } = {}) {
  const localStorage = new Map(Object.entries(initialStorage));
  const fetchCalls = [];

  const defaultFetch = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), init });
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const context = {
    console,
    URL,
    Headers,
    Response,
    fetch: fetchHandler ? async (url, init) => {
      fetchCalls.push({ url: String(url), init });
      return fetchHandler(url, init);
    } : defaultFetch,
    chrome: {
      storage: {
        local: {
          get: async (keys) => {
            if (typeof keys === 'string') return { [keys]: localStorage.get(keys) };
            if (Array.isArray(keys)) {
              return Object.fromEntries(keys.map((k) => [k, localStorage.get(k)]));
            }
            return Object.fromEntries(localStorage.entries());
          },
          set: async (items) => {
            for (const [k, v] of Object.entries(items)) {
              localStorage.set(k, v);
            }
          },
          remove: async (keys) => {
            const list = Array.isArray(keys) ? keys : [keys];
            list.forEach((k) => localStorage.delete(k));
          }
        }
      }
    }
  };
  context.globalThis = context;

  vm.runInNewContext(sessionScriptSource, context, { filename: 'session.js' });
  const TayariSession = context.globalThis.TayariSession;
  assert.ok(TayariSession, 'session.js must define TayariSession');

  return { TayariSession, localStorage, fetchCalls, context };
}

test('TayariSession.write validates session and stores bounded fields in chrome.storage.local', async () => {
  const { TayariSession, localStorage } = setupAuthEnv();

  const session = {
    access_token: 'token-abc-123',
    refresh_token: 'refresh-xyz-789',
    expires_in: 7200,
    user: { id: 'usr_001', email: 'dev@tayari.app' },
    extra_field_to_ignore: 'ignored'
  };

  const written = await TayariSession.write(session);
  assert.equal(written.access_token, 'token-abc-123');
  assert.equal(written.refresh_token, 'refresh-xyz-789');
  assert.equal(written.client, 'chrome-extension');
  assert.equal(written.user.id, 'usr_001');

  const stored = localStorage.get(TayariSession.SESSION_KEY);
  assert.ok(stored);
  assert.equal(stored.access_token, 'token-abc-123');
  assert.equal(stored.client, 'chrome-extension');
  assert.equal(stored.extra_field_to_ignore, undefined);
});

test('TayariSession.write rejects session without access_token', async () => {
  const { TayariSession } = setupAuthEnv();

  await assert.rejects(
    async () => TayariSession.write({ refresh_token: 'refresh-only' }),
    /Invalid extension session/
  );
});

test('TayariSession.write clears cached profile keys on new session write', async () => {
  const { TayariSession, localStorage } = setupAuthEnv({
    initialStorage: {
      tayari_profile_cache: { name: 'Old User' },
      tayari_profile_cache_timestamp: 12345678,
    }
  });

  await TayariSession.write({ access_token: 'new-token' });
  assert.equal(localStorage.has('tayari_profile_cache'), false);
  assert.equal(localStorage.has('tayari_profile_cache_timestamp'), false);
});

test('TayariSession.read returns null when storage is empty', async () => {
  const { TayariSession } = setupAuthEnv();
  const session = await TayariSession.read();
  assert.equal(session, null);
});

test('TayariSession.clear purges session and cache from storage', async () => {
  const { TayariSession, localStorage } = setupAuthEnv({
    initialStorage: {
      tayari_extension_session_v1: { access_token: 'tok' },
      tayari_profile_cache: { name: 'Test' },
      tayari_profile_cache_timestamp: 9999,
    }
  });

  await TayariSession.clear();
  assert.equal(localStorage.has('tayari_extension_session_v1'), false);
  assert.equal(localStorage.has('tayari_profile_cache'), false);
  assert.equal(localStorage.has('tayari_profile_cache_timestamp'), false);
});

test('TayariSession.isExpired identifies active vs expired tokens', () => {
  const { TayariSession } = setupAuthEnv();
  const now = Math.floor(Date.now() / 1000);

  // Active session with 1 hour remaining
  const activeSession = { access_token: 'tok', expires_at: now + 3600 };
  assert.equal(TayariSession.isExpired(activeSession), false);

  // Expired session in the past
  const expiredSession = { access_token: 'tok', expires_at: now - 10 };
  assert.equal(TayariSession.isExpired(expiredSession), true);

  // Session expiring within default leeway (45s)
  const expiringSoon = { access_token: 'tok', expires_at: now + 30 };
  assert.equal(TayariSession.isExpired(expiringSoon), true);

  // Session without token
  assert.equal(TayariSession.isExpired(null), true);
  assert.equal(TayariSession.isExpired({}), true);
});

test('TayariSession.refresh calls Supabase endpoint and persists renewed session', async () => {
  let refreshed = false;
  const { TayariSession, localStorage, fetchCalls } = setupAuthEnv({
    initialStorage: {
      tayari_extension_session_v1: {
        access_token: 'old-access',
        refresh_token: 'valid-refresh-token',
        expires_at: 1000,
      }
    },
    fetchHandler: async (url, init) => {
      if (String(url).includes('grant_type=refresh_token')) {
        refreshed = true;
        const body = JSON.parse(init.body);
        assert.equal(body.refresh_token, 'valid-refresh-token');
        return new Response(JSON.stringify({
          access_token: 'new-access-token',
          refresh_token: 'next-refresh-token',
          expires_in: 3600,
        }), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    }
  });

  const updated = await TayariSession.refresh('https://project.supabase.co', 'public-anon-key');
  assert.ok(refreshed);
  assert.equal(updated.access_token, 'new-access-token');
  assert.equal(updated.refresh_token, 'next-refresh-token');

  assert.equal(fetchCalls[0].init.headers['apikey'], 'public-anon-key');
  assert.equal(fetchCalls[0].init.headers['Content-Type'], 'application/json');

  const stored = localStorage.get(TayariSession.SESSION_KEY);
  assert.equal(stored.access_token, 'new-access-token');
});

test('TayariSession.refresh clears session when refresh token is rejected', async () => {
  const { TayariSession, localStorage } = setupAuthEnv({
    initialStorage: {
      tayari_extension_session_v1: {
        access_token: 'old-access',
        refresh_token: 'revoked-refresh-token',
        expires_at: 1000,
      }
    },
    fetchHandler: async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
  });

  const result = await TayariSession.refresh('https://project.supabase.co', 'public-anon-key');
  assert.equal(result, null);
  assert.equal(localStorage.has(TayariSession.SESSION_KEY), false);
});

test('TayariSession.fetchJson attaches Bearer Authorization and Content-Type headers', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { TayariSession, fetchCalls } = setupAuthEnv({
    initialStorage: {
      tayari_extension_session_v1: {
        access_token: 'secret-bearer-token',
        expires_at: now + 3600,
      }
    }
  });

  const config = { apiUrl: 'https://api.tayari.app/api' };
  const res = await TayariSession.fetchJson(config, 'v1/profile', { method: 'GET' });
  assert.equal(res.status, 200);

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://api.tayari.app/api/v1/profile');
  assert.equal(fetchCalls[0].init.headers.get('Authorization'), 'Bearer secret-bearer-token');
  assert.equal(fetchCalls[0].init.headers.get('Content-Type'), 'application/json');
});

test('TayariSession.fetchJson handles 401 token refresh flow and retries request', async () => {
  const now = Math.floor(Date.now() / 1000);
  let apiCallCount = 0;
  const authHeadersSent = [];

  const { TayariSession, localStorage } = setupAuthEnv({
    initialStorage: {
      tayari_extension_session_v1: {
        access_token: 'stale-token',
        refresh_token: 'valid-refresh-token',
        expires_at: now + 3600, // Appears valid locally but rejected remotely by API
      }
    },
    fetchHandler: async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('grant_type=refresh_token')) {
        return new Response(JSON.stringify({
          access_token: 'refreshed-token-999',
          refresh_token: 'next-refresh-token-999',
          expires_in: 3600,
        }), { status: 200 });
      }

      if (urlStr.includes('/api/v1/stats')) {
        apiCallCount++;
        authHeadersSent.push(init.headers.get('Authorization'));
        if (apiCallCount === 1) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        return new Response(JSON.stringify({ saved_jobs: 5, applied: 2 }), { status: 200 });
      }

      return new Response('Not found', { status: 404 });
    }
  });

  const config = {
    apiUrl: 'https://api.tayari.app/api',
    supabaseUrl: 'https://project.supabase.co',
    supabaseKey: 'public-key',
  };

  const response = await TayariSession.fetchJson(config, 'v1/stats');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.saved_jobs, 5);

  assert.equal(apiCallCount, 2);
  assert.equal(authHeadersSent[0], 'Bearer stale-token');
  assert.equal(authHeadersSent[1], 'Bearer refreshed-token-999');

  const stored = localStorage.get(TayariSession.SESSION_KEY);
  assert.equal(stored.access_token, 'refreshed-token-999');
});

test('TayariSession.fetchJson throws when no session exists', async () => {
  const { TayariSession } = setupAuthEnv();

  await assert.rejects(
    async () => TayariSession.fetchJson({ apiUrl: 'https://api.tayari.app/api' }, 'v1/stats'),
    /Sign in to Job Tayari first/
  );
});
