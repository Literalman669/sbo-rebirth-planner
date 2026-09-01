export const MAX_PROGRESS_OBJECTIVES = 200;
export const MAX_PROGRESS_HISTORY = 1_000;

export type ServerProgressObjective = {
  actionKey: string;
  category:
    | 'stat-allocation'
    | 'equipment-upgrade'
    | 'level-milestone'
    | 'floor-milestone'
    | 'manual-objective';
  status: 'pending' | 'completed' | 'skipped';
  source: 'automatic' | 'manual' | 'legacy';
  planFingerprint: string;
  updatedAt?: string;
  note?: string;
};

export type ServerProgressHistoryEvent = {
  id: string;
  actionKey: string;
  category: ServerProgressObjective['category'];
  label: string;
  outcome: 'completed' | 'skipped' | 'reopened' | 'superseded';
  source: ServerProgressObjective['source'];
  planFingerprint: string;
  datasetVersion?: string;
  occurredAt?: string;
  note?: string;
};

export type ServerPlanProgress = {
  schemaVersion: 2;
  buildId: string;
  wallet?: { balance: number; updatedAt: string };
  objectives: ServerProgressObjective[];
  history: ServerProgressHistoryEvent[];
  currentPlanFingerprint?: string;
  reconciledThroughLevel?: number;
  acknowledgedDatasetVersion?: string;
};

type LegacyPlanProgress = {
  schemaVersion: 1;
  buildId: string;
  completedActionIds: string[];
  dismissedRecommendationIds: string[];
  reconciledThroughLevel?: number;
  acknowledgedDatasetVersion?: string;
};

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function legacyCategory(actionKey: string): ServerProgressObjective['category'] {
  if (actionKey.startsWith('spend-stats:')) return 'stat-allocation';
  if (actionKey.startsWith('equipment:')) return 'equipment-upgrade';
  return 'manual-objective';
}

function boundedLegacyId(actionKey: string, outcome: 'completed' | 'skipped') {
  const readable = `legacy:${outcome}:${actionKey}`;
  if (readable.length <= 255) return readable;
  let hash = 0x811c9dc5;
  for (let index = 0; index < readable.length; index += 1) {
    hash ^= readable.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `legacy:${outcome}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function migrateServerPlanProgress(
  progress: LegacyPlanProgress | ServerPlanProgress,
): ServerPlanProgress {
  if (progress.schemaVersion === 2) return clonePlain(progress);
  const completed = new Set(progress.completedActionIds);
  const objectives: ServerProgressObjective[] = [
    ...progress.completedActionIds.map((actionKey) => ({
      actionKey,
      category: legacyCategory(actionKey),
      status: 'completed' as const,
      source: 'legacy' as const,
      planFingerprint: 'legacy',
    })),
    ...progress.dismissedRecommendationIds
      .filter((actionKey) => !completed.has(actionKey))
      .map((actionKey) => ({
        actionKey,
        category: legacyCategory(actionKey),
        status: 'skipped' as const,
        source: 'legacy' as const,
        planFingerprint: 'legacy',
      })),
  ];
  const history: ServerProgressHistoryEvent[] = [
    ...progress.completedActionIds.map((actionKey) => ({
      id: boundedLegacyId(actionKey, 'completed'),
      actionKey,
      category: legacyCategory(actionKey),
      label: actionKey.slice(0, 200),
      outcome: 'completed' as const,
      source: 'legacy' as const,
      planFingerprint: 'legacy',
    })),
    ...progress.dismissedRecommendationIds.map((actionKey) => ({
      id: boundedLegacyId(actionKey, 'skipped'),
      actionKey,
      category: legacyCategory(actionKey),
      label: actionKey.slice(0, 200),
      outcome: 'skipped' as const,
      source: 'legacy' as const,
      planFingerprint: 'legacy',
    })),
  ];
  return {
    schemaVersion: 2,
    buildId: progress.buildId,
    objectives,
    history,
    ...(progress.reconciledThroughLevel === undefined
      ? {}
      : { reconciledThroughLevel: progress.reconciledThroughLevel }),
    ...(progress.acknowledgedDatasetVersion === undefined
      ? {}
      : { acknowledgedDatasetVersion: progress.acknowledgedDatasetVersion }),
  };
}

function latest<T extends { updatedAt?: string }>(left: T, right: T): T {
  const comparison = (left.updatedAt ?? '').localeCompare(right.updatedAt ?? '');
  if (comparison > 0) return left;
  if (comparison < 0) return right;
  return JSON.stringify(left).localeCompare(JSON.stringify(right)) >= 0
    ? left
    : right;
}

function optionalLexicalMax(left?: string, right?: string) {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return left.localeCompare(right) >= 0 ? left : right;
}

export function mergePlanProgress(
  current: ServerPlanProgress | undefined,
  incoming: ServerPlanProgress,
): ServerPlanProgress {
  if (!current) {
    const canonical = clonePlain(incoming);
    canonical.objectives.sort((left, right) =>
      left.actionKey.localeCompare(right.actionKey),
    );
    canonical.history.sort(
      (left, right) =>
        (left.occurredAt ?? '').localeCompare(right.occurredAt ?? '') ||
        left.id.localeCompare(right.id),
    );
    if (canonical.objectives.length > MAX_PROGRESS_OBJECTIVES) {
      throw new Error('Progress objective limit reached');
    }
    if (canonical.history.length > MAX_PROGRESS_HISTORY) {
      throw new Error('Progress history limit reached');
    }
    return canonical;
  }
  if (current.buildId !== incoming.buildId) {
    throw new Error('Progress build ID mismatch');
  }

  const histories = new Map<string, ServerProgressHistoryEvent>();
  for (const event of [...current.history, ...incoming.history]) {
    const existing = histories.get(event.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) {
      throw new Error('Progress history event ID conflict');
    }
    histories.set(event.id, clonePlain(event));
  }
  const objectives = new Map<string, ServerProgressObjective>();
  for (const objective of [...current.objectives, ...incoming.objectives]) {
    const existing = objectives.get(objective.actionKey);
    objectives.set(
      objective.actionKey,
      clonePlain(existing ? latest(existing, objective) : objective),
    );
  }
  const history = [...histories.values()].sort(
    (left, right) =>
      (left.occurredAt ?? '').localeCompare(right.occurredAt ?? '') ||
      left.id.localeCompare(right.id),
  );
  const objectiveList = [...objectives.values()].sort((left, right) =>
    left.actionKey.localeCompare(right.actionKey),
  );
  if (objectiveList.length > MAX_PROGRESS_OBJECTIVES) {
    throw new Error('Progress objective limit reached');
  }
  if (history.length > MAX_PROGRESS_HISTORY) {
    throw new Error('Progress history limit reached');
  }
  const wallet =
    current.wallet && incoming.wallet
      ? latest(current.wallet, incoming.wallet)
      : current.wallet ?? incoming.wallet;
  const reconciledThroughLevel = Math.max(
    current.reconciledThroughLevel ?? 0,
    incoming.reconciledThroughLevel ?? 0,
  );
  return {
    schemaVersion: 2,
    buildId: current.buildId,
    ...(wallet ? { wallet: clonePlain(wallet) } : {}),
    objectives: objectiveList,
    history,
    ...(optionalLexicalMax(
      current.currentPlanFingerprint,
      incoming.currentPlanFingerprint,
    ) === undefined
      ? {}
      : {
          currentPlanFingerprint: optionalLexicalMax(
            current.currentPlanFingerprint,
            incoming.currentPlanFingerprint,
          ),
        }),
    ...(reconciledThroughLevel === 0 ? {} : { reconciledThroughLevel }),
    ...(optionalLexicalMax(
      current.acknowledgedDatasetVersion,
      incoming.acknowledgedDatasetVersion,
    ) === undefined
      ? {}
      : {
          acknowledgedDatasetVersion: optionalLexicalMax(
            current.acknowledgedDatasetVersion,
            incoming.acknowledgedDatasetVersion,
          ),
        }),
  };
}
