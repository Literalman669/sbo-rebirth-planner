import { describe, expect, it } from 'vitest';
import {
  REQUIRED_FORMULA_IDS,
  validateCurrentReleaseInvariant,
  validateReleaseDraft,
  type ReleaseValidationInput,
} from './releaseValidation';

const wiki = 'https://swordbloxonlinerebirth.fandom.com/wiki';

function candidate(pageTitle: string, revisionId: string) {
  const id = `${pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${revisionId}`;
  return {
    id,
    pageTitle,
    sourceUrl: `${wiki}/${encodeURIComponent(pageTitle)}`,
    revisionId,
    status: 'accepted',
  };
}

function validDraft(): ReleaseValidationInput {
  const weaponFixtures = [
    ['two-handed-item', 'two-handed', 'Two-Handed', '100'],
    ['one-handed-item', 'one-handed,dual-wield', 'One-Handed', '101'],
    ['rapier-item', 'rapier', 'Rapier', '102'],
    ['dagger-item', 'dagger', 'Dagger', '103'],
    ['fists', 'melee', 'Fists', '104'],
  ] as const;
  const statsCandidate = candidate('Stats', '23125');
  const equipmentCandidates = weaponFixtures.map((row) =>
    candidate(row[2], row[3]),
  );
  const equipment = weaponFixtures.map(([itemId, weaponPaths, pageTitle]) => {
    const sourceCandidate = equipmentCandidates.find(
      (row) => row.pageTitle === pageTitle,
    )!;
    return {
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
      sourceRefId: `source-equipment-${itemId}`,
      candidateId: sourceCandidate.id,
    };
  });
  const formulas = REQUIRED_FORMULA_IDS.map((formulaId) => ({
    formulaId,
    sourceRefId: `source-formula-${formulaId}`,
    candidateId: statsCandidate.id,
  }));

  return {
    version: '2026.08.29.1',
    formulaSetVersion: 'sbor-stats-v1',
    equipment,
    formulas,
    sources: [
      ...equipment.map((row) => {
        const sourceCandidate = equipmentCandidates.find(
          (candidateRow) => candidateRow.id === row.candidateId,
        )!;
        return {
          id: row.sourceRefId,
          entityKind: 'equipment',
          entityId: row.itemId,
          sourceUrl: sourceCandidate.sourceUrl,
          sourceRevision: sourceCandidate.revisionId,
          candidateId: sourceCandidate.id,
        };
      }),
      ...formulas.map((row) => ({
        id: row.sourceRefId,
        entityKind: 'formula',
        entityId: row.formulaId,
        sourceUrl: statsCandidate.sourceUrl,
        sourceRevision: statsCandidate.revisionId,
        candidateId: statsCandidate.id,
      })),
    ],
    candidates: [...equipmentCandidates, statsCandidate],
  };
}

describe('validateReleaseDraft', () => {
  it('accepts rows whose entity, candidate page, URL, and revision all match', () => {
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

  it('rejects a source attached to a different entity', () => {
    const input = validDraft();
    input.sources[0] = { ...input.sources[0]!, entityId: 'other-item' };
    expect(validateReleaseDraft(input)).toContain(
      'Equipment two-handed-item source does not identify that equipment row',
    );
  });

  it('rejects a candidate from the wrong canonical page', () => {
    const input = validDraft();
    const source = input.sources[0]!;
    source.sourceUrl = `${wiki}/Stats`;
    source.sourceRevision = '23125';
    source.candidateId = 'stats:23125';
    input.equipment[0] = {
      ...input.equipment[0]!,
      candidateId: 'stats:23125',
    };
    expect(validateReleaseDraft(input)).toContain(
      'Equipment two-handed-item must use the Two-Handed candidate page',
    );
  });

  it('allows verified weapon equipment from the gamepass and badge page', () => {
    const input = validDraft();
    const gamepassCandidate = candidate('Gamepass and Badge Equipment', '200');
    input.candidates.push(gamepassCandidate);
    input.sources[0] = {
      ...input.sources[0]!,
      sourceUrl: gamepassCandidate.sourceUrl,
      sourceRevision: gamepassCandidate.revisionId,
      candidateId: gamepassCandidate.id,
    };
    input.equipment[0] = {
      ...input.equipment[0]!,
      candidateId: gamepassCandidate.id,
    };

    expect(validateReleaseDraft(input)).toEqual([]);
  });

  it('rejects a source revision that differs from its candidate', () => {
    const input = validDraft();
    input.sources[0] = { ...input.sources[0]!, sourceRevision: '999' };
    expect(validateReleaseDraft(input)).toContain(
      'Source source-equipment-two-handed-item does not match candidate two-handed:100',
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

  it('rejects rows linked to an unaccepted wiki candidate', () => {
    const input = validDraft();
    input.candidates[0] = { ...input.candidates[0]!, status: 'pending' };
    expect(validateReleaseDraft(input)).toContain(
      'Candidate two-handed:100 is not accepted',
    );
  });

  it('rejects a source reference linked to a missing candidate', () => {
    const input = validDraft();
    input.sources[0] = {
      ...input.sources[0]!,
      candidateId: 'two-handed:missing',
    };
    expect(validateReleaseDraft(input)).toContain(
      'Source source-equipment-two-handed-item has no accepted candidate',
    );
  });

  it('accepts the owner gameplay attestation only for points per level', () => {
    const input = validDraft();
    const sourceIndex = input.sources.findIndex(
      (source) => source.entityId === 'points-per-level',
    );
    input.sources[sourceIndex] = {
      ...input.sources[sourceIndex]!,
      sourceUrl:
        'https://www.roblox.com/games/4733278992/Sword-Blox-Online-Rebirth',
      sourceRevision: 'owner-gameplay-attestation:2026-08-29',
    };
    expect(validateReleaseDraft(input)).toEqual([]);
  });

  it('rejects a known-gap identifier the public dataset mapper cannot read', () => {
    const input = validDraft();
    input.sources.push({
      id: 'source-gap-invalid',
      entityKind: 'gap',
      entityId: 'gap:two-handed:not-a-band',
      sourceUrl: `${wiki}/Two-Handed`,
      sourceRevision: '100',
      candidateId: 'two-handed:100',
    });

    expect(validateReleaseDraft(input)).toContain(
      'Source source-gap-invalid has an invalid known-gap identifier',
    );
  });

  it('rejects a known gap sourced from the wrong candidate page', () => {
    const input = validDraft();
    input.sources.push({
      id: 'source-gap-wrong-page',
      entityKind: 'gap',
      entityId: 'gap:two-handed:250-299',
      sourceUrl: `${wiki}/Stats`,
      sourceRevision: '23125',
      candidateId: 'stats:23125',
    });

    expect(validateReleaseDraft(input)).toContain(
      'Source source-gap-wrong-page must use the Two-Handed candidate page',
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
