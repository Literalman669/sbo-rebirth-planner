export const INTEGRATION_PHASES = Object.freeze([
  {
    id: 'core',
    testFiles: [
      'e2e/acceptance.spec.ts',
      'e2e/build-power-tools.spec.ts',
      'e2e/cloud-flow.spec.ts',
      'e2e/cloud-module.spec.ts',
      'e2e/curation-module.spec.ts',
      'e2e/dataset-updates-flow.spec.ts',
      'e2e/foundation.spec.ts',
      'e2e/guest-flow.spec.ts',
      'e2e/inventory-flow.spec.ts',
      'e2e/progress-flow.spec.ts',
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

export function playwrightArgumentsFor(phase) {
  return [
    'run',
    'test:e2e',
    '--workspace',
    '@sbo/optimizer-client',
    '--',
    ...phase.testFiles,
    ...(phase.grep ? ['--grep', phase.grep] : []),
  ];
}

export async function runIntegrationPhases(runPhase, phases = INTEGRATION_PHASES) {
  for (const phase of phases) {
    const exitCode = await runPhase(phase);
    if (exitCode !== 0) {
      throw new Error(`${phase.id} failed with exit code ${exitCode}`);
    }
  }
}
