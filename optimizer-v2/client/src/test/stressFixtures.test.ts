import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../data/bootstrapRelease';
import { optimizeBuild } from '../domain/optimizer/optimizeBuild';
import {
  assertRecommendationInvariants,
  buildStressDataset,
  buildStressProfile,
} from './stressFixtures';

describe('stress fixtures', () => {
  it('builds a source-backed profile and dataset that produce an invariant plan', () => {
    const dataset = buildStressDataset();
    const profile = buildStressProfile({ datasetVersion: dataset.version });
    const plan = optimizeBuild(profile, dataset);

    expect(() => assertRecommendationInvariants(plan, profile, dataset)).not.toThrow();
    expect(plan.statPlan.futurePoints).toBe(30);
    expect(plan.statPlan.levelRows).toHaveLength(10);
  });

  it('rejects a target whose source URL does not match its verified dataset record', () => {
    const dataset = buildStressDataset();
    const profile = buildStressProfile({ datasetVersion: dataset.version });
    const plan = optimizeBuild(profile, dataset);
    const target = plan.upgradeTargets[0];

    expect(target).toBeDefined();
    expect(() =>
      assertRecommendationInvariants(
        {
          ...plan,
          upgradeTargets: [
            { ...target!, sourceUrl: 'https://example.com/unverified' },
          ],
        },
        profile,
        dataset,
      ),
    ).toThrow(/source/i);
  });

  it('rejects a recommendation backed by an untrusted dataset source', () => {
    const dataset = buildStressDataset();
    const profile = buildStressProfile({ datasetVersion: dataset.version });
    const plan = optimizeBuild(profile, dataset);
    const target = plan.upgradeTargets[0];
    if (!target) throw new Error('stress fixture must produce an upgrade target');
    const item = dataset.equipment.find((candidate) => candidate.id === target.itemId);
    if (!item) throw new Error('stress fixture target must exist in its dataset');

    item.sourceUrl = 'https://example.com/untrusted';
    const tamperedPlan = {
      ...plan,
      upgradeTargets: plan.upgradeTargets.map((candidate) =>
        candidate.itemId === item.id
          ? { ...candidate, sourceUrl: item.sourceUrl }
          : candidate,
      ),
    };

    expect(() => assertRecommendationInvariants(tamperedPlan, profile, dataset)).toThrow(
      /source-backed/i,
    );
  });

  it('does not share weapon-path arrays with bootstrap data or later fixtures', () => {
    const firstFixture = buildStressDataset();
    const laterFixture = buildStressDataset();
    const itemId = firstFixture.equipment[0]!.id;
    const bootstrapItem = bootstrapRelease.equipment.find((item) => item.id === itemId);
    const laterItem = laterFixture.equipment.find((item) => item.id === itemId);
    if (!bootstrapItem || !laterItem) throw new Error('stress fixture must contain bootstrap equipment');
    const originalPaths = [...bootstrapItem.weaponPaths];

    firstFixture.equipment[0]!.weaponPaths.push('rapier');

    expect(bootstrapItem.weaponPaths).toEqual(originalPaths);
    expect(laterItem.weaponPaths).toEqual(originalPaths);
  });

  it('rejects a plan attached to a different dataset version', () => {
    const dataset = buildStressDataset();
    const profile = buildStressProfile({ datasetVersion: dataset.version });
    const plan = optimizeBuild(profile, dataset);

    expect(() =>
      assertRecommendationInvariants(
        { ...plan, datasetVersion: 'other-release' },
        profile,
        dataset,
      ),
    ).toThrow(/dataset version/i);
  });
});
