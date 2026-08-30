import { describe, expect, it } from 'vitest';
import type { WikiInventoryEntry } from './model';
import { reconcileInventory } from './inventory';

describe('reconcileInventory', () => {
  it('deduplicates category overlap and preserves deterministic evidence', () => {
    const entries: WikiInventoryEntry[] = [
      {
        pageId: 7,
        pageTitle: 'Steel Sword',
        categories: ['Category:Weapons'],
        kind: 'equipment',
      },
      {
        pageId: 3,
        pageTitle: 'Stats',
        categories: ['Category:Game Mechanics'],
        kind: 'mechanics',
      },
      {
        pageId: 7,
        pageTitle: 'Steel Sword',
        categories: ['Category:One-Handed'],
        kind: 'equipment',
      },
    ];

    expect(reconcileInventory(entries)).toEqual([
      {
        pageId: 3,
        pageTitle: 'Stats',
        categories: ['Category:Game Mechanics'],
        kind: 'mechanics',
      },
      {
        pageId: 7,
        pageTitle: 'Steel Sword',
        categories: ['Category:One-Handed', 'Category:Weapons'],
        kind: 'equipment',
      },
    ]);
  });

  it('rejects one page ID resolving to two titles', () => {
    expect(() =>
      reconcileInventory([
        { pageId: 9, pageTitle: 'Old Name', categories: [], kind: 'equipment' },
        { pageId: 9, pageTitle: 'Different Name', categories: [], kind: 'equipment' },
      ]),
    ).toThrow('Wiki page 9 resolved to conflicting titles');
  });
});
