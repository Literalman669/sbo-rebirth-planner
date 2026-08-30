import { describe, expect, it } from 'vitest';
import { fallbackRelease } from './fallbackRelease';

describe('fallbackRelease', () => {
  it('loads the exported, complete first verified release', () => {
    expect(fallbackRelease).toMatchObject({
      version: '2026.08.29.1',
      formulaSetVersion: 'sbor-stats-v1',
      strategyPolicyVersion: 'sbor-policy-v1',
      pointsPerLevel: 3,
      dualWieldSkillGate: 200,
    });
    expect(fallbackRelease.formulas).toHaveLength(9);
    expect(fallbackRelease.equipment).toHaveLength(33);
    expect(fallbackRelease.catalog).toHaveLength(33);
    expect(fallbackRelease.mechanics).toHaveLength(9);
    expect(fallbackRelease.knownGaps).toHaveLength(11);
    expect(
      fallbackRelease.formulas.find(
        (formula) => formula.id === 'points-per-level',
      ),
    ).toMatchObject({
      sourceUrl:
        'https://www.roblox.com/games/4733278992/Sword-Blox-Online-Rebirth',
      sourceRevision: 'owner-gameplay-attestation:2026-08-29',
      verificationStatus: 'verified',
    });
  });

  it('contains no candidate or inactive-event recommendation rows', () => {
    expect(
      fallbackRelease.equipment.every(
        (item) =>
          item.verificationStatus === 'verified' &&
          item.availability !== 'inactive-event',
      ),
    ).toBe(true);
  });
});
