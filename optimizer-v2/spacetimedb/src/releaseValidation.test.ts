import { describe, expect, it } from 'vitest';
import {
  validateCurrentReleaseInvariant,
  validateReleaseDraft,
  type ReleaseValidationInput,
} from './releaseValidation';

const wiki = 'https://swordbloxonlinerebirth.fandom.com/wiki';
const literalRequiredFormulaIds = [
  'points-per-level',
  'attack-from-str',
  'damage-reduction-from-def',
  'bonus-hp-from-vit',
  'stamina',
  'walk-speed-from-agi',
  'sprint-speed-from-agi',
  'crit-bonus-from-luk',
  'drop-bonus-from-luk',
] as const;

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
  const formulas = literalRequiredFormulaIds.map((formulaId) => ({
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

  const invalidDrafts: readonly {
    name: string;
    mutate: (input: ReleaseValidationInput) => void;
    error: string;
  }[] = [
    {
      name: 'a duplicate equipment item ID',
      mutate: (input) => {
        input.equipment.push({ ...input.equipment[0]! });
      },
      error: 'Duplicate equipment item ID: two-handed-item',
    },
    {
      name: 'a duplicate formula ID',
      mutate: (input) => {
        input.formulas.push({ ...input.formulas[0]! });
      },
      error: 'Duplicate formula ID: points-per-level',
    },
    {
      name: 'a duplicate source reference ID',
      mutate: (input) => {
        input.sources.push({ ...input.sources[0]! });
      },
      error: 'Duplicate source reference ID: source-equipment-two-handed-item',
    },
    {
      name: 'a duplicate candidate ID',
      mutate: (input) => {
        input.candidates.push({ ...input.candidates[0]! });
      },
      error: 'Duplicate candidate ID: two-handed:100',
    },
    {
      name: 'an invalid known-gap grammar',
      mutate: (input) => {
        input.sources.push({
          id: 'source-gap-invalid',
          entityKind: 'gap',
          entityId: 'gap:two-handed:not-a-band',
          sourceUrl: `${wiki}/Two-Handed`,
          sourceRevision: '100',
          candidateId: 'two-handed:100',
        });
      },
      error: 'Source source-gap-invalid has an invalid known-gap identifier',
    },
    {
      name: 'an equipment candidate from the wrong canonical page',
      mutate: (input) => {
        input.sources[0] = {
          ...input.sources[0]!,
          sourceUrl: `${wiki}/Stats`,
          sourceRevision: '23125',
          candidateId: 'stats:23125',
        };
        input.equipment[0] = {
          ...input.equipment[0]!,
          candidateId: 'stats:23125',
        };
      },
      error: 'Equipment two-handed-item must use the Two-Handed candidate page',
    },
    {
      name: 'a source revision that differs from its candidate',
      mutate: (input) => {
        input.sources[0] = { ...input.sources[0]!, sourceRevision: '999' };
      },
      error:
        'Source source-equipment-two-handed-item does not match candidate two-handed:100',
    },
    {
      name: 'an unaccepted candidate',
      mutate: (input) => {
        input.candidates[0] = { ...input.candidates[0]!, status: 'pending' };
      },
      error: 'Candidate two-handed:100 is not accepted',
    },
    {
      name: 'a missing source reference',
      mutate: (input) => {
        input.equipment[0] = {
          ...input.equipment[0]!,
          sourceRefId: 'missing-source',
        };
      },
      error: 'Equipment two-handed-item has no source reference',
    },
    {
      name: 'an unsupported formula set',
      mutate: (input) => {
        input.formulaSetVersion = 'sbor-stats-v2';
      },
      error: 'Formula set version is unsupported',
    },
  ];

  it.each(invalidDrafts)('rejects $name', ({ mutate, error }) => {
    const input = validDraft();
    mutate(input);

    expect(validateReleaseDraft(input)).toContain(error);
  });

  it('rejects a source attached to a different entity', () => {
    const input = validDraft();
    input.sources[0] = { ...input.sources[0]!, entityId: 'other-item' };
    expect(validateReleaseDraft(input)).toContain(
      'Equipment two-handed-item source does not identify that equipment row',
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

  const missingFormulaCases = [
    { id: 'points-per-level', error: 'Missing required formula: points-per-level' },
    { id: 'attack-from-str', error: 'Missing required formula: attack-from-str' },
    {
      id: 'damage-reduction-from-def',
      error: 'Missing required formula: damage-reduction-from-def',
    },
    { id: 'bonus-hp-from-vit', error: 'Missing required formula: bonus-hp-from-vit' },
    { id: 'stamina', error: 'Missing required formula: stamina' },
    {
      id: 'walk-speed-from-agi',
      error: 'Missing required formula: walk-speed-from-agi',
    },
    {
      id: 'sprint-speed-from-agi',
      error: 'Missing required formula: sprint-speed-from-agi',
    },
    {
      id: 'crit-bonus-from-luk',
      error: 'Missing required formula: crit-bonus-from-luk',
    },
    {
      id: 'drop-bonus-from-luk',
      error: 'Missing required formula: drop-bonus-from-luk',
    },
  ] as const;

  it.each(missingFormulaCases)(
    'rejects a release missing $id',
    ({ id, error }) => {
      const input = validDraft();
      input.formulas = input.formulas.filter(
        (formula) => formula.formulaId !== id,
      );

      expect(validateReleaseDraft(input)).toContain(error);
    },
  );

  const missingPathCases: readonly {
    path: string;
    mutate: (input: ReleaseValidationInput) => void;
    error: string;
  }[] = [
    {
      path: 'two-handed',
      mutate: (input) => {
        input.equipment = input.equipment.filter(
          (row) => row.itemId !== 'two-handed-item',
        );
      },
      error: 'Missing weapon-path coverage: two-handed',
    },
    {
      path: 'one-handed',
      mutate: (input) => {
        input.equipment[1] = {
          ...input.equipment[1]!,
          weaponPaths: 'dual-wield',
        };
      },
      error: 'Missing weapon-path coverage: one-handed',
    },
    {
      path: 'rapier',
      mutate: (input) => {
        input.equipment = input.equipment.filter(
          (row) => row.itemId !== 'rapier-item',
        );
      },
      error: 'Missing weapon-path coverage: rapier',
    },
    {
      path: 'dagger',
      mutate: (input) => {
        input.equipment = input.equipment.filter(
          (row) => row.itemId !== 'dagger-item',
        );
      },
      error: 'Missing weapon-path coverage: dagger',
    },
    {
      path: 'dual-wield',
      mutate: (input) => {
        input.equipment[1] = {
          ...input.equipment[1]!,
          weaponPaths: 'one-handed',
        };
      },
      error: 'Missing weapon-path coverage: dual-wield',
    },
    {
      path: 'melee',
      mutate: (input) => {
        input.equipment = input.equipment.filter((row) => row.itemId !== 'fists');
      },
      error: 'Missing weapon-path coverage: melee',
    },
  ];

  it.each(missingPathCases)(
    'rejects a release missing $path coverage',
    ({ mutate, error }) => {
      const input = validDraft();
      mutate(input);

      expect(validateReleaseDraft(input)).toContain(error);
    },
  );

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
