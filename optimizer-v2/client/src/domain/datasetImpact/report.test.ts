import { describe, expect, it, vi } from 'vitest';
import { fallbackRelease } from '../../data/fallbackRelease';
import type { CharacterProfile } from '../build/model';
import { optimizeBuild } from '../optimizer/optimizeBuild';
import { buildDatasetReleaseIndex } from './releaseIndex';
import {
  buildDatasetImpactReport,
  buildDatasetReleaseStepPlanImpact,
  createDatasetImpactReportCache,
} from './report';

const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'report-build',
  name: 'Report Build',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: [],
  datasetVersion: '2026.08.30.1',
};

function release(
  version: string,
  publishedAt: string,
  combatArmorCost: number,
  unrelatedAttack: number,
) {
  const snapshot = structuredClone(fallbackRelease);
  snapshot.version = version;
  snapshot.publishedAt = publishedAt;
  snapshot.catalog = snapshot.catalog.map((item) => {
    if (item.id === 'combat-armor') {
      return {
        ...item,
        acquisitions: item.acquisitions.map((acquisition, index) =>
          index === 0 ? { ...acquisition, cost: combatArmorCost } : acquisition,
        ),
      };
    }
    if (item.id === 'aquatic-guard') {
      return { ...item, attack: unrelatedAttack };
    }
    return item;
  });
  return snapshot;
}

describe('dataset impact report', () => {
  const pinned = release(
    '2026.08.30.1',
    '2026-08-30T12:00:00.000Z',
    3_360,
    10,
  );
  const intermediate = release(
    '2026.08.31.1',
    '2026-08-31T12:00:00.000Z',
    3_500,
    11,
  );
  const target = release(
    '2026.09.01.1',
    '2026-09-01T12:00:00.000Z',
    3_600,
    12,
  );
  const descriptors = buildDatasetReleaseIndex(
    [pinned, intermediate, target].map((snapshot) => ({
      snapshot,
      availability: 'cached' as const,
    })),
  );

  it('builds a deterministic relevant endpoint report with exactly two optimizer calls', () => {
    const optimize = vi.fn(optimizeBuild);
    const pinnedBefore = structuredClone(pinned);
    const targetBefore = structuredClone(target);

    const report = buildDatasetImpactReport({
      profile,
      pinned,
      target,
      intermediate: [intermediate],
      descriptors,
      optimize,
    });

    expect(optimize).toHaveBeenCalledTimes(2);
    expect(report).toMatchObject({
      contractVersion: 1,
      buildId: profile.id,
      pinned: { version: pinned.version },
      target: { version: target.version },
      impactKeyFingerprint: expect.stringMatching(/^impact-[a-f0-9]{8}$/),
      reportFingerprint: expect.stringMatching(/^impact-report-[a-f0-9]{8}$/),
      trail: [
        { fromVersion: pinned.version, toVersion: intermediate.version, status: 'available', plan: null },
        { fromVersion: intermediate.version, toVersion: target.version, status: 'available', plan: null },
      ],
    });
    expect(report.facts).toContainEqual(
      expect.objectContaining({
        entity: 'acquisition',
        entityId: 'combat-armor:acquisition:0',
        field: 'cost',
        before: 3_360,
        after: 3_600,
      }),
    );
    expect(report.facts).not.toContainEqual(
      expect.objectContaining({ entityId: 'aquatic-guard' }),
    );
    expect(report.omittedFactChangeCount).toBeGreaterThan(0);
    expect(report.trail[0]?.factChanges).toContainEqual(
      expect.objectContaining({ entityId: 'combat-armor:acquisition:0' }),
    );
    expect(pinned).toEqual(pinnedBefore);
    expect(target).toEqual(targetBefore);

    const repeated = buildDatasetImpactReport({
      profile: structuredClone(profile),
      pinned: structuredClone(pinned),
      target: structuredClone(target),
      intermediate: [structuredClone(intermediate)],
      descriptors: structuredClone(descriptors),
    });
    expect(repeated).toEqual(report);
  });

  it('marks missing intermediate snapshots as trail gaps without blocking endpoints', () => {
    const report = buildDatasetImpactReport({
      profile,
      pinned,
      target,
      intermediate: [null],
      descriptors,
    });

    expect(report.plan.status).not.toBe('blocked');
    expect(report.trail).toEqual([
      expect.objectContaining({
        fromVersion: pinned.version,
        toVersion: intermediate.version,
        status: 'gap',
        factChanges: [],
        plan: null,
      }),
      expect.objectContaining({
        fromVersion: intermediate.version,
        toVersion: target.version,
        status: 'gap',
        factChanges: [],
        plan: null,
      }),
    ]);
    expect(report.unknowns).toContain(
      `Intermediate release ${intermediate.version} is unavailable.`,
    );
  });

  it('reuses a report for UI-only and receipt changes sharing one impact key', () => {
    const optimize = vi.fn(optimizeBuild);
    const cache = createDatasetImpactReportCache();
    const load = () =>
      cache.getOrCreate('impact-stable-key', () =>
        buildDatasetImpactReport({
          profile,
          pinned,
          target,
          intermediate: [intermediate],
          descriptors,
          optimize,
        }),
      );

    const first = load();
    const afterDisclosureChange = load();
    const afterReceiptChange = load();

    expect(afterDisclosureChange).toBe(first);
    expect(afterReceiptChange).toBe(first);
    expect(optimize).toHaveBeenCalledTimes(2);
  });

  it('computes an intermediate plan impact only when that release step expands', () => {
    const optimize = vi.fn(optimizeBuild);

    const impact = buildDatasetReleaseStepPlanImpact({
      profile,
      from: pinned,
      to: intermediate,
      optimize,
    });

    expect(impact.status).not.toBe('blocked');
    expect(optimize).toHaveBeenCalledTimes(2);
  });
});
