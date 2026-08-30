import assert from 'node:assert/strict';
import test from 'node:test';
import { auditWikiCatalog } from '../audit-wiki-catalog.mjs';

test('audit reconciles list and item evidence into one optimizer-safe exact-page record', async () => {
  const inventory = [
    { pageId: 1, pageTitle: 'Armor', categories: [], kind: 'equipment' },
    {
      pageId: 2,
      pageTitle: 'Fields Warrior',
      categories: ['Category:Armor'],
      kind: 'equipment',
    },
  ];
  const snapshots = [
    {
      pageId: 1,
      pageTitle: 'Armor',
      sourceUrl: 'https://swordbloxonlinerebirth.fandom.com/wiki/Armor',
      revisionId: '26210',
      revisionTimestamp: '2026-08-30T00:00:00Z',
      content: [
        '{| class="wikitable"',
        '!Equipment Name',
        '!Level',
        '!Defense Stat',
        '!Dexterity Stat',
        '!How to Obtain',
        '|-',
        '|[[Fields Warrior]]',
        '|3',
        '|1.5',
        '|6',
        '|[[Shops#Floor 1 Shop|Floor 1 Shop]]',
        '|}',
      ].join('\n'),
    },
    {
      pageId: 2,
      pageTitle: 'Fields Warrior',
      sourceUrl:
        'https://swordbloxonlinerebirth.fandom.com/wiki/Fields%20Warrior',
      revisionId: '19884',
      revisionTimestamp: '2026-08-30T00:00:00Z',
      content:
        '{{Armor|level_req=Level 3|defense=1.5|dexterity=6|equipment_type=[[Armor]]|worth=1,440 Col|how_to_obtain=[[Shops#Floor 1 Shop|Floor 1 Shop]]}}',
    },
  ];

  const result = await auditWikiCatalog({
    inventory,
    fetchSnapshots: async () => snapshots,
  });

  assert.equal(result.verifiedCatalog.length, 1);
  assert.equal(result.report.coverage.normalized, 1);
  assert.equal(result.report.coverage.verified, 1);
  assert.equal(
    result.verifiedCatalog[0].sourceUrl,
    'https://swordbloxonlinerebirth.fandom.com/wiki/Fields%20Warrior',
  );
  assert.equal(result.verifiedCatalog[0].acquisitions[0].cost, 1440);
});
