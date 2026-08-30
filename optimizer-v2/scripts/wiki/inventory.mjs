import { fileURLToPath } from 'node:url';
import {
  fetchAllPagesForCategory,
  resolveExplicitPages,
} from './mediawiki-api.mjs';

export const DEFAULT_CATEGORIES = [
  'Category:Weapons',
  'Category:Armor',
  'Category:Shields',
];

export const DEFAULT_EXPLICIT_PAGES = [
  'One-Handed',
  'Two-Handed',
  'Rapier',
  'Dagger',
  'Melee',
  'Fists',
  'Armor',
  'Upper Headwear',
  'Lower Headwear',
  'Shields',
  'Gamepass and Badge Equipment',
  'Shops',
  'Stats',
];

const explicitEquipmentPages = new Set([
  'One-Handed',
  'Two-Handed',
  'Rapier',
  'Dagger',
  'Melee',
  'Fists',
  'Armor',
  'Upper Headwear',
  'Lower Headwear',
  'Shields',
  'Gamepass and Badge Equipment',
]);

export function kindForExplicitPage(pageTitle) {
  if (pageTitle === 'Stats') return 'mechanics';
  if (pageTitle === 'Shops') return 'acquisition';
  if (explicitEquipmentPages.has(pageTitle)) return 'equipment';
  return 'index';
}

function reconcile(entries) {
  const byPageId = new Map();
  for (const entry of entries) {
    const current = byPageId.get(entry.pageId);
    if (current && current.pageTitle !== entry.pageTitle) {
      throw new Error(
        `Wiki page ${entry.pageId} resolved to conflicting titles: ${current.pageTitle} / ${entry.pageTitle}`,
      );
    }
    byPageId.set(entry.pageId, {
      ...(current ?? entry),
      categories: [
        ...new Set([...(current?.categories ?? []), ...entry.categories]),
      ].sort(),
      kind:
        current?.kind === 'equipment' || entry.kind === 'equipment'
          ? 'equipment'
          : entry.kind,
    });
  }
  return [...byPageId.values()].sort(
    (left, right) =>
      left.pageId - right.pageId ||
      left.pageTitle.localeCompare(right.pageTitle),
  );
}

export async function buildWikiInventory({
  categories = DEFAULT_CATEGORIES,
  explicitPages = DEFAULT_EXPLICIT_PAGES,
  fetchCategory = fetchAllPagesForCategory,
  resolvePages = resolveExplicitPages,
} = {}) {
  const categoryEntries = [];
  for (const category of categories) {
    categoryEntries.push(...(await fetchCategory(category)));
  }
  const explicitEntries = (await resolvePages(explicitPages)).map((entry) => ({
    ...entry,
    kind: kindForExplicitPage(entry.pageTitle),
  }));
  return reconcile([...categoryEntries, ...explicitEntries]);
}

async function main() {
  if (!process.argv.includes('--summary')) {
    throw new Error('Use --summary for the read-only inventory command');
  }
  const inventory = await buildWikiInventory();
  const counts = inventory.reduce((result, entry) => {
    result[entry.kind] = (result[entry.kind] ?? 0) + 1;
    return result;
  }, {});
  process.stdout.write(
    `${JSON.stringify({ pages: inventory.length, kinds: counts }, null, 2)}\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
