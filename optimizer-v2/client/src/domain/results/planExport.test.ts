import { describe, expect, it } from 'vitest';
import type { PlanAction } from './actionChecklist';
import { serializePlanJson, serializePlanText } from './planExport';

const actions: PlanAction[] = [
  {
    id: 'equipment:armor:combat-armor',
    group: 'do-now',
    kind: 'buy',
    title: 'Buy Combat Armor',
    detail: 'Floor 2 Shop',
    verifiedCost: { amount: 3360, currency: 'Col' },
    sourceUrl: 'https://example.com/combat-armor',
  },
];

const payload = {
  profile: {
    schemaVersion: 2 as const,
    id: 'export-build',
    name: 'Export Build',
    level: 10,
    maxFloor: 2,
    weaponPath: 'two-handed' as const,
    goal: 'balanced' as const,
    stats: { str: 10, def: 5, agi: 5, vit: 5, luk: 5 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: 'test-release',
  },
  datasetVersion: 'test-release',
  fingerprint: 'plan-abc123',
  actions,
};

describe('plan export', () => {
  it('serializes complete readable text with known costs', () => {
    expect(serializePlanText(payload)).toBe(
      'Export Build\nLevel 10 · Floor 2 · two-handed · balanced\nDataset test-release · Plan plan-abc123\n\nDO NOW\n[ ] Buy Combat Armor — Floor 2 Shop — 3,360 Col\nSource: https://example.com/combat-armor',
    );
  });

  it('serializes identity-free versioned JSON', () => {
    const parsed = JSON.parse(serializePlanJson(payload));
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      datasetVersion: 'test-release',
      fingerprint: 'plan-abc123',
      profile: { id: 'export-build' },
      actions: [{ id: 'equipment:armor:combat-armor' }],
    });
    expect(parsed).not.toHaveProperty('owner');
    expect(parsed).not.toHaveProperty('identity');
  });
});
