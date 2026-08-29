const reviewedAt = '2026-08-29';
const publishedAt = '2026-08-29T00:00:00.000Z';
const wiki = 'https://swordbloxonlinerebirth.fandom.com/wiki';
const officialGame =
  'https://www.roblox.com/games/4733278992/Sword-Blox-Online-Rebirth';

export const sourceRevisions = {
  Stats: '23125',
  'One-Handed': '26216',
  'Two-Handed': '26187',
  Rapier: '26275',
  Dagger: '26212',
  Melee: '22893',
  Fists: '21749',
  Armor: '26210',
  Shields: '25332',
};

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function weapon(name, pageTitle, paths, skill, attack, floor) {
  const starter = skill === 1;
  return {
    id: slug(name),
    name,
    slot: 'main-hand',
    weaponPaths: paths,
    attack,
    defense: 0,
    dexterity: 0,
    levelRequirement: 1,
    skillRequirement: skill,
    floor,
    acquisitionType: starter ? 'starter' : 'shop',
    acquisitionDetail: starter
      ? `Starter Inventory${floor === 1 && name !== 'Beginner Sword' ? ', Floor 1 Shop' : ''}`
      : `Floor ${floor} Shop`,
    availability: 'always',
    sourceUrl: `${wiki}/${pageTitle}`,
    sourceRevision: sourceRevisions[pageTitle],
    sourcePage: pageTitle,
    lastReviewedAt: reviewedAt,
    verificationStatus: 'verified',
  };
}

const progressionWeapons = [
  ...[
    ['Beginner Sword', 1, 3.4, 1],
    ['Steel Sword', 5, 8.4, 1],
    ['Mirror Blade', 65, 200, 5],
    ['Chimera', 105, 385, 7],
    ['Butterfly Blade', 165, 714, 10],
    ['Stalhrim Blade', 205, 961, 12],
    ['Sweet Blade', 305, 1655, 17],
  ].map(([name, skill, attack, floor]) =>
    weapon(
      name,
      'One-Handed',
      ['one-handed', 'dual-wield'],
      skill,
      attack,
      floor,
    ),
  ),
  ...[
    ['Iron Greatsword', 1, 3, 1],
    ['Steel Greatsword', 5, 10, 1],
    ['Mirror Shatterer', 65, 300, 5],
    ['Inyo Buster', 105, 481, 7],
    ['Butterfly Buster', 165, 892, 10],
    ['Stalhrim Greatsword', 205, 1201, 12],
    ['Sweet Buster', 305, 2068, 17],
  ].map(([name, skill, attack, floor]) =>
    weapon(name, 'Two-Handed', ['two-handed'], skill, attack, floor),
  ),
  ...[
    ['Iron Rapier', 1, 2.6, 1],
    ['Steel Rapier', 5, 7.6, 1],
    ['Mirror Rapier', 65, 175, 5],
    ['Inyo Striker', 105, 337, 7],
    ['Butterfly Rapier', 165, 624, 10],
    ['Stalhrim Lance', 205, 840, 12],
    ['Sweet Rapier', 305, 1448, 17],
  ].map(([name, skill, attack, floor]) =>
    weapon(name, 'Rapier', ['rapier'], skill, attack, floor),
  ),
  ...[
    ['Iron Dagger', 1, 2.5, 1],
    ['Steel Dagger', 5, 7.5, 1],
    ['Mirror Dagger', 65, 162, 5],
    ['Beta Slasher', 105, 313, 7],
    ['Butterfly Dagger', 165, 580, 10],
    ['Stalhrim Dagger', 205, 780, 12],
    ['Sweet Dagger', 305, 1344, 17],
  ].map(([name, skill, attack, floor]) =>
    weapon(name, 'Dagger', ['dagger'], skill, attack, floor),
  ),
];

const fists = {
  ...weapon('Fists', 'Fists', ['melee'], 1, 2.5, 1),
  acquisitionDetail: 'Starter Inventory',
};

const armor = {
  id: 'beginner-armor',
  name: 'Beginner Armor',
  slot: 'armor',
  weaponPaths: [],
  attack: 0,
  defense: 0.5,
  dexterity: 3,
  levelRequirement: 1,
  floor: 1,
  acquisitionType: 'starter',
  acquisitionDetail: 'Starter Inventory, Floor 1 Shop',
  availability: 'always',
  sourceUrl: `${wiki}/Armor`,
  sourceRevision: sourceRevisions.Armor,
  sourcePage: 'Armor',
  lastReviewedAt: reviewedAt,
  verificationStatus: 'verified',
};

const fieldsWarrior = {
  ...armor,
  id: 'fields-warrior',
  name: 'Fields Warrior',
  defense: 1.5,
  dexterity: 6,
  levelRequirement: 3,
  acquisitionType: 'shop',
  acquisitionDetail: 'Floor 1 Shop, Floor 2 Shop',
};

const shield = {
  id: 'wooden-shield',
  name: 'Wooden Shield',
  slot: 'shield',
  weaponPaths: ['one-handed', 'rapier', 'dagger'],
  attack: 0,
  defense: 0.6,
  dexterity: 0,
  levelRequirement: 1,
  floor: 1,
  acquisitionType: 'starter',
  acquisitionDetail: 'Starter Inventory, Floor 1 Shop',
  availability: 'always',
  sourceUrl: `${wiki}/Shields`,
  sourceRevision: sourceRevisions.Shields,
  sourcePage: 'Shields',
  lastReviewedAt: reviewedAt,
  verificationStatus: 'verified',
};

const masterShield = {
  ...shield,
  id: 'master-shield',
  name: 'Master Shield',
  defense: 3.3,
  levelRequirement: 10,
  acquisitionType: 'shop',
  acquisitionDetail: 'Floor 1 Shop, Floor 2 Shop',
};

function formula(id, expression, units, boundaryBehavior, source = {}) {
  return {
    id,
    expression,
    units,
    applicability: 'All player builds',
    boundaryBehavior,
    sourceUrl: source.sourceUrl ?? `${wiki}/Stats`,
    sourceRevision: source.sourceRevision ?? sourceRevisions.Stats,
    sourcePage: 'Stats',
    lastReviewedAt: reviewedAt,
    verificationStatus: 'verified',
  };
}

const formulas = [
  formula(
    'points-per-level',
    'points = levels × 3',
    'stat points',
    'Three points are awarded per level.',
    {
      sourceUrl: officialGame,
      sourceRevision: `owner-gameplay-attestation:${reviewedAt}`,
    },
  ),
  formula(
    'attack-from-str',
    'attack = gearAttack × (1 + min(STR, 500) × 0.004)',
    'damage per hit',
    'STR contribution caps at 500 invested points.',
  ),
  formula(
    'damage-reduction-from-def',
    'reduction = gearDefense × (5 + min(DEF, 500) × 0.01)',
    'flat damage reduction per hit',
    'DEF contribution caps at 500 invested points.',
  ),
  formula(
    'bonus-hp-from-vit',
    'bonusHp = gearDexterity × (10 + min(VIT, 500) × 0.01)',
    'bonus hit points',
    'VIT contribution caps at 500 invested points.',
  ),
  formula(
    'stamina',
    'stamina = 100 + level × 5 + 0.1 × (STR + AGI + VIT)',
    'stamina',
    'STR, AGI, and VIT contributions each cap at 500 invested points.',
  ),
  formula(
    'walk-speed-from-agi',
    'walkSpeedBonus = min(AGI, 500) × 0.004',
    'studs per second',
    'AGI contribution caps at 500 invested points.',
  ),
  formula(
    'sprint-speed-from-agi',
    'sprintSpeedBonus = min(AGI, 500) × 0.02',
    'studs per second',
    'AGI contribution caps at 500 invested points.',
  ),
  formula(
    'crit-bonus-from-luk',
    'critChanceBonus = min(LUK × 0.0001, 0.05)',
    'probability',
    'Bonus critical chance caps at 5%.',
  ),
  formula(
    'drop-bonus-from-luk',
    'dropChanceBonus = min(LUK × 0.0001, 0.05)',
    'probability',
    'Bonus drop chance caps at 5%.',
  ),
];

function gap(path, band, pageTitle) {
  return {
    path,
    band,
    reason:
      'No verified obtainable upgrade is present in this progression band in the current canonical table.',
    sourceUrl: `${wiki}/${pageTitle}`,
    sourceRevision: sourceRevisions[pageTitle],
    sourcePage: pageTitle,
    lastReviewedAt: reviewedAt,
    verificationStatus: 'verified',
  };
}

const knownGaps = [
  gap('two-handed', '250-299', 'Two-Handed'),
  gap('one-handed', '250-299', 'One-Handed'),
  gap('rapier', '250-299', 'Rapier'),
  gap('dagger', '250-299', 'Dagger'),
  gap('dual-wield', '250-299', 'One-Handed'),
  ...['50-99', '100-149', '150-199', '200-249', '250-299', '300+'].map(
    (band) => gap('melee', band, 'Melee'),
  ),
];

export const firstReleaseSnapshot = {
  version: '2026.08.29.1',
  publishedAt,
  lastReviewedAt: reviewedAt,
  sourceSummary:
    'Current canonical progression tables, Stats revision 23125, and an owner gameplay attestation for three stat points per level.',
  formulaSetVersion: 'sbor-stats-v1',
  pointsPerLevel: 3,
  dualWieldSkillGate: 200,
  formulas,
  equipment: [
    ...progressionWeapons,
    fists,
    armor,
    fieldsWarrior,
    shield,
    masterShield,
  ],
  knownGaps,
};
