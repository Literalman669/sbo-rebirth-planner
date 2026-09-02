import type { CharacterProfile } from '../build/model';
import {
  MAX_PROGRESS_HISTORY,
  MAX_PROGRESS_OBJECTIVES,
  type PlanProgress,
  type ProgressHistoryEvent,
  type ProgressObjectiveState,
} from './model';
import { planProgressSchema } from './schema';
import {
  isProgressTaskAutomaticallyComplete,
  type ProgressTask,
} from './tasks';

type ReconcileInput = {
  profile: CharacterProfile;
  progress: PlanProgress;
  tasks: readonly ProgressTask[];
  planFingerprint: string;
  datasetVersion: string;
  now(): string;
  randomUUID(): string;
};

export function reconcileProgress(_input: ReconcileInput): {
  progress: PlanProgress;
  activeTasks: ProgressTask[];
  newlyCompleted: ProgressTask[];
  superseded: string[];
} {
  const input = _input;
  const tasksByKey = new Map(input.tasks.map((task) => [task.actionKey, task]));
  const existingByKey = new Map(
    input.progress.objectives.map((objective) => [objective.actionKey, objective]),
  );
  const objectives: ProgressObjectiveState[] = [];
  const history = input.progress.history.map((event) => structuredClone(event));
  const newlyCompleted: ProgressTask[] = [];
  const superseded: string[] = [];
  let changed = input.progress.currentPlanFingerprint !== input.planFingerprint;

  for (const objective of input.progress.objectives) {
    if (tasksByKey.has(objective.actionKey)) continue;
    if (objective.status === 'pending') {
      history.push({
        id: input.randomUUID(),
        actionKey: objective.actionKey,
        category: objective.category,
        label: objective.actionKey.slice(0, 200),
        outcome: 'superseded',
        source: 'automatic',
        planFingerprint: input.planFingerprint,
        datasetVersion: input.datasetVersion,
        occurredAt: input.now(),
        ...(objective.note ? { note: objective.note } : {}),
      });
      superseded.push(objective.actionKey);
    }
    changed = true;
  }

  for (const task of input.tasks) {
    const existing = existingByKey.get(task.actionKey);
    const automaticallyComplete = isProgressTaskAutomaticallyComplete(
      task,
      input.profile,
    );
    if (automaticallyComplete && existing?.status !== 'completed') {
      const completedAt = input.now();
      objectives.push({
        actionKey: task.actionKey,
        category: task.category,
        status: 'completed',
        source: 'automatic',
        planFingerprint: input.planFingerprint,
        updatedAt: completedAt,
        ...(existing?.note ? { note: existing.note } : {}),
      });
      history.push({
        id: input.randomUUID(),
        actionKey: task.actionKey,
        category: task.category,
        label: task.title.slice(0, 200),
        outcome: 'completed',
        source: 'automatic',
        planFingerprint: input.planFingerprint,
        datasetVersion: input.datasetVersion,
        occurredAt: completedAt,
        ...(existing?.note ? { note: existing.note } : {}),
      });
      newlyCompleted.push(task);
      changed = true;
      continue;
    }
    if (existing) {
      if (
        existing.planFingerprint === input.planFingerprint &&
        existing.category === task.category
      ) {
        objectives.push(structuredClone(existing));
      } else {
        objectives.push({
          ...structuredClone(existing),
          category: task.category,
          planFingerprint: input.planFingerprint,
          updatedAt: input.now(),
        });
        changed = true;
      }
      continue;
    }
    objectives.push({
      actionKey: task.actionKey,
      category: task.category,
      status: 'pending',
      source: task.automatic ? 'automatic' : 'manual',
      planFingerprint: input.planFingerprint,
      updatedAt: input.now(),
    });
    changed = true;
  }

  if (objectives.length > MAX_PROGRESS_OBJECTIVES) {
    throw new Error('Progress objective limit reached');
  }
  if (history.length > MAX_PROGRESS_HISTORY) {
    throw new Error('Progress history limit reached');
  }

  const progress = changed
    ? planProgressSchema.parse({
        ...structuredClone(input.progress),
        schemaVersion: 2,
        buildId: input.profile.id,
        objectives,
        history,
        currentPlanFingerprint: input.planFingerprint,
      })
    : input.progress;
  const statusByKey = new Map(
    progress.objectives.map((objective) => [objective.actionKey, objective.status]),
  );
  return {
    progress,
    activeTasks: input.tasks.filter(
      (task) => statusByKey.get(task.actionKey) === 'pending',
    ),
    newlyCompleted,
    superseded,
  };
}

export function setManualTaskState(_input: {
  progress: PlanProgress;
  task: ProgressTask;
  status: 'completed' | 'skipped' | 'pending';
  note?: string;
  now(): string;
  randomUUID(): string;
}): PlanProgress {
  const input = _input;
  const existing = input.progress.objectives.find(
    (objective) => objective.actionKey === input.task.actionKey,
  );
  const note =
    input.note === undefined
      ? existing?.note
      : input.note.trim() || undefined;
  if (
    existing?.status === input.status &&
    existing.note === note &&
    existing.planFingerprint === input.task.planFingerprint
  ) {
    return input.progress;
  }

  const updatedAt = input.now();
  const nextObjective: ProgressObjectiveState = {
    actionKey: input.task.actionKey,
    category: input.task.category,
    status: input.status,
    source: 'manual',
    planFingerprint: input.task.planFingerprint,
    updatedAt,
    ...(note ? { note } : {}),
  };
  const objectives = [
    ...input.progress.objectives.filter(
      (objective) => objective.actionKey !== input.task.actionKey,
    ),
    nextObjective,
  ];
  const statusChanged = existing?.status !== input.status;
  const history: ProgressHistoryEvent[] = statusChanged
    ? [
        ...input.progress.history,
        {
          id: input.randomUUID(),
          actionKey: input.task.actionKey,
          category: input.task.category,
          label: input.task.title.slice(0, 200),
          outcome:
            input.status === 'pending' ? 'reopened' : input.status,
          source: 'manual',
          planFingerprint: input.task.planFingerprint,
          occurredAt: updatedAt,
          ...(note ? { note } : {}),
        },
      ]
    : input.progress.history;

  if (objectives.length > MAX_PROGRESS_OBJECTIVES) {
    throw new Error('Progress objective limit reached');
  }
  if (history.length > MAX_PROGRESS_HISTORY) {
    throw new Error('Progress history limit reached');
  }
  return planProgressSchema.parse({
    ...structuredClone(input.progress),
    objectives,
    history,
    currentPlanFingerprint: input.task.planFingerprint,
  });
}
