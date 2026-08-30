import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWikiInventory } from './inventory.mjs';

test('combines category members with explicit build-relevant roots', async () => {
  const inventory = await buildWikiInventory({
    categories: ['Category:Weapons', 'Category:Armor'],
    explicitPages: ['Stats', 'Shops'],
    fetchCategory: async (category) =>
      category === 'Category:Weapons'
        ? [{ pageId: 7, pageTitle: 'Steel Sword', categories: [category], kind: 'equipment' }]
        : [{ pageId: 8, pageTitle: 'Beginner Armor', categories: [category], kind: 'equipment' }],
    resolvePages: async () => [
      { pageId: 3, pageTitle: 'Stats', categories: [], kind: 'mechanics' },
      { pageId: 4, pageTitle: 'Shops', categories: [], kind: 'acquisition' },
    ],
  });

  assert.deepEqual(inventory.map((entry) => entry.pageTitle), [
    'Stats',
    'Shops',
    'Steel Sword',
    'Beginner Armor',
  ]);
});
