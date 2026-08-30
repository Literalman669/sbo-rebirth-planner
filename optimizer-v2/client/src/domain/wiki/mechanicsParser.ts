import type { MechanicRecord } from '../dataset/model';
import type { WikiPageSnapshot } from './model';

export interface ParsedMechanicsPage {
  page: WikiPageSnapshot;
  mechanics: MechanicRecord[];
  warnings: string[];
}

function has(content: string, pattern: RegExp) {
  return pattern.test(content);
}

function record(
  page: WikiPageSnapshot,
  input: Omit<
    MechanicRecord,
    | 'sourceUrl'
    | 'sourceRevision'
    | 'lastReviewedAt'
    | 'verificationStatus'
  >,
): MechanicRecord {
  return {
    ...input,
    sourceUrl: page.sourceUrl,
    sourceRevision: page.revisionId,
    lastReviewedAt: page.revisionTimestamp.slice(0, 10),
    verificationStatus: 'verified',
  };
}

export function parseMechanicsSnapshot(
  page: WikiPageSnapshot,
): ParsedMechanicsPage {
  if (page.pageTitle !== 'Stats') {
    return {
      page,
      mechanics: [],
      warnings: [`Unsupported mechanics page: ${page.pageTitle}`],
    };
  }

  const content = page.content;
  const mechanics: MechanicRecord[] = [];
  const warnings: string[] = [];
  const exact = (
    recognized: boolean,
    input: Parameters<typeof record>[1],
    warning: string,
  ) => {
    if (recognized) mechanics.push(record(page, input));
    else warnings.push(warning);
  };

  exact(
    has(content, /STR invested is a 0\.4% increase/i),
    {
      id: 'attack-from-str',
      expression: 'attack = gearAttack × (1 + min(STR, 500) × 0.004)',
      units: 'damage per hit',
      applicability: 'All player builds',
      boundaryBehavior: 'STR contribution caps at 500 invested points.',
      computability: 'exact',
      parameters: { statCap: 500, damagePerStr: 0.004 },
    },
    'STR damage rule was not recognized',
  );
  exact(
    has(content, /DEF invested adds 0\.01/i),
    {
      id: 'damage-reduction-from-def',
      expression: 'reduction = gearDefense × (5 + min(DEF, 500) × 0.01)',
      units: 'flat damage reduction per hit',
      applicability: 'All player builds',
      boundaryBehavior: 'DEF contribution caps at 500 invested points.',
      computability: 'exact',
      parameters: {
        statCap: 500,
        baseDefenseMultiplier: 5,
        defenseMultiplierPerDef: 0.01,
      },
    },
    'DEF reduction rule was not recognized',
  );
  exact(
    has(content, /VIT invested increases.*Dexterity by 0\.01/i),
    {
      id: 'bonus-hp-from-vit',
      expression: 'bonusHp = gearDexterity × (10 + min(VIT, 500) × 0.01)',
      units: 'bonus hit points',
      applicability: 'All player builds',
      boundaryBehavior: 'VIT contribution caps at 500 invested points.',
      computability: 'exact',
      parameters: {
        statCap: 500,
        dexHpBaseMultiplier: 10,
        dexHpMultiplierPerVit: 0.01,
      },
    },
    'VIT bonus HP rule was not recognized',
  );
  exact(
    has(content, /100 \+ \(Player Level \* 5\)/i) &&
      has(content, /\+0\.1 stamina/i),
    {
      id: 'stamina',
      expression: 'stamina = 100 + level × 5 + 0.1 × (STR + AGI + VIT)',
      units: 'stamina',
      applicability: 'All player builds',
      boundaryBehavior: 'STR, AGI, and VIT contributions each cap at 500.',
      computability: 'exact',
      parameters: {
        statCap: 500,
        staminaBase: 100,
        staminaPerLevel: 5,
        staminaPerStrAgiVitPoint: 0.1,
      },
    },
    'Combined stamina rule was not recognized',
  );
  exact(
    has(content, /\+0\.004 stud\/s walk speed/i),
    {
      id: 'walk-speed-from-agi',
      expression: 'walkSpeedBonus = min(AGI, 500) × 0.004',
      units: 'studs per second',
      applicability: 'All player builds',
      boundaryBehavior: 'AGI contribution caps at 500 invested points.',
      computability: 'exact',
      parameters: { statCap: 500, walkSpeedPerAgi: 0.004 },
    },
    'AGI walk-speed rule was not recognized',
  );
  exact(
    has(content, /\+0\.02 stud\/s sprint speed/i),
    {
      id: 'sprint-speed-from-agi',
      expression: 'sprintSpeedBonus = min(AGI, 500) × 0.02',
      units: 'studs per second',
      applicability: 'All player builds',
      boundaryBehavior: 'AGI contribution caps at 500 invested points.',
      computability: 'exact',
      parameters: { statCap: 500, sprintSpeedPerAgi: 0.02 },
    },
    'AGI sprint-speed rule was not recognized',
  );
  exact(
    has(content, /0\.01% chance towards critical hits/i),
    {
      id: 'crit-bonus-from-luk',
      expression: 'critChanceBonus = min(LUK × 0.0001, 0.05)',
      units: 'probability',
      applicability: 'All player builds',
      boundaryBehavior: 'Bonus critical chance caps at 5%.',
      computability: 'exact',
      parameters: { statCap: 500, critPerLuk: 0.0001, critCap: 0.05 },
    },
    'LUK critical rule was not recognized',
  );
  exact(
    has(content, /0\.01% chance for items to drop/i),
    {
      id: 'drop-bonus-from-luk',
      expression: 'dropChanceBonus = min(LUK × 0.0001, 0.05)',
      units: 'probability',
      applicability: 'All player builds',
      boundaryBehavior: 'Bonus drop chance caps at 5%.',
      computability: 'exact',
      parameters: { statCap: 500, dropPerLuk: 0.0001, dropCap: 0.05 },
    },
    'LUK drop rule was not recognized',
  );
  exact(
    has(content, /Multi-hitting enemies increases by 0\.02%/i) &&
      has(content, /cannot exceed 15%/i),
    {
      id: 'multi-hit-from-str-luk',
      expression:
        'multiHitBonus = min(min(STR × 0.0002, 0.10) + min(LUK × 0.0002, 0.10), 0.15)',
      units: 'probability',
      applicability: 'All player builds with a multi-hit-capable weapon',
      boundaryBehavior: 'Each stat adds at most 10%; combined bonus caps at 15%.',
      computability: 'exact',
      parameters: {
        statCap: 500,
        bonusPerPoint: 0.0002,
        individualCap: 0.1,
        combinedCap: 0.15,
      },
    },
    'STR/LUK multi-hit rule was not recognized',
  );
  exact(
    has(content, /VIT gives \+0\.01% resistance/i),
    {
      id: 'resistance-from-vit',
      expression: 'debuffResistanceBonus = min(VIT × 0.0001, 0.05)',
      units: 'probability',
      applicability: 'All player builds',
      boundaryBehavior: 'VIT resistance caps at 5%.',
      computability: 'exact',
      parameters: { statCap: 500, bonusPerVit: 0.0001, cap: 0.05 },
    },
    'VIT resistance rule was not recognized',
  );

  if (has(content, /approximately -0\.001s jump delay/i)) {
    mechanics.push(
      record(page, {
        id: 'jump-delay-from-agi',
        expression: 'Approximate jump-delay reduction from AGI',
        units: 'seconds',
        applicability: 'All player builds',
        boundaryBehavior: 'The source explicitly describes the rate as approximate.',
        computability: 'descriptive',
        parameters: {},
      }),
    );
  }
  if (has(content, /attack intervals.*approximate rates/i)) {
    mechanics.push(
      record(page, {
        id: 'attack-interval-from-agi',
        expression: 'Weapon-path attack interval changes from AGI',
        units: 'seconds',
        applicability: 'Weapon-path specific',
        boundaryBehavior: 'The source gives approximate endpoints, not an exact function.',
        computability: 'descriptive',
        parameters: {},
      }),
    );
  }
  if (has(content, /additional drop chance.*Base Chance x 2.*\+5%/i)) {
    mechanics.push(
      record(page, {
        id: 'drop-reroll-at-luk-cap',
        expression: 'Failed drop receives an additional chance described as (Base Chance × 2) + 5%',
        units: 'probability',
        applicability: 'Builds at 500 LUK',
        boundaryBehavior: 'The source does not fully specify the base-roll pipeline.',
        computability: 'descriptive',
        parameters: {},
      }),
    );
  }

  return { page, mechanics, warnings };
}
