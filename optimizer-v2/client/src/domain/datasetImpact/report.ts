import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import {
  optimizeBuild,
  type RecommendationPlan,
} from '../optimizer/optimizeBuild';
import { canonicalJson, hashString } from './canonical';
import { diffDatasetFacts, type DatasetFactChange } from './factDiff';
import {
  buildImpactKeyFingerprint,
  DATASET_IMPACT_CONTRACT_VERSION,
  fingerprintBuildInputs,
  fingerprintDatasetSnapshot,
} from './fingerprint';
import {
  diffRecommendationPlans,
  type PlanEndpointResult,
  type RecommendationPlanImpact,
} from './planDiff';
import type { DatasetReleaseDescriptor } from './releaseIndex';
import { selectRelevantFactChanges } from './relevance';

export interface DatasetReleaseImpactStep {
  fromVersion: string;
  toVersion: string;
  status: 'available' | 'gap';
  factChanges: DatasetFactChange[];
  plan: RecommendationPlanImpact | null;
}

export interface DatasetImpactReport {
  contractVersion: 1;
  buildId: string;
  inputFingerprint: string;
  impactKeyFingerprint: string;
  reportFingerprint: string;
  pinned: DatasetReleaseDescriptor;
  target: DatasetReleaseDescriptor;
  facts: DatasetFactChange[];
  omittedFactChangeCount: number;
  plan: RecommendationPlanImpact;
  trail: DatasetReleaseImpactStep[];
  unknowns: string[];
}

type Optimize = (
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
) => RecommendationPlan;

type BuildReportInput = {
  profile: CharacterProfile;
  pinned: DatasetSnapshot;
  target: DatasetSnapshot;
  intermediate: readonly (DatasetSnapshot | null)[];
  descriptors: readonly DatasetReleaseDescriptor[];
  optimize?: Optimize;
};

export interface DatasetImpactReportCache {
  getOrCreate(
    impactKeyFingerprint: string,
    create: () => DatasetImpactReport,
  ): DatasetImpactReport;
}

export function createDatasetImpactReportCache(): DatasetImpactReportCache {
  const reports = new Map<string, DatasetImpactReport>();
  return {
    getOrCreate(impactKeyFingerprint, create) {
      const existing = reports.get(impactKeyFingerprint);
      if (existing) return existing;
      const report = create();
      reports.set(impactKeyFingerprint, report);
      return report;
    },
  };
}

function endpoint(
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
  optimize: Optimize,
): PlanEndpointResult {
  try {
    return {
      status: 'ready',
      plan: optimize(
        { ...structuredClone(profile), datasetVersion: dataset.version },
        dataset,
      ),
    };
  } catch (error) {
    return {
      status: 'blocked',
      explanation:
        error instanceof Error ? error.message : 'Recommendation unavailable',
    };
  }
}

function assertDescriptorMatches(
  descriptor: DatasetReleaseDescriptor,
  snapshot: DatasetSnapshot,
) {
  if (
    descriptor.version !== snapshot.version ||
    descriptor.contentFingerprint !== fingerprintDatasetSnapshot(snapshot)
  ) {
    throw new Error('Dataset release descriptor does not match its snapshot');
  }
}

export function buildDatasetImpactReport({
  profile,
  pinned,
  target,
  intermediate,
  descriptors,
  optimize = optimizeBuild,
}: BuildReportInput): DatasetImpactReport {
  const pinnedDescriptor = descriptors.find(
    (descriptor) => descriptor.version === pinned.version,
  );
  const targetDescriptor = descriptors.find(
    (descriptor) => descriptor.version === target.version,
  );
  if (!pinnedDescriptor || !targetDescriptor) {
    throw new Error('Dataset impact endpoints are not indexed');
  }
  assertDescriptorMatches(pinnedDescriptor, pinned);
  assertDescriptorMatches(targetDescriptor, target);
  const ordered = [...descriptors].sort(
    (left, right) =>
      left.publishedAt.localeCompare(right.publishedAt) ||
      left.version.localeCompare(right.version, undefined, { numeric: true }),
  );
  const pinnedIndex = ordered.findIndex(
    (descriptor) => descriptor.version === pinned.version,
  );
  const targetIndex = ordered.findIndex(
    (descriptor) => descriptor.version === target.version,
  );
  if (pinnedIndex < 0 || targetIndex <= pinnedIndex) {
    throw new Error('Dataset impact target must follow the pinned release');
  }
  const sequence = ordered.slice(pinnedIndex, targetIndex + 1);
  const snapshots = new Map<string, DatasetSnapshot>([
    [pinned.version, pinned],
    [target.version, target],
  ]);
  for (const snapshot of intermediate) {
    if (snapshot) snapshots.set(snapshot.version, snapshot);
  }

  const pinnedPlan = endpoint(profile, pinned, optimize);
  const targetPlan = endpoint(profile, target, optimize);
  const directChanges = diffDatasetFacts(pinned, target);
  const relevant = selectRelevantFactChanges({
    profile,
    pinned,
    target,
    pinnedPlan,
    targetPlan,
    changes: directChanges,
  });
  const trail: DatasetReleaseImpactStep[] = [];
  const unknowns = new Set<string>();
  for (const descriptor of sequence.slice(1, -1)) {
    if (!snapshots.has(descriptor.version)) {
      unknowns.add(`Intermediate release ${descriptor.version} is unavailable.`);
    }
  }
  for (let index = 0; index < sequence.length - 1; index += 1) {
    const from = sequence[index]!;
    const to = sequence[index + 1]!;
    const fromSnapshot = snapshots.get(from.version);
    const toSnapshot = snapshots.get(to.version);
    if (!fromSnapshot || !toSnapshot) {
      trail.push({
        fromVersion: from.version,
        toVersion: to.version,
        status: 'gap',
        factChanges: [],
        plan: null,
      });
      continue;
    }
    const stepChanges = selectRelevantFactChanges({
      profile,
      pinned: fromSnapshot,
      target: toSnapshot,
      pinnedPlan,
      targetPlan,
      changes: diffDatasetFacts(fromSnapshot, toSnapshot),
    });
    trail.push({
      fromVersion: from.version,
      toVersion: to.version,
      status: 'available',
      factChanges: stepChanges.changes,
      plan: null,
    });
  }
  if (pinnedPlan.status === 'blocked') unknowns.add(pinnedPlan.explanation);
  if (targetPlan.status === 'blocked') unknowns.add(targetPlan.explanation);

  const inputFingerprint = fingerprintBuildInputs(profile);
  const impactKeyFingerprint = buildImpactKeyFingerprint({
    inputFingerprint,
    pinned: pinnedDescriptor,
    target: targetDescriptor,
  });
  const reportWithoutFingerprint = {
    contractVersion: DATASET_IMPACT_CONTRACT_VERSION,
    buildId: profile.id,
    inputFingerprint,
    impactKeyFingerprint,
    pinned: pinnedDescriptor,
    target: targetDescriptor,
    facts: relevant.changes,
    omittedFactChangeCount: relevant.omittedCount,
    plan: diffRecommendationPlans(pinnedPlan, targetPlan),
    trail,
    unknowns: [...unknowns].sort(),
  };
  return {
    ...reportWithoutFingerprint,
    reportFingerprint: `impact-report-${hashString(
      canonicalJson(reportWithoutFingerprint),
    )}`,
  };
}
