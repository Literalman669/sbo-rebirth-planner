import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INTEGRATION_PHASES,
  playwrightArgumentsFor,
  runIntegrationPhases,
} from './integration-phase-plan.mjs';
import { terminateOwnedProcessGroup } from './owned-process-group.mjs';

test('splits the complete e2e suite into non-overlapping deterministic phases', () => {
  assert.deepEqual(INTEGRATION_PHASES, [
    {
      id: 'core',
      testFiles: [
        'e2e/acceptance.spec.ts',
        'e2e/cloud-flow.spec.ts',
        'e2e/cloud-module.spec.ts',
        'e2e/curation-module.spec.ts',
        'e2e/foundation.spec.ts',
        'e2e/guest-flow.spec.ts',
        'e2e/reliability-flow.spec.ts',
      ],
    },
    {
      id: 'reliability-module-composite',
      testFiles: ['e2e/reliability-module.spec.ts'],
      grep: '^keeps 100 immutable revisions converged across same-account subscriptions$',
    },
    {
      id: 'reliability-module-publication',
      testFiles: ['e2e/reliability-module.spec.ts'],
      grep: '^rejects invalid publications atomically and carries one reviewed row into a second release$',
    },
    {
      id: 'sharing-module',
      testFiles: ['e2e/sharing-module.spec.ts'],
    },
  ]);

  assert.deepEqual(
    playwrightArgumentsFor(INTEGRATION_PHASES[1]),
    [
      'run',
      'test:e2e',
      '--workspace',
      '@sbo/optimizer-client',
      '--',
      'e2e/reliability-module.spec.ts',
      '--grep',
      '^keeps 100 immutable revisions converged across same-account subscriptions$',
    ],
  );
});

test('runs phases in order and stops before a later phase after failure', async () => {
  const executed = [];

  await assert.rejects(
    () =>
      runIntegrationPhases(async (phase) => {
        executed.push(phase.id);
        return phase.id === 'reliability-module-publication' ? 1 : 0;
      }),
    /reliability-module-publication failed with exit code 1/,
  );

  assert.deepEqual(executed, [
    'core',
    'reliability-module-composite',
    'reliability-module-publication',
  ]);
});

test('escalates only the owned Linux process group after a bounded TERM wait', async () => {
  const signals = [];
  const waits = [false, true];
  await terminateOwnedProcessGroup({
    pid: 42,
    signal: (target, name) => signals.push([target, name]),
    waitForExit: async () => waits.shift(),
  });
  assert.deepEqual(signals, [[-42, 'SIGTERM'], [-42, 'SIGKILL']]);
});
