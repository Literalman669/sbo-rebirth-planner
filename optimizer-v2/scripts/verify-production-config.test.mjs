import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertProductionAuthOutput,
  validateStaticProductionConfig,
} from './verify-production-config.mjs';

const valid = {
  config: { database: 'sbo-rebirth-optimizer-v2', server: 'maincloud' },
  cliVersionOutput:
    'spacetimedb tool version 2.8.3; spacetimedb-lib version 2.8.3;',
  clientId: 'client_example123',
  clientUri: 'https://maincloud.spacetimedb.com',
  clientDatabase: 'sbo-rebirth-optimizer-v2',
};

test('accepts only the pinned production routing and public client ID shape', () => {
  assert.deepEqual(validateStaticProductionConfig(valid), []);
});

test('fails closed for a development route or missing client ID', () => {
  assert.ok(
    validateStaticProductionConfig({
      ...valid,
      config: { database: 'dev', server: 'local' },
      clientId: '',
    }).length >= 3,
  );
});

test('requires production auth mode, issuer, and exact audience', () => {
  assert.doesNotThrow(() =>
    assertProductionAuthOutput(
      JSON.stringify([
        {
          mode: 'production',
          issuer: 'https://auth.spacetimedb.com/oidc',
          audience: 'client_example123',
        },
      ]),
      'client_example123',
    ),
  );
  assert.throws(
    () => assertProductionAuthOutput('{"mode":"development"}', 'client_example123'),
    /production auth configuration/i,
  );
});
