import { describe, expect, it } from 'vitest';
import { CATALOG_TABLE_MANIFEST } from './catalogSchemaManifest';

describe('version-2 catalog schema manifest', () => {
  it('keeps raw snapshots private and exposes only reviewed release children', () => {
    expect(CATALOG_TABLE_MANIFEST).toHaveLength(16);
    expect(
      CATALOG_TABLE_MANIFEST.find((table) => table.name === 'wiki_page_snapshot'),
    ).toEqual({
      name: 'wiki_page_snapshot',
      visibility: 'private',
      releaseIndexed: false,
    });
    expect(
      CATALOG_TABLE_MANIFEST.filter((table) => table.visibility === 'public')
        .map((table) => table.name),
    ).toEqual([
      'catalog_equipment',
      'equipment_alias',
      'equipment_acquisition',
      'equipment_resistance',
      'equipment_special_effect',
      'mechanic',
      'release_strategy_policy',
    ]);
    expect(
      CATALOG_TABLE_MANIFEST.filter(
        (table) =>
          table.name !== 'wiki_page_snapshot' &&
          table.name !== 'coverage_manifest' &&
          table.name !== 'draft_strategy_policy' &&
          table.name !== 'release_strategy_policy',
      ).every((table) => table.releaseIndexed),
    ).toBe(true);
  });
});
