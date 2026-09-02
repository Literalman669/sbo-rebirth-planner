import { describe, expect, it } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import { diffDatasetFacts } from './factDiff';

describe('verified dataset fact diff', () => {
  it('reports field, acquisition, effect, formula, and policy changes with provenance', () => {
    const target = structuredClone(fallbackRelease);
    const item = target.catalog[0]!;
    target.catalog[0] = {
      ...item,
      defense: null,
      specialEffects: [...item.specialEffects, 'Impact test effect'],
      acquisitions: item.acquisitions.map((acquisition, index) =>
        index === 0 ? { ...acquisition, cost: 75_000 } : acquisition,
      ),
    };
    target.formulas[0] = {
      ...target.formulas[0]!,
      expression: 'changed expression',
    };
    target.strategyPolicyVersion = 'sbor-policy-v1';

    const changes = diffDatasetFacts(fallbackRelease, target);

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `equipment:${item.id}:defense`,
          change: 'changed',
          before: 0,
          after: null,
          beforeSourceUrl: item.sourceUrl,
          afterSourceUrl: item.sourceUrl,
        }),
        expect.objectContaining({
          id: `acquisition:${item.acquisitions[0]!.id}:cost`,
          before: item.acquisitions[0]!.cost,
          after: 75_000,
        }),
        expect.objectContaining({
          entity: 'special-effect',
          entityId: `${item.id}:Impact test effect`,
          change: 'added',
        }),
        expect.objectContaining({
          id: `formula:${target.formulas[0]!.id}:expression`,
          after: 'changed expression',
        }),
        expect.objectContaining({
          id: 'release-policy:release:strategyPolicyVersion',
          before: 'sbor-policy-v2',
          after: 'sbor-policy-v1',
        }),
      ]),
    );
  });

  it('returns no changes for reordered snapshot arrays and does not mutate inputs', () => {
    const pinned = structuredClone(fallbackRelease);
    const target = {
      ...structuredClone(fallbackRelease),
      catalog: [...fallbackRelease.catalog].reverse(),
      formulas: [...fallbackRelease.formulas].reverse(),
      mechanics: [...fallbackRelease.mechanics].reverse(),
    };
    const pinnedBefore = structuredClone(pinned);
    const targetBefore = structuredClone(target);

    expect(diffDatasetFacts(pinned, target)).toEqual([]);
    expect(pinned).toEqual(pinnedBefore);
    expect(target).toEqual(targetBefore);
  });
});
