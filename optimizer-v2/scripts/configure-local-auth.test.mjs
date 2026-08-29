import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertLocalAuthTarget,
  configureLocalAuth,
} from './configure-local-auth.mjs';

test('accepts only the fixed loopback integration database', () => {
  assert.doesNotThrow(() =>
    assertLocalAuthTarget(
      'http://127.0.0.1:3000',
      'sbo-rebirth-optimizer-v2-test',
    ),
  );
  assert.throws(
    () =>
      assertLocalAuthTarget(
        'https://maincloud.spacetimedb.com',
        'sbo-rebirth-optimizer-v2-test',
      ),
    /Refusing local auth configuration/,
  );
  assert.throws(
    () => assertLocalAuthTarget('http://127.0.0.1:3000', 'production'),
    /Refusing local auth configuration/,
  );
});

test('sends only the development-mode arguments to the protected local reducer', async () => {
  let request;
  await configureLocalAuth({
    ownerToken: 'test-owner-token',
    fetchImpl: async (input, init) => {
      request = new Request(input, init);
      return new Response(null, { status: 200 });
    },
  });

  assert.equal(
    request.url,
    'http://127.0.0.1:3000/v1/database/sbo-rebirth-optimizer-v2-test/call/configure_auth',
  );
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.get('authorization'), 'Bearer test-owner-token');
  assert.deepEqual(await request.json(), ['development', '', '']);
});
