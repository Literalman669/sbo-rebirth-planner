import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INTEGRATION_PHASES,
  playwrightArgumentsFor,
  runIntegrationPhases,
} from './integration-phase-plan.mjs';
import { terminateOwnedProcessGroup } from './owned-process-group.mjs';
import { stopOwnedLinuxServer } from './owned-process-group.mjs';

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
        'e2e/inventory-flow.spec.ts',
        'e2e/qol-accessibility.spec.ts',
        'e2e/reliability-flow.spec.ts',
      ],
    },
    {
      id: 'reliability-module-composite',
      testFiles: ['e2e/reliability-module.spec.ts'],
      grep: 'keeps 100 immutable revisions converged across same-account subscriptions$',
    },
    {
      id: 'reliability-module-publication',
      testFiles: ['e2e/reliability-module.spec.ts'],
      grep: 'rejects invalid publications atomically and carries one reviewed row into a second release$',
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
      'keeps 100 immutable revisions converged across same-account subscriptions$',
    ],
  );

  const composite = new RegExp(INTEGRATION_PHASES[1].grep);
  const publication = new RegExp(INTEGRATION_PHASES[2].grep);
  const compositeTitle = 'e2e/reliability-module.spec.ts › keeps 100 immutable revisions converged across same-account subscriptions';
  const publicationTitle = 'e2e/reliability-module.spec.ts › rejects invalid publications atomically and carries one reviewed row into a second release';
  assert.equal(composite.test(compositeTitle), true);
  assert.equal(composite.test(publicationTitle), false);
  assert.equal(publication.test(publicationTitle), true);
  assert.equal(publication.test(compositeTitle), false);
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
  const waits = [false, true, true];
  await terminateOwnedProcessGroup({
    pid: 42,
    signal: (target, name) => signals.push([target, name]),
    waitForExit: async () => waits.shift(),
  });
  assert.deepEqual(signals, [[-42, 'SIGTERM'], [-42, 'SIGKILL']]);
});

test('accepts owned-group ESRCH without detached child exit bookkeeping', async () => {
  const signals = [];
  await terminateOwnedProcessGroup({
    pid: 42,
    signal: (target, name) => {
      signals.push([target, name]);
      if (name === 'SIGKILL') throw Object.assign(new Error('gone'), { code: 'ESRCH' });
    },
    waitForExit: async () => false,
  });
  assert.deepEqual(signals, [[-42, 'SIGTERM'], [-42, 'SIGKILL']]);
});

test('terminates a live owned group even after its launcher exit bookkeeping is set', async () => {
  const signals = [];
  const server = { pid: 42, exitCode: 0, stdout: { destroy() {} }, stderr: { destroy() {} }, unref() {} };
  const waits = [false, true, true];
  await stopOwnedLinuxServer({
    server,
    signal: (target, name) => signals.push([target, name]),
    waitForGroupAbsence: async () => waits.shift(),
  });
  assert.deepEqual(signals, [[-42, 'SIGTERM'], [-42, 'SIGKILL']]);
});
