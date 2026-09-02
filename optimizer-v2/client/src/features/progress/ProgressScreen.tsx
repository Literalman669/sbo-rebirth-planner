import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBuildDraft } from '../../app/providers/BuildDraftContext';
import {
  resolveDatasetSnapshot,
  useDataset,
} from '../../app/providers/DatasetProvider';
import { usePlannerState } from '../../app/providers/PlannerStateContext';
import { useOptionalCloudBuilds } from '../../app/providers/CloudBuildsContext';
import { findBuildLibraryEntry, mergeBuildLibrary } from '../../domain/build/library';
import type { DatasetSnapshot } from '../../domain/dataset/model';
import type { PlanProgress } from '../../domain/progress/model';
import { optimizeBuild } from '../../domain/optimizer/optimizeBuild';
import { fingerprintRecommendationInput } from '../../domain/optimizer/planFingerprint';
import { selectNextProgressTask } from '../../domain/progress/priority';
import {
  reconcileProgress,
  setManualTaskState,
} from '../../domain/progress/reconcile';
import { planProgressSchema } from '../../domain/progress/schema';
import { buildShoppingPlan } from '../../domain/progress/shopping';
import { generateProgressTasks } from '../../domain/progress/tasks';
import { ProgressBuildSwitcher } from './ProgressBuildSwitcher';
import { FloorMilestones } from './FloorMilestones';
import { JourneyHistory } from './JourneyHistory';
import { NextMoveCard } from './NextMoveCard';
import { ProgressChecklist } from './ProgressChecklist';
import { ProgressContextHeader } from './ProgressContextHeader';
import { ProgressLimitRecovery } from './ProgressLimitRecovery';
import { ShoppingPlan } from './ShoppingPlan';

export function ProgressScreen() {
  const { draft, savedBuilds } = useBuildDraft();
  const { snapshot, getSnapshot } = useDataset();
  const planner = usePlannerState();
  const cloud = useOptionalCloudBuilds();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('build');
  const selectedSource = searchParams.get('source');
  const entries = useMemo(
    () =>
      mergeBuildLibrary(savedBuilds, [
        ...(cloud?.cloudBuilds ?? []),
        ...(cloud?.archivedCloudBuilds ?? []),
      ]),
    [cloud?.archivedCloudBuilds, cloud?.cloudBuilds, savedBuilds],
  );
  const selectedEntry = selectedId
    ? findBuildLibraryEntry(entries, selectedId)
    : null;
  const viewedProfile = selectedEntry?.profile ?? draft;
  const viewingActive = !selectedEntry;
  const selectedValue = selectedEntry
    ? `${selectedSource === 'cloud' && selectedEntry.source !== 'local' ? 'cloud' : 'local'}:${selectedEntry.id}`
    : 'active';
  const [viewedProgress, setViewedProgress] = useState<PlanProgress | null>(null);
  const [resolvedDataset, setResolvedDataset] = useState<{
    key: string;
    snapshot: DatasetSnapshot | null;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const datasetResolutionKey = `${viewedProfile.id}:${viewedProfile.datasetVersion}`;

  useEffect(() => {
    let active = true;
    if (viewingActive) {
      setViewedProgress(null);
      return () => {
        active = false;
      };
    }
    void planner.loadProgressForBuild(viewedProfile.id).then((loaded) => {
      if (active) setViewedProgress(loaded);
    });
    return () => {
      active = false;
    };
  }, [planner.loadProgressForBuild, viewedProfile.id, viewingActive]);

  useEffect(() => {
    let active = true;
    setResolvedDataset(null);
    const resolution = viewedProfile.datasetVersion === snapshot.version
      ? Promise.resolve(snapshot)
      : resolveDatasetSnapshot(getSnapshot, viewedProfile.datasetVersion);
    void resolution.then((resolved) => {
      if (active) {
        setResolvedDataset({ key: datasetResolutionKey, snapshot: resolved });
      }
    });
    return () => {
      active = false;
    };
  }, [datasetResolutionKey, getSnapshot, snapshot, viewedProfile.datasetVersion]);

  const progress = viewingActive ? planner.progress : viewedProgress;
  const exactSnapshot = resolvedDataset?.key === datasetResolutionKey
    ? resolvedDataset.snapshot
    : undefined;
  const planFingerprint = useMemo(
    () => exactSnapshot
      ? fingerprintRecommendationInput(viewedProfile, exactSnapshot)
      : '',
    [exactSnapshot, viewedProfile],
  );
  const plan = useMemo(() => {
    if (!exactSnapshot) return null;
    try {
      return optimizeBuild(viewedProfile, exactSnapshot);
    } catch {
      return null;
    }
  }, [exactSnapshot, viewedProfile]);
  const tasks = useMemo(
    () =>
      plan && exactSnapshot
        ? generateProgressTasks(viewedProfile, plan, exactSnapshot, planFingerprint)
        : [],
    [exactSnapshot, plan, planFingerprint, viewedProfile],
  );
  const reconciliationState = useMemo(() => {
    if (!progress || !exactSnapshot) return { result: null, error: null };
    try {
      return {
        result: reconcileProgress({
          profile: viewedProfile,
          progress,
          tasks,
          planFingerprint,
          datasetVersion: exactSnapshot.version,
          now: () => new Date().toISOString(),
          randomUUID: () => crypto.randomUUID(),
        }),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Progress reconciliation failed',
      };
    }
  },
    [exactSnapshot, planFingerprint, progress, tasks, viewedProfile],
  );
  const reconciliation = reconciliationState.result;
  const saveViewedProgress = useCallback(
    async (next: PlanProgress) => {
      if (
        !viewingActive &&
        cloud?.isAuthenticated &&
        selectedEntry?.source !== 'local'
      ) {
        await cloud.repository.savePlanProgress(next);
        await cloud.refreshPending();
        return;
      }
      await planner.saveProgressForBuild(next);
    },
    [
      cloud,
      planner.saveProgressForBuild,
      selectedEntry?.source,
      viewingActive,
    ],
  );

  useEffect(() => {
    if (!planner.isHydrated || !reconciliation || reconciliation.progress === progress) {
      return;
    }
    if (!viewingActive) setViewedProgress(reconciliation.progress);
    void saveViewedProgress(reconciliation.progress).catch(() => undefined);
  }, [planner.isHydrated, progress, reconciliation, saveViewedProgress, viewingActive]);

  const resetProgress = async () => {
    try {
      await planner.resetProgressForBuild(viewedProfile.id);
      const hasCloudTarget = Boolean(
        cloud?.isAuthenticated &&
        ((selectedEntry !== null && selectedEntry.source !== 'local') ||
          cloud.cloudBuilds.some((record) => record.profile.id === viewedProfile.id) ||
          cloud.archivedCloudBuilds.some((record) => record.profile.id === viewedProfile.id)),
      );
      if (hasCloudTarget && cloud) {
        await cloud.repository.resetPlanProgress(viewedProfile.id);
        await cloud.refreshPending();
      }
      const empty = await planner.loadProgressForBuild(viewedProfile.id);
      if (!viewingActive) setViewedProgress(empty);
      setStatusMessage('Progress reset');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Progress reset failed',
      );
    }
  };

  if (!planner.isHydrated || !progress || exactSnapshot === undefined) {
    return <main className="progress-screen"><h2>Loading progress…</h2></main>;
  }
  if (exactSnapshot === null) {
    return (
      <main className="progress-screen progress-dataset-unavailable">
        <h2 data-screen-heading tabIndex={-1}>Pinned dataset unavailable</h2>
        <p>
          This build requires dataset <strong>{viewedProfile.datasetVersion}</strong>.
          Progress calculations are paused so the app does not substitute different game data.
        </p>
      </main>
    );
  }
  if (reconciliationState.error) {
    return (
      <ProgressLimitRecovery
        message={reconciliationState.error}
        onReset={resetProgress}
      />
    );
  }
  if (!reconciliation) {
    return <main className="progress-screen"><h2>Progress plan unavailable</h2></main>;
  }
  const nextMove = selectNextProgressTask(reconciliation.activeTasks);
  const shoppingPlan = buildShoppingPlan(
    reconciliation.activeTasks,
    reconciliation.progress.wallet,
  );
  const notesByAction = new Map(
    reconciliation.progress.objectives.flatMap((objective) =>
      objective.note ? [[objective.actionKey, objective.note] as const] : [],
    ),
  );
  const persistProgress = (next: PlanProgress, message: string) => {
    if (!viewingActive) setViewedProgress(next);
    setStatusMessage('Saving progress…');
    void saveViewedProgress(next)
      .then(() => setStatusMessage(message))
      .catch((error: unknown) => {
        setStatusMessage(
          error instanceof Error ? error.message : 'Progress save failed',
        );
      });
  };
  const setTaskStatus = (
    task: (typeof reconciliation.activeTasks)[number],
    status: 'completed' | 'skipped' | 'pending',
    note?: string,
  ) => {
    persistProgress(
      setManualTaskState({
        progress: reconciliation.progress,
        task,
        status,
        ...(note === undefined ? {} : { note }),
        now: () => new Date().toISOString(),
        randomUUID: () => crypto.randomUUID(),
      }),
      status === 'completed'
        ? 'Task completed'
        : status === 'skipped'
          ? 'Task skipped'
          : 'Task reopened',
    );
  };
  const saveBalance = (balance: number | undefined) => {
    if (
      balance !== undefined &&
      (!Number.isSafeInteger(balance) || balance < 0)
    ) {
      setStatusMessage('Current Col must be a non-negative whole number');
      return;
    }
    const next = structuredClone(reconciliation.progress);
    if (balance === undefined) delete next.wallet;
    else next.wallet = { balance, updatedAt: new Date().toISOString() };
    persistProgress(planProgressSchema.parse(next), 'Col balance saved');
  };
  const selectBuild = (value: string) => {
    if (value === 'active') {
      setSearchParams({});
      return;
    }
    const [source, ...idParts] = value.split(':');
    setSearchParams({ build: idParts.join(':'), source });
  };
  return (
    <main className="progress-screen">
      <header>
        <p className="eyebrow">Active journey</p>
        <h2 data-screen-heading tabIndex={-1}>Progress</h2>
        <p>{viewedProfile.name ?? `Level ${viewedProfile.level} build`}</p>
        <ProgressBuildSwitcher
          activeProfile={draft}
          entries={entries}
          value={selectedValue}
          onChange={selectBuild}
        />
      </header>
      <ProgressContextHeader
        profile={viewedProfile}
        source={viewingActive ? 'Active draft' : selectedEntry?.source ?? 'Local'}
        progress={reconciliation.progress}
        taskActionKeys={tasks.map((task) => task.actionKey)}
      />
      {statusMessage ? <p role="status">{statusMessage}</p> : null}
      <NextMoveCard task={nextMove} />
      <div className="progress-dashboard-grid">
        <ProgressChecklist
          tasks={reconciliation.activeTasks}
          onComplete={(task) => setTaskStatus(task, 'completed')}
          onSkip={(task) => setTaskStatus(task, 'skipped')}
          notesByAction={notesByAction}
          onSaveNote={(task, note) => setTaskStatus(task, 'pending', note)}
        />
        <ShoppingPlan
          plan={shoppingPlan}
          balance={reconciliation.progress.wallet?.balance}
          onSaveBalance={saveBalance}
        />
        <FloorMilestones profile={viewedProfile} tasks={tasks} />
        <JourneyHistory
          events={reconciliation.progress.history}
          onReopen={(actionKey) => {
            const task = tasks.find((candidate) => candidate.actionKey === actionKey);
            if (task) setTaskStatus(task, 'pending');
          }}
          onReset={resetProgress}
        />
      </div>
    </main>
  );
}
