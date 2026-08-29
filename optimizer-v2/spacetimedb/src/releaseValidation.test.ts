import { describe, expect, it } from 'vitest';
import {
  REQUIRED_FORMULA_IDS,
  validateCurrentReleaseInvariant,
  validateReleaseDraft,
  type ReleaseValidationInput,
} from './releaseValidation';

function validDraft(): ReleaseValidationInput {
  const sourceId = 'source-stats';
  return {
    version: '2026.08.29.1',
    formulaSetVersion: 'sbor-stats-v1',
    equipment: [
      ['two-handed-item', 'two-handed'],
      ['one-handed-item', 'one-handed,dual-wield'],
      ['rapier-item', 'rapier'],
      ['dagger-item', 'dagger'],
      ['melee-item', 'melee'],
    ].map(([itemId, weaponPaths]) => ({
      itemId,
      slot: 'main-hand',
      weaponPaths,
      attack: 1,
      defense: 0,
      dexterity: 0,
      levelRequirement: 1,
      floor: 1,
      acquisitionType: 'starter',
      availability: 'always',
      sourceRefId: sourceId,
    })),
    formulas: REQUIRED_FORMULA_IDS.map((formulaId) => ({
      formulaId,
      sourceRefId: sourceId,
    })),
    sources: [
      {
        id: sourceId,
        sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
      },
    ],
  };
}

describe('validateReleaseDraft', () => {
  it('accepts a complete six-path, canonically sourced draft', () => {
    expect(validateReleaseDraft(validDraft())).toEqual([]);
  });

  it('rejects duplicate item IDs', () => {
    const input = validDraft();
    input.equipment.push({ ...input.equipment[0]! });

    expect(validateReleaseDraft(input)).toContain(
      'Duplicate equipment item ID: two-handed-item',
    );
  });

  it('rejects missing source references', () => {
    const input = validDraft();
    input.equipment[0] = {
      ...input.equipment[0]!,
      sourceRefId: 'missing-source',
    };

    expect(validateReleaseDraft(input)).toContain(
      'Equipment two-handed-item has no source reference',
    );
  });

  it('rejects floors outside the published game range', () => {
    const input = validDraft();
    input.equipment[0] = { ...input.equipment[0]!, floor: 0 };

    expect(validateReleaseDraft(input)).toContain(
      'Equipment two-handed-item has an invalid floor',
    );
  });

  it('rejects negative equipment stats', () => {
    const input = validDraft();
    input.equipment[0] = { ...input.equipment[0]!, attack: -1 };

    expect(validateReleaseDraft(input)).toContain(
      'Equipment two-handed-item has a negative stat',
    );
  });

  it('rejects a missing required formula', () => {
    const input = validDraft();
    input.formulas = input.formulas.filter(
      (formula) => formula.formulaId !== 'points-per-level',
    );

    expect(validateReleaseDraft(input)).toContain(
      'Missing required formula: points-per-level',
    );
  });

  it('rejects missing optimizer path coverage', () => {
    const input = validDraft();
    input.equipment = input.equipment.filter(
      (equipment) => !equipment.weaponPaths.includes('rapier'),
    );

    expect(validateReleaseDraft(input)).toContain(
      'Missing weapon-path coverage: rapier',
    );
  });
});

describe('validateCurrentReleaseInvariant', () => {
  it('requires exactly one current public release', () => {
    expect(
      validateCurrentReleaseInvariant([
        { version: '2026.08.29.1', isCurrent: true },
        { version: '2026.08.29.2', isCurrent: true },
      ]),
    ).toEqual(['Exactly one current dataset release is required']);
  });
});
