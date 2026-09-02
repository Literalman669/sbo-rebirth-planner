import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { mergeBuildLibrary } from '../../domain/build/library';
import { selectDatasetImpactCandidates } from '../../domain/datasetImpact/candidates';
import { canonicalJson } from '../../domain/datasetImpact/canonical';
import {
  buildDatasetImpactReport,
  buildDatasetReleaseStepPlanImpact,
  type DatasetImpactReport,
} from '../../domain/datasetImpact/report';
import type { DatasetReleaseDescriptor } from '../../domain/datasetImpact/releaseIndex';
import type { DatasetReviewReceipt } from '../../domain/datasetImpact/reviewReceipt';
import type { RecommendationPlanImpact } from '../../domain/datasetImpact/planDiff';
import {
  optimizeBuild,
  type RecommendationPlan,
} from '../../domain/optimizer/optimizeBuild';
import {
  createDatasetReviewStore,
  type DatasetReviewStore,
} from '../../infrastructure/storage/datasetReviewStore';
import { useBuildDraft } from './BuildDraftContext';
import { useOptionalCloudBuilds } from './CloudBuildsContext';
import { useDataset } from './DatasetProvider';
import {
  DatasetUpdatesContext,
  type DatasetImpactReportResult,
  type DatasetUpdatesState,
} from './DatasetUpdatesContext';

const defaultReceiptStore = createDatasetReviewStore();

type Optimize = NonNullable<
  Parameters<typeof buildDatasetImpactReport>[0]['optimize']
>;

type DatasetUpdatesProviderProps = PropsWithChildren<{
  receiptStore?: DatasetReviewStore;
  optimize?: Optimize;
  now?: () => string;
}>;

function mergeReceipts(
  local: readonly DatasetReviewReceipt[],
  cloud: readonly DatasetReviewReceipt[],
): DatasetReviewReceipt[] {
  const merged = new Map<string, DatasetReviewReceipt>();
  for (const receipt of [...local, ...cloud]) {
    const current = merged.get(receipt.buildId);
    if (
      !current ||
      receipt.reviewedAt > current.reviewedAt ||
      (receipt.reviewedAt === current.reviewedAt &&
        canonicalJson(receipt) > canonicalJson(current))
    ) {
      merged.set(receipt.buildId, receipt);
    }
  }
  return [...merged.values()].sort((left, right) =>
    left.buildId.localeCompare(right.buildId),
  );
}

export function DatasetUpdatesProvider({
  children,
  receiptStore = defaultReceiptStore,
  optimize,
  now = () => new Date().toISOString(),
}: DatasetUpdatesProviderProps) {
  const dataset = useDataset();
  const draft = useBuildDraft();
  const cloud = useOptionalCloudBuilds();
  const [localReceipts, setLocalReceipts] = useState<DatasetReviewReceipt[]>([]);
  const [releases, setReleases] = useState<DatasetReleaseDescriptor[]>([]);
  const [localHydrated, setLocalHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const reportPromises = useRef(
    new Map<string, Promise<DatasetImpactReportResult>>(),
  );
  const releaseStepPromises = useRef(
    new Map<string, Promise<RecommendationPlanImpact | null>>(),
  );
  const previewPromises = useRef(
    new Map<string, Promise<RecommendationPlan>>(),
  );

  const refresh = useCallback(async () => {
    try {
      const [nextReceipts, nextReleases] = await Promise.all([
        receiptStore.list(),
        dataset.listReleases(),
      ]);
      setLocalReceipts(nextReceipts);
      setReleases(nextReleases);
      setStorageError(null);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : 'Dataset update state could not be loaded',
      );
    } finally {
      setLocalHydrated(true);
    }
  }, [dataset, receiptStore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const receipts = useMemo(
    () => mergeReceipts(localReceipts, cloud?.cloudDatasetReviews ?? []),
    [cloud?.cloudDatasetReviews, localReceipts],
  );
  const entries = useMemo(
    () =>
      mergeBuildLibrary(draft.savedBuilds, [
        ...(cloud?.cloudBuilds ?? []),
        ...(cloud?.archivedCloudBuilds ?? []),
      ]),
    [cloud?.archivedCloudBuilds, cloud?.cloudBuilds, draft.savedBuilds],
  );
  const isHydrated =
    localHydrated && draft.isHydrated && (cloud?.isReady ?? true);
  const candidates = useMemo(
    () =>
      isHydrated
        ? selectDatasetImpactCandidates({
            active: {
              profile: draft.draft,
              hasActiveDraft: draft.hasActiveDraft,
            },
            entries,
            releases,
            targetVersion: dataset.snapshot.version,
            receipts,
          })
        : [],
    [
      dataset.snapshot.version,
      draft.draft,
      draft.hasActiveDraft,
      entries,
      isHydrated,
      receipts,
      releases,
    ],
  );

  const loadReport = useCallback(
    async (candidateId: string): Promise<DatasetImpactReportResult> => {
      const candidate = candidates.find((item) => item.id === candidateId);
      if (!candidate) {
        return { status: 'blocked', reason: 'This build is no longer affected.' };
      }
      if (!candidate.pinned || !candidate.impactKeyFingerprint) {
        return {
          status: 'blocked',
          reason: `Pinned dataset ${candidate.profile.datasetVersion} is unavailable.`,
        };
      }
      const pinnedDescriptor = candidate.pinned;
      const impactKeyFingerprint = candidate.impactKeyFingerprint;
      const reportCacheKey = `${candidate.id}:${impactKeyFingerprint}`;
      const cached = reportPromises.current.get(reportCacheKey);
      if (cached) return cached;
      const promise = (async (): Promise<DatasetImpactReportResult> => {
        const ordered = [...releases].sort(
          (left, right) =>
            left.publishedAt.localeCompare(right.publishedAt) ||
            left.version.localeCompare(right.version, undefined, {
              numeric: true,
            }),
        );
        const pinnedIndex = ordered.findIndex(
          (release) => release.version === candidate.pinned!.version,
        );
        const targetIndex = ordered.findIndex(
          (release) => release.version === candidate.target.version,
        );
        if (pinnedIndex < 0 || targetIndex <= pinnedIndex) {
          return {
            status: 'blocked',
            reason: 'Dataset update endpoints are not available in release order.',
          };
        }
        const [pinnedSnapshot, targetSnapshot, intermediate] = await Promise.all([
          dataset.getSnapshot(pinnedDescriptor.version),
          dataset.getSnapshot(candidate.target.version),
          Promise.all(
            ordered
              .slice(pinnedIndex + 1, targetIndex)
              .map((release) => dataset.getSnapshot(release.version)),
          ),
        ]);
        if (!pinnedSnapshot) {
          return {
            status: 'blocked',
            reason: `Pinned dataset ${pinnedDescriptor.version} is unavailable.`,
          };
        }
        if (!targetSnapshot) {
          return {
            status: 'blocked',
            reason: `Current dataset ${candidate.target.version} is unavailable.`,
          };
        }
        try {
          return {
            status: 'ready',
            report: buildDatasetImpactReport({
              profile: candidate.profile,
              pinned: pinnedSnapshot,
              target: targetSnapshot,
              intermediate,
              descriptors: ordered,
              ...(optimize ? { optimize } : {}),
            }),
          };
        } catch (error) {
          return {
            status: 'blocked',
            reason:
              error instanceof Error
                ? error.message
                : 'Dataset impact report could not be created.',
          };
        }
      })();
      reportPromises.current.set(reportCacheKey, promise);
      return promise;
    },
    [candidates, dataset, optimize, releases],
  );

  const revalidateReport = useCallback(
    async (report: DatasetImpactReport) => {
      const current = await loadReport(report.buildId);
      if (
        current.status !== 'ready' ||
        current.report.impactKeyFingerprint !== report.impactKeyFingerprint ||
        current.report.reportFingerprint !== report.reportFingerprint
      ) {
        throw new Error('Build or dataset changed. Recalculate report.');
      }
      return candidates.find((candidate) => candidate.id === report.buildId)!;
    },
    [candidates, loadReport],
  );

  const loadReleaseStepPlan = useCallback(
    async (report: DatasetImpactReport, stepIndex: number) => {
      const candidate = await revalidateReport(report);
      const step = report.trail[stepIndex];
      if (!step || step.status === 'gap') return null;
      const cacheKey = `${report.buildId}:${report.impactKeyFingerprint}:${step.fromVersion}:${step.toVersion}`;
      const cached = releaseStepPromises.current.get(cacheKey);
      if (cached) return cached;
      const promise = (async () => {
        const [from, to] = await Promise.all([
          dataset.getSnapshot(step.fromVersion),
          dataset.getSnapshot(step.toVersion),
        ]);
        if (!from || !to) return null;
        return buildDatasetReleaseStepPlanImpact({
          profile: candidate.profile,
          from,
          to,
          ...(optimize ? { optimize } : {}),
        });
      })();
      releaseStepPromises.current.set(cacheKey, promise);
      return promise;
    },
    [dataset, optimize, revalidateReport],
  );

  const loadPreview = useCallback(
    async (
      report: DatasetImpactReport,
      endpoint: 'pinned' | 'current',
    ) => {
      const candidate = await revalidateReport(report);
      const version =
        endpoint === 'pinned' ? report.pinned.version : report.target.version;
      const cacheKey = `${report.buildId}:${report.impactKeyFingerprint}:preview:${version}`;
      const cached = previewPromises.current.get(cacheKey);
      if (cached) return cached;
      const promise = dataset.getSnapshot(version).then((snapshot) => {
        if (!snapshot) {
          throw new Error(`Dataset ${version} is unavailable for preview.`);
        }
        return (optimize ?? optimizeBuild)(
          {
            ...structuredClone(candidate.profile),
            datasetVersion: version,
          },
          snapshot,
        );
      });
      previewPromises.current.set(cacheKey, promise);
      return promise;
    },
    [dataset, optimize, revalidateReport],
  );

  const keepPinned = useCallback(
    async (report: DatasetImpactReport) => {
      const candidate = await revalidateReport(report);
      const receipt: DatasetReviewReceipt = {
        schemaVersion: 1,
        buildId: report.buildId,
        inputFingerprint: report.inputFingerprint,
        pinnedDatasetVersion: report.pinned.version,
        targetDatasetVersion: report.target.version,
        impactKeyFingerprint: report.impactKeyFingerprint,
        reportFingerprint: report.reportFingerprint,
        status: 'reviewed',
        reviewedAt: now(),
      };
      const source =
        candidate.source === 'active'
          ? candidate.backingSource
          : candidate.source;
      if (
        cloud?.isAuthenticated &&
        (source === 'cloud' || source === 'local+cloud')
      ) {
        await cloud.repository.saveDatasetReview(receipt);
      } else {
        await receiptStore.save(receipt);
      }
      setLocalReceipts((current) => mergeReceipts(current, [receipt]));
    },
    [cloud, now, receiptStore, revalidateReport],
  );

  const applyUpdate = useCallback(
    async (report: DatasetImpactReport) => {
      if (!cloud) throw new Error('Dataset update repository is unavailable.');
      const candidate = await revalidateReport(report);
      const receipt: DatasetReviewReceipt = {
        schemaVersion: 1,
        buildId: report.buildId,
        inputFingerprint: report.inputFingerprint,
        pinnedDatasetVersion: report.pinned.version,
        targetDatasetVersion: report.target.version,
        impactKeyFingerprint: report.impactKeyFingerprint,
        reportFingerprint: report.reportFingerprint,
        status: 'applied',
        reviewedAt: now(),
      };
      const result = await cloud.repository.applyDatasetUpdate(
        {
          profile: candidate.profile,
          kind: candidate.savedKind ?? 'build',
          active: candidate.source === 'active',
          expectedInputFingerprint: report.inputFingerprint,
          ...(candidate.headRevisionId
            ? { expectedHeadRevisionId: candidate.headRevisionId }
            : {}),
          targetDatasetVersion: report.target.version,
          recoveryRevisionId: crypto.randomUUID(),
          updateRevisionId: crypto.randomUUID(),
          receipt,
        },
        {
          source:
            candidate.source === 'active'
              ? (candidate.backingSource ?? 'active')
              : candidate.source,
        },
      );
      await draft.refreshSavedBuilds();
      if (
        candidate.source === 'active' &&
        result.profile.datasetVersion === report.target.version
      ) {
        draft.replaceDraft(result.profile);
      }
      if (result.profile.datasetVersion === report.target.version) {
        setLocalReceipts((current) => mergeReceipts(current, [receipt]));
      }
    },
    [cloud, draft, now, revalidateReport],
  );

  const value = useMemo<DatasetUpdatesState>(
    () => ({
      candidates,
      unreviewedCount: candidates.filter(
        (candidate) => candidate.status === 'unreviewed',
      ).length,
      isHydrated,
      storageError,
      loadReport,
      loadReleaseStepPlan,
      loadPreview,
      keepPinned,
      applyUpdate,
      refresh,
    }),
    [
      applyUpdate,
      candidates,
      isHydrated,
      keepPinned,
      loadReport,
      loadReleaseStepPlan,
      loadPreview,
      refresh,
      storageError,
    ],
  );

  return (
    <DatasetUpdatesContext.Provider value={value}>
      {children}
    </DatasetUpdatesContext.Provider>
  );
}
