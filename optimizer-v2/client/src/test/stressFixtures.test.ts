import { describe, expect, it } from 'vitest';
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
    expect(plan.statPlan.totalPoints).toBe(30);
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
