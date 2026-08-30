import type { ParsedCatalogPage } from './equipmentParser';
import type {
  WikiCoverageManifest,
  WikiInventoryEntry,
} from './model';

export function buildCoverageManifest({
  inventory,
  parsed,
}: {
  inventory: readonly WikiInventoryEntry[];
  parsed: readonly ParsedCatalogPage[];
}): WikiCoverageManifest {
  const parsedTitles = new Set(parsed.map(({ page }) => page.pageTitle));
  const equipment = parsed.flatMap((page) => page.equipment);
  const unresolved = parsed.flatMap((page) => page.unresolved);
  const statusCount = (status: typeof equipment[number]['verificationStatus']) =>
    equipment.filter((item) => item.verificationStatus === status).length;

  return {
    discovered: inventory.length,
    fetched: parsed.length,
    parsed: parsed.length,
    normalized: equipment.length,
    verified: statusCount('verified'),
    partial: statusCount('partial'),
    conflicting: statusCount('conflicting'),
    unknown: statusCount('unknown') + unresolved.length,
    legacy: statusCount('legacy'),
    unresolved: unresolved.map(({ pageTitle, reason }) => ({
      pageTitle,
      reason,
    })),
    unaccountedPages: inventory
      .filter((entry) => !parsedTitles.has(entry.pageTitle))
      .map((entry) => entry.pageTitle)
      .sort(),
  };
}

export function coverageReleaseErrors(
  manifest: WikiCoverageManifest,
): string[] {
  if (manifest.unaccountedPages.length === 0) return [];
  return [
    `Coverage manifest leaves ${manifest.unaccountedPages.length} inventory page${manifest.unaccountedPages.length === 1 ? '' : 's'} unaccounted for: ${manifest.unaccountedPages.join(', ')}`,
  ];
}
