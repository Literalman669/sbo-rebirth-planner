import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseCoverage } from './validate-release-coverage.mjs';

const formulaIds = [
  'points-per-level',
  'attack-from-str',
  'damage-reduction-from-def',
  'bonus-hp-from-vit',
  'stamina',
  'walk-speed-from-agi',
  'sprint-speed-from-agi',
  'crit-bonus-from-luk',
  'drop-bonus-from-luk',
];
const paths = [
  'two-handed',
  'one-handed',
  'rapier',
  'dagger',
  'dual-wield',
  'melee',
];
const bands = [
  ['1-49', 1],
  ['50-99', 50],
  ['100-149', 100],
  ['150-199', 150],
  ['200-249', 200],
  ['250-299', 250],
  ['300+', 300],
];
const canonical = 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats';

function completeRelease() {
  const equipment = paths.flatMap((path) =>
    bands
      .filter(([label]) => path !== 'dual-wield' || !['1-49', '50-99', '100-149', '150-199'].includes(label))
      .map(([label, requirement]) => ({
        id: `${path}-${label}`,
        slot: 'main-hand',
        weaponPaths: path === 'one-handed' ? ['one-handed', 'dual-wield'] : [path],
        skillRequirement: requirement,
        levelRequirement: 1,
        acquisitionType: requirement === 1 ? 'starter' : 'shop',
        availability: 'always',
        sourceUrl: canonical,
        verificationStatus: 'verified',
      })),
  );
  equipment.push(
    {
      id: 'beginner-armor',
      slot: 'armor',
      weaponPaths: [],
      levelRequirement: 1,
      acquisitionType: 'starter',
      availability: 'always',
      sourceUrl: canonical,
      verificationStatus: 'verified',
    },
    {
      id: 'wooden-shield',
      slot: 'shield',
      weaponPaths: ['one-handed', 'rapier', 'dagger'],
      levelRequirement: 1,
      acquisitionType: 'starter',
      availability: 'always',
      sourceUrl: canonical,
      verificationStatus: 'verified',
    },
  );
  return {
    dualWieldSkillGate: 200,
    formulas: formulaIds.map((id) => ({
      id,
      sourceUrl: canonical,
      verificationStatus: 'verified',
    })),
    equipment,
    knownGaps: [],
  };
}

test('accepts complete verified path and progression coverage', () => {
  assert.deepEqual(validateReleaseCoverage(completeRelease()), []);
});

test('does not count inactive event equipment as obtainable coverage', () => {
  const release = completeRelease();
  release.equipment.find((item) => item.id === 'rapier-250-299').availability =
    'inactive-event';

  assert.ok(
    validateReleaseCoverage(release).includes(
      'Missing rapier coverage for progression band 250-299',
    ),
  );
});

test('accepts an explicit reviewed canonical known gap', () => {
  const release = completeRelease();
  release.equipment = release.equipment.filter(
    (item) => item.id !== 'melee-300+',
  );
  release.knownGaps.push({
    path: 'melee',
    band: '300+',
    reason: 'The current Melee table contains no non-event item in this band.',
    sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Melee',
    sourceRevision: '26211',
    lastReviewedAt: '2026-08-29',
    verificationStatus: 'verified',
  });

  assert.deepEqual(validateReleaseCoverage(release), []);
});

test('rejects non-canonical formula provenance', () => {
  const release = completeRelease();
  release.formulas[0].sourceUrl = 'https://example.com/points';

  assert.ok(
    validateReleaseCoverage(release).includes(
      'Formula points-per-level is not canonically sourced',
    ),
  );
});
