import type {
  EquipmentRecord,
  FormulaId,
  FormulaRecord,
} from '../../domain/dataset/model';
import type { EquipmentSlot, WeaponPath } from '../../domain/build/model';

export interface ParsedProposal<T> {
  value: T;
  sourceLine: string;
  warnings: string[];
}

export type ParsedProposalBatch<T> = ParsedProposal<T>[] & {
  warnings: string[];
};

type WikiRow = { cells: string[]; sourceLine: string };

function batch<T>(warnings: string[] = []): ParsedProposalBatch<T> {
  return Object.assign([] as ParsedProposal<T>[], { warnings });
}

function cleanWikiText(value: string): string {
  return value
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseStrictNumber(value: string): number | null {
  const cleaned = cleanWikiText(value);
  return /^\d+(?:\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

function parseTable(wikitext: string, expectedHeaders: string[]): WikiRow[] | null {
  const lines = wikitext.split(/\r?\n/);
  for (let start = 0; start < lines.length; start += 1) {
    if (!lines[start]?.trim().startsWith('{|')) continue;
    const headers: string[] = [];
    const rows: WikiRow[] = [];
    let cells: string[] = [];
    let source: string[] = [];
    for (let index = start + 1; index < lines.length; index += 1) {
      const line = lines[index]?.trim() ?? '';
      if (line === '|}') {
        if (cells.length > 0) rows.push({ cells, sourceLine: source.join(' ') });
        break;
      }
      if (line.startsWith('!')) {
        headers.push(...line.slice(1).split('!!').map(cleanWikiText));
        continue;
      }
      if (line === '|-') {
        if (cells.length > 0) rows.push({ cells, sourceLine: source.join(' ') });
        cells = [];
        source = [];
        continue;
      }
      if (line.startsWith('|')) {
        const raw = line.slice(1);
        cells.push(...raw.split('||').map((cell) => cell.trim()));
        source.push(line);
      }
    }
    if (
      expectedHeaders.length === headers.length &&
      expectedHeaders.every((header, index) => headers[index] === header)
    ) {
      return rows;
    }
  }
  return null;
}

function acquisition(raw: string): {
  acquisitionType: EquipmentRecord['acquisitionType'];
  detail: string;
  floor: number;
} | null {
  const detail = cleanWikiText(raw).replace(/\s*,\s*/g, ', ');
  const floors = [...detail.matchAll(/Floor (\d+)/gi)].map((match) =>
    Number(match[1]),
  );
  const floor = floors.length > 0 ? Math.min(...floors) : 1;
  if (/Starter Inventory/i.test(detail)) {
    return { acquisitionType: 'starter' as const, detail, floor };
  }
  if (/Shop/i.test(detail)) {
    return { acquisitionType: 'shop' as const, detail, floor };
  }
  if (/Blacksmith/i.test(detail)) {
    return { acquisitionType: 'crafting' as const, detail, floor };
  }
  if (/Boss/i.test(detail)) {
    return { acquisitionType: 'boss-drop' as const, detail, floor };
  }
  if (/(?:Mob|Monster|Drop)/i.test(detail)) {
    return { acquisitionType: 'mob-drop' as const, detail, floor };
  }
  if (/Quest/i.test(detail)) {
    return { acquisitionType: 'quest' as const, detail, floor };
  }
  if (/Event/i.test(detail)) {
    return { acquisitionType: 'event' as const, detail, floor };
  }
  if (/Badge/i.test(detail)) {
    return { acquisitionType: 'badge' as const, detail, floor };
  }
  if (/Gamepass/i.test(detail)) {
    return { acquisitionType: 'gamepass' as const, detail, floor };
  }
  return null;
}

function weaponPathsForPage(pageTitle: string): WeaponPath[] | null {
  const mapping: Record<string, WeaponPath[]> = {
    'One-Handed': ['one-handed', 'dual-wield'],
    'Two-Handed': ['two-handed'],
    Rapier: ['rapier'],
    Dagger: ['dagger'],
    Melee: ['melee'],
  };
  return mapping[pageTitle] ?? null;
}

function candidateEquipment(
  partial: Omit<
    EquipmentRecord,
    'lastReviewedAt' | 'verificationStatus'
  >,
): EquipmentRecord {
  return {
    ...partial,
    lastReviewedAt: '1970-01-01',
    verificationStatus: 'candidate',
  };
}

export function parseWeaponListPage(
  pageTitle: string,
  wikitext: string,
): ParsedProposalBatch<EquipmentRecord> {
  const result = batch<EquipmentRecord>();
  const paths = weaponPathsForPage(pageTitle);
  if (!paths) {
    result.warnings.push(`Unsupported weapon page: ${pageTitle}`);
    return result;
  }
  const rows = parseTable(wikitext, [
    'Equipment Name',
    'Skill',
    'Attack Stat',
    'How to Obtain',
  ]);
  if (!rows) {
    result.warnings.push('Expected weapon table headers were not found');
    return result;
  }
  for (const row of rows) {
    if (row.cells.length !== 4) {
      result.warnings.push(`Malformed weapon row: ${row.sourceLine}`);
      continue;
    }
    const [rawName, rawSkill, rawAttack, rawAcquisition] = row.cells as [
      string,
      string,
      string,
      string,
    ];
    const skill = parseStrictNumber(rawSkill);
    const attack = parseStrictNumber(rawAttack);
    if (skill === null) {
      result.warnings.push(`Invalid or ambiguous skill: ${row.sourceLine}`);
      continue;
    }
    if (attack === null) {
      result.warnings.push(`Invalid or ambiguous attack: ${row.sourceLine}`);
      continue;
    }
    const name = cleanWikiText(rawName);
    const obtained = acquisition(rawAcquisition);
    if (!obtained) {
      result.warnings.push(`Unrecognized acquisition: ${row.sourceLine}`);
      continue;
    }
    result.push({
      value: candidateEquipment({
        id: slugify(name),
        name,
        slot: 'main-hand',
        weaponPaths: paths,
        attack,
        defense: 0,
        dexterity: 0,
        levelRequirement: 1,
        skillRequirement: skill,
        floor: obtained.floor,
        acquisitionType: obtained.acquisitionType,
        acquisitionDetail: obtained.detail,
        availability: /Event/i.test(obtained.detail)
          ? 'inactive-event'
          : 'always',
        sourceUrl: `https://swordbloxonlinerebirth.fandom.com/wiki/${encodeURIComponent(pageTitle)}`,
      }),
      sourceLine: row.sourceLine,
      warnings: [],
    });
  }
  return result;
}

function parseArmorLikePage(
  slot: EquipmentSlot,
  pageTitle: string,
  wikitext: string,
): ParsedProposalBatch<EquipmentRecord> {
  const result = batch<EquipmentRecord>();
  const rows = parseTable(wikitext, [
    'Equipment Name',
    'Level',
    'Defense Stat',
    'Dexterity Stat',
    'How to Obtain',
  ]);
  if (!rows) {
    result.warnings.push('Expected equipment table headers were not found');
    return result;
  }
  for (const row of rows) {
    if (row.cells.length !== 5) {
      result.warnings.push(`Malformed equipment row: ${row.sourceLine}`);
      continue;
    }
    const [rawName, rawLevel, rawDefense, rawDexterity, rawAcquisition] =
      row.cells as [string, string, string, string, string];
    const level = parseStrictNumber(rawLevel);
    const defense = parseStrictNumber(rawDefense);
    const dexterity = parseStrictNumber(rawDexterity);
    if (level === null) {
      result.warnings.push(`Invalid level: ${row.sourceLine}`);
      continue;
    }
    if (defense === null) {
      result.warnings.push(`Invalid defense: ${row.sourceLine}`);
      continue;
    }
    if (dexterity === null) {
      result.warnings.push(`Invalid dexterity: ${row.sourceLine}`);
      continue;
    }
    const name = cleanWikiText(rawName);
    const obtained = acquisition(rawAcquisition);
    if (!obtained) {
      result.warnings.push(`Unrecognized acquisition: ${row.sourceLine}`);
      continue;
    }
    result.push({
      value: candidateEquipment({
        id: slugify(name),
        name,
        slot,
        weaponPaths: [],
        attack: 0,
        defense,
        dexterity,
        levelRequirement: level,
        floor: obtained.floor,
        acquisitionType: obtained.acquisitionType,
        acquisitionDetail: obtained.detail,
        availability: /Event/i.test(obtained.detail)
          ? 'inactive-event'
          : 'always',
        sourceUrl: `https://swordbloxonlinerebirth.fandom.com/wiki/${encodeURIComponent(pageTitle)}`,
      }),
      sourceLine: row.sourceLine,
      warnings: [],
    });
  }
  return result;
}

export function parseArmorListPage(
  wikitext: string,
): ParsedProposalBatch<EquipmentRecord> {
  return parseArmorLikePage('armor', 'Armor', wikitext);
}

export function parseShieldListPage(
  wikitext: string,
): ParsedProposalBatch<EquipmentRecord> {
  return parseArmorLikePage('shield', 'Shields', wikitext);
}

export function parseHeadwearListPage(
  slot: 'upper-head' | 'lower-head',
  wikitext: string,
): ParsedProposalBatch<EquipmentRecord> {
  return parseArmorLikePage(
    slot,
    slot === 'upper-head' ? 'Upper Headwear' : 'Lower Headwear',
    wikitext,
  );
}

function formula(
  id: FormulaId,
  expression: string,
  units: string,
  boundaryBehavior: string,
  sourceLine: string,
): ParsedProposal<FormulaRecord> {
  return {
    value: {
      id,
      expression,
      units,
      applicability: 'All player builds',
      boundaryBehavior,
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Stats',
      lastReviewedAt: '1970-01-01',
      verificationStatus: 'candidate',
    },
    sourceLine,
    warnings: [],
  };
}

function sourceLine(wikitext: string, pattern: RegExp): string | null {
  return (
    wikitext
      .split(/\r?\n/)
      .map((line) => cleanWikiText(line))
      .find((line) => pattern.test(line)) ?? null
  );
}

export function parseStatsPage(
  wikitext: string,
): ParsedProposalBatch<FormulaRecord> {
  const result = batch<FormulaRecord>();
  const str = sourceLine(wikitext, /STR invested is a 0\.4% increase/i);
  const def = sourceLine(wikitext, /DEF invested adds 0\.01/i);
  const agi = sourceLine(wikitext, /\+0\.004 stud\/s walk speed/i);
  const vit = sourceLine(wikitext, /VIT invested increases.*0\.01/i);
  const crit = sourceLine(wikitext, /0\.01% chance towards critical hits/i);
  const drop = sourceLine(wikitext, /0\.01% chance for items to drop/i);

  if (str) {
    result.push(
      formula(
        'attack-from-str',
        'attack = gearAttack × (1 + min(STR, 500) × 0.004)',
        'damage per hit',
        'STR contribution caps at 500 invested points.',
        str,
      ),
    );
  } else result.warnings.push('STR damage rule was not recognized');
  if (def) {
    result.push(
      formula(
        'damage-reduction-from-def',
        'reduction = gearDefense × (5 + min(DEF, 500) × 0.01)',
        'flat damage reduction per hit',
        'DEF contribution caps at 500 invested points.',
        def,
      ),
    );
  } else result.warnings.push('DEF reduction rule was not recognized');
  if (vit) {
    result.push(
      formula(
        'bonus-hp-from-vit',
        'bonusHp = gearDexterity × (10 + min(VIT, 500) × 0.01)',
        'bonus hit points',
        'VIT contribution caps at 500 invested points.',
        vit,
      ),
    );
  } else result.warnings.push('VIT bonus HP rule was not recognized');
  if (str && agi && vit) {
    result.push(
      formula(
        'stamina',
        'stamina = 100 + level × 5 + 0.1 × (STR + AGI + VIT)',
        'stamina',
        'STR, AGI, and VIT contributions each cap at 500 invested points.',
        `${str} ${agi} ${vit}`,
      ),
    );
  } else result.warnings.push('Combined stamina rule was not recognized');
  if (agi) {
    result.push(
      formula(
        'walk-speed-from-agi',
        'walkSpeedBonus = min(AGI, 500) × 0.004',
        'studs per second',
        'AGI contribution caps at 500 invested points.',
        agi,
      ),
      formula(
        'sprint-speed-from-agi',
        'sprintSpeedBonus = min(AGI, 500) × 0.02',
        'studs per second',
        'AGI contribution caps at 500 invested points.',
        agi,
      ),
    );
  } else result.warnings.push('AGI movement rules were not recognized');
  if (crit) {
    result.push(
      formula(
        'crit-bonus-from-luk',
        'critChanceBonus = min(LUK × 0.0001, 0.05)',
        'probability',
        'Bonus critical chance caps at 5%.',
        crit,
      ),
    );
  } else result.warnings.push('LUK critical rule was not recognized');
  if (drop) {
    result.push(
      formula(
        'drop-bonus-from-luk',
        'dropChanceBonus = min(LUK × 0.0001, 0.05)',
        'probability',
        'Bonus drop chance caps at 5%.',
        drop,
      ),
    );
  } else result.warnings.push('LUK drop rule was not recognized');

  const points = sourceLine(
    wikitext,
    /(?:receive|gain|awarded?)\s+3\s+stat points? per level/i,
  );
  if (points) {
    result.unshift(
      formula(
        'points-per-level',
        'points = levels × 3',
        'stat points',
        'Three points are awarded per level.',
        points,
      ),
    );
  } else {
    result.warnings.push(
      'The canonical source does not state points awarded per level',
    );
  }
  return result;
}
