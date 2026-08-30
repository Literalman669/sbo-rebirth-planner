import { describe, expect, it } from 'vitest';
import type { ParsedCatalogPage } from './equipmentParser';
import type { WikiInventoryEntry, WikiPageSnapshot } from './model';
import { buildCoverageManifest, coverageReleaseErrors } from './coverage';

const inventory: WikiInventoryEntry[] = [
  { pageId: 1, pageTitle: 'Steel Sword', categories: ['Category:Weapons'], kind: 'equipment' },
  { pageId: 2, pageTitle: 'Mystery Helm', categories: ['Category:Armor'], kind: 'equipment' },
];

const page = (pageId: number, pageTitle: string): WikiPageSnapshot => ({
  pageId,
  pageTitle,
  sourceUrl: `https://swordbloxonlinerebirth.fandom.com/wiki/${encodeURIComponent(pageTitle)}`,
  revisionId: String(26000 + pageId),
  revisionTimestamp: '2026-08-30T00:00:00Z',
  contentHash: `sha256:${pageId}`,
  content: 'fixture',
});

describe('catalog coverage', () => {
  it('fails when a discovered page has no parsed or unresolved accounting', () => {
    const parsed: ParsedCatalogPage[] = [
      { page: page(1, 'Steel Sword'), equipment: [], aliases: [], warnings: [], unresolved: [{ pageTitle: 'Steel Sword', reason: 'Unknown layout' }] },
    ];
    const manifest = buildCoverageManifest({ inventory, parsed });

    expect(manifest.unaccountedPages).toEqual(['Mystery Helm']);
    expect(coverageReleaseErrors(manifest)).toEqual([
      'Coverage manifest leaves 1 inventory page unaccounted for: Mystery Helm',
    ]);
  });

  it('accepts an explicitly unresolved page while keeping its status visible', () => {
    const parsed: ParsedCatalogPage[] = inventory.map((entry) => ({
      page: page(entry.pageId, entry.pageTitle),
      equipment: [],
      aliases: [],
      warnings: [],
      unresolved: [{ pageTitle: entry.pageTitle, reason: 'Source omits required numeric fields' }],
    }));
    const manifest = buildCoverageManifest({ inventory, parsed });

    expect(manifest.discovered).toBe(2);
    expect(manifest.unknown).toBe(2);
    expect(manifest.unaccountedPages).toEqual([]);
    expect(coverageReleaseErrors(manifest)).toEqual([]);
  });
});
