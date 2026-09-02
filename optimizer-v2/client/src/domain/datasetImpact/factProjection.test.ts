import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import { fallbackRelease } from '../../data/fallbackRelease';
import { projectDatasetFacts } from './factProjection';

describe('dataset fact projection', () => {
  it('uses catalog records once when the optimizer projection also contains the item', () => {
    const itemId = fallbackRelease.catalog[0]!.id;
    const rows = projectDatasetFacts(fallbackRelease);

    expect(
      rows.filter(
        (row) =>
          row.entity === 'equipment' &&
          row.entityId === itemId &&
          row.field === 'name',
      ),
    ).toHaveLength(1);
  });

  it('normalizes legacy equipment when no catalog rows exist', () => {
    const legacy = { ...structuredClone(bootstrapRelease), catalog: [] };
    const rows = projectDatasetFacts(legacy);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: 'equipment',
          entityId: 'beginner-sword',
          field: 'attack',
          value: 3.4,
        }),
        expect.objectContaining({
          entity: 'acquisition',
          entityId: 'beginner-sword:legacy-acquisition',
          field: 'detail',
          value: 'Starter Inventory',
        }),
      ]),
    );
  });

  it('sorts unordered values without collapsing zero or null', () => {
    const changed = structuredClone(fallbackRelease);
    changed.catalog[0] = {
      ...changed.catalog[0]!,
      weaponPaths: [...changed.catalog[0]!.weaponPaths].reverse(),
      aliases: ['Second', 'First'],
      defense: 0,
      attack: null,
    };
    const projected = projectDatasetFacts(changed);

    expect(projected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: changed.catalog[0]!.id,
          field: 'aliases',
          value: ['First', 'Second'],
        }),
        expect.objectContaining({
          entityId: changed.catalog[0]!.id,
          field: 'defense',
          value: 0,
        }),
        expect.objectContaining({
          entityId: changed.catalog[0]!.id,
          field: 'attack',
          value: null,
        }),
      ]),
    );
  });
});
