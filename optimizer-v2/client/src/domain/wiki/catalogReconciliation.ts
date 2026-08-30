import type {
  CatalogEquipmentRecord,
  EquipmentAcquisition,
} from '../dataset/model';
import type { ParsedCatalogPage } from './equipmentParser';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sourceTitle(sourceUrl: string) {
  try {
    const segment = new URL(sourceUrl).pathname.split('/').at(-1) ?? '';
    return decodeURIComponent(segment).replace(/_/g, ' ');
  } catch {
    return '';
  }
}

function isItemPage(item: CatalogEquipmentRecord) {
  return slugify(sourceTitle(item.sourceUrl)) === item.id;
}

function recordScore(item: CatalogEquipmentRecord) {
  const numericCompleteness = [
    item.attack,
    item.defense,
    item.dexterity,
    item.levelRequirement,
  ].filter((value) => value !== null).length;
  return (
    (item.verificationStatus === 'verified' ? 100 : 0) +
    (isItemPage(item) ? 20 : 0) +
    numericCompleteness * 2 +
    item.acquisitions.length
  );
}

function firstNumber(
  rows: readonly CatalogEquipmentRecord[],
  read: (row: CatalogEquipmentRecord) => number | null,
) {
  for (const row of rows) {
    const value = read(row);
    if (value !== null) return value;
  }
  return null;
}

function mergeAcquisitions(
  itemId: string,
  rows: readonly CatalogEquipmentRecord[],
): EquipmentAcquisition[] {
  const acquisitions = rows.flatMap((row) => row.acquisitions);
  if (acquisitions.length === 0) return [];
  const exact = acquisitions.find(
    (acquisition) => slugify(sourceTitle(acquisition.sourceUrl)) === itemId,
  );
  const detailed = [...acquisitions].sort(
    (left, right) => right.detail.length - left.detail.length,
  )[0]!;
  const priced = acquisitions.find(
    (acquisition) =>
      acquisition.cost !== undefined && acquisition.currency !== undefined,
  );
  const explicitFloors = acquisitions.flatMap((acquisition) =>
    [...acquisition.detail.matchAll(/Floor\s+(\d+)/gi)].map((match) =>
      Number(match[1]),
    ),
  );
  const nonFloorAccess = acquisitions.some(
    (acquisition) =>
      acquisition.type === 'starter' ||
      ['event', 'gamepass', 'badge'].includes(acquisition.type),
  );
  const trustedFloor =
    explicitFloors.length > 0
      ? Math.min(...explicitFloors)
      : nonFloorAccess
        ? 1
        : undefined;
  const source = exact ?? detailed;
  return [
    {
      id: `${itemId}:acquisition:0`,
      type: (exact ?? detailed).type,
      detail: detailed.detail,
      ...(trustedFloor !== undefined ? { floor: trustedFloor } : {}),
      ...(priced
        ? { cost: priced.cost, currency: priced.currency }
        : {}),
      availability: (exact ?? detailed).availability,
      accessType: (exact ?? detailed).accessType,
      sourceUrl: source.sourceUrl,
      sourceRevision: source.sourceRevision,
    },
  ];
}

export function reconcileCatalogPages(
  pages: readonly ParsedCatalogPage[],
): CatalogEquipmentRecord[] {
  const grouped = new Map<string, CatalogEquipmentRecord[]>();
  for (const item of pages.flatMap((page) => page.equipment)) {
    const rows = grouped.get(item.id) ?? [];
    rows.push(item);
    grouped.set(item.id, rows);
  }

  return [...grouped.entries()]
    .map(([itemId, evidence]) => {
      const rows = [...evidence].sort(
        (left, right) =>
          recordScore(right) - recordScore(left) ||
          right.sourceRevision.localeCompare(left.sourceRevision, undefined, {
            numeric: true,
          }),
      );
      const base = rows[0]!;
      const exact = rows.find(isItemPage);
      const source = exact ?? base;
      const valueRows = exact
        ? [exact, ...rows.filter((row) => row !== exact)]
        : rows;
      const attack = firstNumber(valueRows, (row) => row.attack);
      const defense = firstNumber(valueRows, (row) => row.defense);
      const dexterity = firstNumber(valueRows, (row) => row.dexterity);
      const levelRequirement = firstNumber(
        valueRows,
        (row) => row.levelRequirement,
      );
      const acquisitions = mergeAcquisitions(itemId, rows);
      const complete =
        attack !== null &&
        defense !== null &&
        dexterity !== null &&
        levelRequirement !== null &&
        levelRequirement >= 1 &&
        acquisitions.length > 0;

      return {
        ...base,
        aliases: [...new Set(rows.flatMap((row) => row.aliases))].sort(),
        attack,
        defense,
        dexterity,
        levelRequirement,
        skillRequirement: valueRows.find(
          (row) => row.skillRequirement !== undefined,
        )?.skillRequirement,
        acquisitions,
        resistances: rows.flatMap((row) => row.resistances),
        specialEffects: [...new Set(rows.flatMap((row) => row.specialEffects))],
        verificationStatus: complete ? 'verified' : 'partial',
        sourceUrl: source.sourceUrl,
        sourceRevision: source.sourceRevision,
        lastReviewedAt: source.lastReviewedAt,
      } satisfies CatalogEquipmentRecord;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}
