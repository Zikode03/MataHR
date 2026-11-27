require('./register-typescript.cjs');
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { api, ApiError, can } = require('../src/shared/api.ts');
const mockFetch = (handler) => async (url, options) =>
  url === '/api/auth/antiforgery'
    ? new Response(
        JSON.stringify({ requestToken: 'test-csrf-token', headerName: 'RequestVerificationToken' }),
        { status: 200 },
      )
    : handler(url, options);
test('API writes use same-origin session cookies, JSON and the required CSRF header', async () => {
  const original = global.fetch;
  try {
    global.fetch = mockFetch(async (url, options) => {
      assert.equal(url, '/api/leave/requests');
      assert.equal(options.credentials, 'include');
      assert.equal(options.headers['X-MataHR-Request'], '1');
      assert.equal(options.headers.RequestVerificationToken, 'test-csrf-token');
      assert.equal(options.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(options.body), { policyId: 'real-id' });
      return new Response(JSON.stringify({ id: 'persisted' }), { status: 200 });
    });
    assert.deepEqual(await api('/leave/requests', 'POST', { policyId: 'real-id' }), {
      id: 'persisted',
    });
  } finally {
    global.fetch = original;
  }
});
test('expired sessions trigger sign-in and forbidden operations never return placeholder records', async () => {
  const original = global.fetch,
    oldWindow = global.window;
  let expired = 0;
  global.window = {
    dispatchEvent: (event) => {
      assert.equal(event.type, 'matahr:session-expired');
      expired++;
    },
  };
  try {
    global.fetch = mockFetch(async () => new Response('', { status: 401 }));
    await assert.rejects(
      () => api('/employees'),
      (error) => error instanceof ApiError && error.status === 401,
    );
    assert.equal(expired, 1);
    global.fetch = mockFetch(
      async () =>
        new Response(JSON.stringify({ error: { message: 'Access denied' } }), { status: 403 }),
    );
    await assert.rejects(() => api('/payroll/salaries'), /Access denied/);
    assert.equal(expired, 1);
  } finally {
    global.fetch = original;
    global.window = oldWindow;
  }
});
test('validation errors remain actionable and empty successful responses are accepted', async () => {
  const original = global.fetch;
  try {
    global.fetch = mockFetch(
      async () =>
        new Response(JSON.stringify({ errors: { started: ['Use an ISO date.'] } }), {
          status: 400,
        }),
    );
    await assert.rejects(() => api('/employees', 'POST', {}), /Use an ISO date/);
    global.fetch = mockFetch(async () => new Response(null, { status: 204 }));
    assert.equal(await api('/auth/logout', 'POST'), undefined);
  } finally {
    global.fetch = original;
  }
});
test('navigation capabilities come from server grants rather than role names', () => {
  assert.equal(can({ roles: ['Admin'], permissions: [] }, 'Payroll.Manage'), false);
  assert.equal(
    can({ roles: ['HR'], permissions: ['Workforce.Payroll.Manage'] }, 'Payroll.Manage'),
    true,
  );
});

test('invalid login and throttled requests give the user an actionable message', async () => {
  const original = global.fetch;
  try {
    global.fetch = mockFetch(async () => new Response(null, { status: 401 }));
    await assert.rejects(
      () =>
        api('/auth/login', 'POST', {
          email: 'someone@example.invalid',
          password: 'not-a-real-password',
        }),
      /Check your work email/,
    );
    global.fetch = mockFetch(async () => new Response(null, { status: 429 }));
    await assert.rejects(() => api('/attendance/clock-in', 'POST', {}), /Wait a minute/);
  } finally {
    global.fetch = original;
  }
});
test('writes stop when request protection cannot be obtained', async () => {
  const original = global.fetch;
  let writes = 0;
  try {
    global.fetch = async (url) => {
      if (url === '/api/auth/antiforgery') return new Response(JSON.stringify({}), { status: 200 });
      writes++;
      return new Response(null, { status: 204 });
    };
    await assert.rejects(() => api('/auth/login', 'POST', {}), /Could not secure this request/);
    assert.equal(writes, 0);
  } finally {
    global.fetch = original;
  }
});
test('each write refreshes its token for the current session identity', async () => {
  const original = global.fetch;
  let issued = 0,
    writes = 0;
  try {
    global.fetch = async (url, options) => {
      if (url === '/api/auth/antiforgery')
        return new Response(
          JSON.stringify({
            requestToken: 'token-' + ++issued,
            headerName: 'RequestVerificationToken',
          }),
          { status: 200 },
        );
      writes++;
      assert.equal(options.headers.RequestVerificationToken, 'token-' + writes);
      return new Response(null, { status: 204 });
    };
    await api('/auth/logout', 'POST');
    await api('/auth/login', 'POST', {});
    assert.equal(issued, 2);
    assert.equal(writes, 2);
  } finally {
    global.fetch = original;
  }
});
