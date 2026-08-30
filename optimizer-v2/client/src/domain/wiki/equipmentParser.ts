import type {
  AcquisitionType,
  CatalogAccessType,
  CatalogAvailability,
  CatalogEquipmentRecord,
  EquipmentRecord,
} from '../dataset/model';
import type { EquipmentSlot, WeaponPath } from '../build/model';
import {
  parseArmorListPage,
  parseHeadwearListPage,
  parseShieldListPage,
  parseWeaponListPage,
  type ParsedProposalBatch,
} from '../../features/curation/wikiTableParser';
import type { WikiPageSnapshot } from './model';

export interface ParsedCatalogPage {
  page: WikiPageSnapshot;
  equipment: CatalogEquipmentRecord[];
  aliases: Array<{ alias: string; itemId: string; sourceLine: string }>;
  warnings: string[];
  unresolved: Array<{
    pageTitle: string;
    reason: string;
    sourceLine?: string;
  }>;
}

function cleanWikiText(value: string) {
  return value
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function dateOnly(timestamp: string) {
  return timestamp.slice(0, 10);
}

function acquisitionAccess(type: AcquisitionType): {
  availability: CatalogAvailability;
  accessType: CatalogAccessType;
} {
  if (type === 'gamepass') {
    return { availability: 'gamepass', accessType: 'gamepass' };
  }
  if (type === 'badge') {
    return { availability: 'badge', accessType: 'badge' };
  }
  if (type === 'event') {
    return { availability: 'inactive-event', accessType: 'event' };
  }
  return { availability: 'always', accessType: 'free' };
}

function catalogFromProposal(
  item: EquipmentRecord,
  page: WikiPageSnapshot,
): CatalogEquipmentRecord {
  const access = acquisitionAccess(item.acquisitionType);
  return {
    id: item.id,
    name: item.name,
    aliases: [],
    slot: item.slot,
    weaponPaths: [...item.weaponPaths],
    attack: item.attack,
    defense: item.defense,
    dexterity: item.dexterity,
    levelRequirement: item.levelRequirement,
    skillRequirement: item.skillRequirement,
    acquisitions: [
      {
        id: `${item.id}:acquisition:0`,
        type: item.acquisitionType,
        detail: item.acquisitionDetail,
        floor: item.floor,
        ...access,
        sourceUrl: page.sourceUrl,
        sourceRevision: page.revisionId,
      },
    ],
    resistances: [],
    specialEffects: [],
    verificationStatus: 'verified',
    sourceUrl: page.sourceUrl,
    sourceRevision: page.revisionId,
    lastReviewedAt: dateOnly(page.revisionTimestamp),
  };
}

function resultFromBatch(
  page: WikiPageSnapshot,
  proposals: ParsedProposalBatch<EquipmentRecord>,
): ParsedCatalogPage {
  return {
    page,
    equipment: proposals.map(({ value }) => catalogFromProposal(value, page)),
    aliases: [],
    warnings: [...proposals.warnings],
    unresolved: proposals.warnings.map((reason) => ({
      pageTitle: page.pageTitle,
      reason,
    })),
  };
}

function infoboxValues(content: string) {
  const values = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = /^\|\s*([^=|]+?)\s*=\s*(.*?)\s*$/.exec(line.trim());
    if (match) values.set(match[1]!.trim().toLowerCase(), cleanWikiText(match[2]!));
  }
  return values;
}

function first(values: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = values.get(key.toLowerCase());
    if (value) return value;
  }
  return undefined;
}

function strictNumber(value: string | undefined) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  return Number(value);
}

function slotAndPaths(type: string | undefined): {
  slot: EquipmentSlot;
  paths: WeaponPath[];
  weapon: boolean;
} | null {
  if (!type) return null;
  if (/one[ -]?handed/i.test(type)) {
    return {
      slot: 'main-hand',
      paths: ['one-handed', 'dual-wield'],
      weapon: true,
    };
  }
  if (/two[ -]?handed|greatsword/i.test(type)) {
    return { slot: 'main-hand', paths: ['two-handed'], weapon: true };
  }
  if (/rapier/i.test(type)) {
    return { slot: 'main-hand', paths: ['rapier'], weapon: true };
  }
  if (/dagger/i.test(type)) {
    return { slot: 'main-hand', paths: ['dagger'], weapon: true };
  }
  if (/melee|fists/i.test(type)) {
    return { slot: 'main-hand', paths: ['melee'], weapon: true };
  }
  if (/shield/i.test(type)) {
    return {
      slot: 'shield',
      paths: ['one-handed', 'rapier', 'dagger'],
      weapon: false,
    };
  }
  if (/upper.*headwear/i.test(type)) {
    return { slot: 'upper-head', paths: [], weapon: false };
  }
  if (/lower.*headwear/i.test(type)) {
    return { slot: 'lower-head', paths: [], weapon: false };
  }
  if (/armor/i.test(type)) {
    return { slot: 'armor', paths: [], weapon: false };
  }
  return null;
}

function parseAcquisition(
  detail: string | undefined,
  page: WikiPageSnapshot,
  itemId: string,
) {
  if (!detail) return null;
  let type: AcquisitionType;
  if (/gamepass/i.test(detail)) type = 'gamepass';
  else if (/badge/i.test(detail)) type = 'badge';
  else if (/event/i.test(detail)) type = 'event';
  else if (/starter inventory/i.test(detail)) type = 'starter';
  else if (/shop/i.test(detail)) type = 'shop';
  else if (/blacksmith|craft/i.test(detail)) type = 'crafting';
  else if (/boss/i.test(detail)) type = 'boss-drop';
  else if (/mob|monster|drop/i.test(detail)) type = 'mob-drop';
  else if (/quest/i.test(detail)) type = 'quest';
  else return null;

  const floor = /Floor\s+(\d+)/i.exec(detail)?.[1];
  const price = /(\d[\d,]*)\s*(Col|Robux)/i.exec(detail);
  const access = acquisitionAccess(type);
  return {
    id: `${itemId}:acquisition:0`,
    type,
    detail,
    ...(floor ? { floor: Number(floor) } : {}),
    ...(price
      ? { cost: Number(price[1]!.replace(/,/g, '')), currency: price[2]! }
      : {}),
    ...access,
    sourceUrl: page.sourceUrl,
    sourceRevision: page.revisionId,
  };
}

function parseInfobox(page: WikiPageSnapshot): ParsedCatalogPage {
  const values = infoboxValues(page.content);
  const type = first(values, ['equipment type', 'weapon type', 'type']);
  const compatibility = slotAndPaths(type);
  const canonicalName = page.redirectTarget ?? page.pageTitle;
  const id = slugify(canonicalName);
  if (!compatibility) {
    return {
      page,
      equipment: [],
      aliases: [],
      warnings: [],
      unresolved: [
        {
          pageTitle: page.pageTitle,
          reason: 'Unsupported or missing equipment type in item infobox',
        },
      ],
    };
  }

  const attack = strictNumber(
    first(values, ['attack damage', 'attack stat', 'attack']),
  );
  const defense = strictNumber(
    first(values, ['defense stat', 'defense']),
  );
  const dexterity = strictNumber(
    first(values, ['dexterity stat', 'dexterity']),
  );
  const level = strictNumber(first(values, ['level requirement', 'level']));
  const skill = strictNumber(first(values, ['max skill', 'skill level']));
  const acquisition = parseAcquisition(
    first(values, ['how to obtain', 'obtain', 'location']),
    page,
    id,
  );

  const item: CatalogEquipmentRecord = {
    id,
    name: canonicalName,
    aliases:
      page.redirectTarget && page.redirectTarget !== page.pageTitle
        ? [page.pageTitle]
        : [],
    slot: compatibility.slot,
    weaponPaths: compatibility.paths,
    attack: compatibility.weapon ? attack : 0,
    defense: compatibility.weapon ? 0 : defense,
    dexterity:
      compatibility.slot === 'shield' || compatibility.weapon
        ? 0
        : dexterity,
    levelRequirement: level,
    ...(skill !== null ? { skillRequirement: skill } : {}),
    acquisitions: acquisition ? [acquisition] : [],
    resistances: [],
    specialEffects: [],
    verificationStatus:
      (compatibility.weapon ? attack !== null && skill !== null : defense !== null) &&
      level !== null &&
      acquisition
        ? 'verified'
        : 'partial',
    sourceUrl: page.sourceUrl,
    sourceRevision: page.revisionId,
    lastReviewedAt: dateOnly(page.revisionTimestamp),
  };
  const missing = [
    ...(compatibility.weapon && attack === null ? ['attack'] : []),
    ...(!compatibility.weapon && defense === null ? ['defense'] : []),
    ...(level === null ? ['level'] : []),
    ...(!acquisition ? ['acquisition'] : []),
  ];
  return {
    page,
    equipment: [item],
    aliases:
      page.redirectTarget && page.redirectTarget !== page.pageTitle
        ? [
            {
              alias: page.pageTitle,
              itemId: id,
              sourceLine: `Redirects to ${page.redirectTarget}`,
            },
          ]
        : [],
    warnings: [],
    unresolved: missing.length
      ? [
          {
            pageTitle: page.pageTitle,
            reason: `Item infobox omits or obscures required fields: ${missing.join(', ')}`,
          },
        ]
      : [],
  };
}

export function parseEquipmentSnapshot(
  page: WikiPageSnapshot,
): ParsedCatalogPage {
  if (page.pageTitle === 'Armor') {
    return resultFromBatch(page, parseArmorListPage(page.content));
  }
  if (page.pageTitle === 'Shields') {
    return resultFromBatch(page, parseShieldListPage(page.content));
  }
  if (page.pageTitle === 'Upper Headwear') {
    return resultFromBatch(
      page,
      parseHeadwearListPage('upper-head', page.content),
    );
  }
  if (page.pageTitle === 'Lower Headwear') {
    return resultFromBatch(
      page,
      parseHeadwearListPage('lower-head', page.content),
    );
  }
  if (['One-Handed', 'Two-Handed', 'Rapier', 'Dagger', 'Melee'].includes(page.pageTitle)) {
    return resultFromBatch(
      page,
      parseWeaponListPage(page.pageTitle, page.content),
    );
  }
  return parseInfobox(page);
}
