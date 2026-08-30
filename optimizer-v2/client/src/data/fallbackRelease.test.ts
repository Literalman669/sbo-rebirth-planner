import { describe, expect, it } from 'vitest';
import { fallbackRelease } from './fallbackRelease';

describe('fallbackRelease', () => {
  it('loads the exported, complete verified catalog release', () => {
    expect(fallbackRelease).toMatchObject({
      version: '2026.08.30.1',
      formulaSetVersion: 'sbor-stats-v2',
      strategyPolicyVersion: 'sbor-policy-v2',
      pointsPerLevel: 3,
      dualWieldSkillGate: 200,
    });
    expect(fallbackRelease.formulas).toHaveLength(9);
    expect(fallbackRelease.equipment.length).toBeGreaterThan(33);
    expect(fallbackRelease.catalog.length).toBeGreaterThan(33);
    expect(
      fallbackRelease.equipment.filter((item) => item.slot === 'armor').length,
    ).toBeGreaterThan(2);
    expect(
      fallbackRelease.equipment.some((item) => item.slot === 'upper-head'),
    ).toBe(true);
    expect(
      fallbackRelease.equipment.some((item) => item.slot === 'lower-head'),
    ).toBe(true);
    expect(fallbackRelease.mechanics).toHaveLength(11);
    expect(fallbackRelease.knownGaps).toHaveLength(11);
    expect(
      fallbackRelease.mechanics.find(
        (mechanic) => mechanic.id === 'multi-hit-from-str-luk',
      ),
    ).toMatchObject({ computability: 'exact', verificationStatus: 'verified' });
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

  it('projects only verified catalog rows into optimizer equipment', () => {
    expect(
      fallbackRelease.equipment.every(
        (item) => item.verificationStatus === 'verified',
      ),
    ).toBe(true);
  });
});
