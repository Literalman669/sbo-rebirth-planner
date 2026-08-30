import { describe, expect, it } from 'vitest';
import {
  type CatalogReleaseValidationInput,
  validateCatalogRelease,
} from './catalogReleaseValidation';

function validInput(): CatalogReleaseValidationInput {
  return {
    version: '2026.08.30.1',
    formulaSetVersion: 'sbor-stats-v2',
    manifest: {
      discovered: 1,
      fetched: 1,
      parsed: 1,
      normalized: 1,
      verified: 1,
      partial: 0,
      conflicting: 0,
      unknown: 0,
      legacy: 0,
      unresolvedJson: JSON.stringify({ unaccountedPages: [], unresolved: [] }),
      manifestHash: 'sha256:manifest',
    },
    policy: {
      policyVersion: 'sbor-policy-v2',
      policyJson: JSON.stringify({ goals: ['balanced'] }),
    },
    equipment: [{
      itemId: 'steel-sword',
      slot: 'main-hand',
      weaponPaths: 'one-handed,dual-wield',
      attack: 8.4,
      defense: 0,
      dexterity: 0,
      levelRequirement: 1,
      skillRequirement: 5,
      verificationStatus: 'verified',
      sourceRefId: 'source:steel-sword',
      candidateId: 'candidate:one-handed',
    }],
    aliases: [],
    acquisitions: [{
      id: 'steel-sword:shop',
      itemId: 'steel-sword',
      acquisitionType: 'shop',
      detail: 'Floor 1 Shop',
      floor: 1,
      availability: 'always',
      accessType: 'free',
      sourceRefId: 'source:steel-sword',
      candidateId: 'candidate:one-handed',
    }],
    resistances: [],
    effects: [],
    mechanics: [{
      mechanicId: 'attack-from-str',
      computability: 'exact',
      parametersJson: JSON.stringify({ statCap: 500, damagePerStr: 0.004 }),
      verificationStatus: 'verified',
      sourceRefId: 'source:attack-from-str',
      candidateId: 'candidate:stats',
    }],
    sources: [
      {
        id: 'source:steel-sword',
        entityKind: 'catalog-equipment',
        entityId: 'steel-sword',
        sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/One-Handed',
        sourceRevision: '26216',
        candidateId: 'candidate:one-handed',
      },
      {
        id: 'source:attack-from-str',
        entityKind: 'mechanic',
        entityId: 'attack-from-str',
        sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
        sourceRevision: '23125',
        candidateId: 'candidate:stats',
      },
    ],
    candidates: [
      {
        id: 'candidate:one-handed',
        pageTitle: 'One-Handed',
        sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/One-Handed',
        revisionId: '26216',
        status: 'accepted',
      },
      {
        id: 'candidate:stats',
        pageTitle: 'Stats',
        sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
        revisionId: '23125',
        status: 'accepted',
      },
    ],
  };
}

describe('validateCatalogRelease', () => {
  it('accepts a complete sourced catalog release', () => {
    expect(validateCatalogRelease(validInput())).toEqual([]);
  });

  it.each([
    ['an orphan acquisition', (input: CatalogReleaseValidationInput) => { input.acquisitions[0]!.itemId = 'missing'; }, 'Acquisition steel-sword:shop has no catalog item'],
    ['a duplicate alias', (input: CatalogReleaseValidationInput) => {
      input.aliases.push({ id: 'alias:one', itemId: 'steel-sword', alias: 'Steel', sourceRefId: 'source:steel-sword', candidateId: 'candidate:one-handed' });
      input.aliases.push({ id: 'alias:two', itemId: 'steel-sword', alias: 'Steel', sourceRefId: 'source:steel-sword', candidateId: 'candidate:one-handed' });
    }, 'Duplicate alias for steel-sword: Steel'],
    ['an invalid resistance', (input: CatalogReleaseValidationInput) => {
      input.resistances.push({ id: 'resistance:poison', itemId: 'steel-sword', status: 'Poison', percent: 101, sourceRefId: 'source:steel-sword', candidateId: 'candidate:one-handed' });
    }, 'Resistance resistance:poison must be between 0 and 100'],
    ['missing verified attack', (input: CatalogReleaseValidationInput) => { input.equipment[0]!.attack = undefined; }, 'Verified catalog item steel-sword requires complete numeric stats'],
  ])('rejects %s', (_case, mutate, expected) => {
    const input = validInput();
    mutate(input);
    expect(validateCatalogRelease(input)).toContain(expected);
  });

  it('requires complete inventory accounting and the supported policy', () => {
    const input = validInput();
    input.manifest.unresolvedJson = JSON.stringify({ unaccountedPages: ['Mystery Helm'], unresolved: [] });
    input.policy.policyVersion = 'unreviewed-policy';

    expect(validateCatalogRelease(input)).toEqual(
      expect.arrayContaining([
        'Coverage manifest leaves 1 inventory page unaccounted for',
        'Strategy policy version is unsupported',
      ]),
    );
  });
});
