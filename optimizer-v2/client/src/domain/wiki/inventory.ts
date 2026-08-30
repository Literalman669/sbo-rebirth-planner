import type {
  WikiInventoryEntry,
  WikiInventoryKind,
} from './model';

const kindPriority: Record<WikiInventoryKind, number> = {
  index: 0,
  acquisition: 1,
  mechanics: 2,
  equipment: 3,
};

export function reconcileInventory(
  entries: readonly WikiInventoryEntry[],
): WikiInventoryEntry[] {
  const byPageId = new Map<number, WikiInventoryEntry>();

  for (const entry of entries) {
    const current = byPageId.get(entry.pageId);
    if (!current) {
      byPageId.set(entry.pageId, {
        ...entry,
        categories: [...new Set(entry.categories)].sort(),
      });
      continue;
    }
    if (current.pageTitle !== entry.pageTitle) {
      throw new Error(
        `Wiki page ${entry.pageId} resolved to conflicting titles: ${current.pageTitle} / ${entry.pageTitle}`,
      );
    }
    byPageId.set(entry.pageId, {
      ...current,
      kind:
        kindPriority[entry.kind] > kindPriority[current.kind]
          ? entry.kind
          : current.kind,
      categories: [
        ...new Set([...current.categories, ...entry.categories]),
      ].sort(),
    });
  }

  return [...byPageId.values()].sort(
    (left, right) =>
      left.pageId - right.pageId ||
      left.pageTitle.localeCompare(right.pageTitle),
  );
}
