import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../build/model';
import { createEmptyPlanProgress } from './schema';
import {
  reconcileProgress,
  setManualTaskState,
} from './reconcile';
import type { ProgressTask } from './tasks';

const now = '2026-09-01T12:00:00.000Z';
const profile: CharacterProfile = {
  schemaVersion: 2,
  id: 'progress-build',
  level: 11,
  maxFloor: 3,
  weaponPath: 'two-handed',
  goal: 'balanced',
  stats: { str: 13, def: 5, agi: 5, vit: 5, luk: 5 },
  equipped: { 'main-hand': 'iron-greatsword', armor: 'fields-warrior' },
  ownedItemIds: ['fields-warrior'],
  datasetVersion: '2026.08.30.1',
};
const tasks: ProgressTask[] = [
  {
    id: 'spend-stats:level:11',
    actionKey: 'spend-stats:level:11',
    group: 'next-level',
    kind: 'spend-stats',
    category: 'stat-allocation',
    planFingerprint: 'plan-new',
    automatic: true,
    title: 'Allocate Level 11 points',
    detail: 'STR +3',
    targetLevel: 11,
    targetStats: { str: 13, def: 5, agi: 5, vit: 5, luk: 5 },
  },
  {
    id: 'equipment:armor:fields-warrior',
    actionKey: 'equipment:armor:fields-warrior',
    group: 'do-now',
    kind: 'equip',
    category: 'equipment-upgrade',
    planFingerprint: 'plan-new',
    automatic: true,
    title: 'Equip Fields Warrior',
    detail: 'Owned',
    itemId: 'fields-warrior',
    slot: 'armor',
  },
  {
    id: 'floor:unlock:3',
    actionKey: 'floor:unlock:3',
    group: 'next-floor',
    kind: 'unlock',
    category: 'floor-milestone',
    planFingerprint: 'plan-new',
    automatic: false,
    title: 'Unlock Floor 3',
    detail: 'Confirm in Character',
    targetFloor: 3,
  },
];

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++] ?? `event-${index}`;
}

describe('progress reconciliation', () => {
  it('records detectable completions once across repeated reconciliation', () => {
    const first = reconcileProgress({
      profile,
      progress: createEmptyPlanProgress(profile.id),
      tasks,
      planFingerprint: 'plan-new',
      datasetVersion: profile.datasetVersion,
      now: () => now,
      randomUUID: ids('event-1', 'event-2', 'event-3'),
    });
    const second = reconcileProgress({
      profile,
      progress: first.progress,
      tasks,
      planFingerprint: 'plan-new',
      datasetVersion: profile.datasetVersion,
      now: () => now,
      randomUUID: ids('event-4'),
    });

    expect(first.newlyCompleted.map((task) => task.actionKey)).toEqual([
      'spend-stats:level:11',
      'equipment:armor:fields-warrior',
      'floor:unlock:3',
    ]);
    expect(first.progress.history).toHaveLength(3);
    expect(first.progress.history.every((event) => event.source === 'automatic')).toBe(true);
    expect(second.newlyCompleted).toEqual([]);
    expect(second.progress).toEqual(first.progress);
  });

  it('moves unfinished objectives from an older plan into superseded history', () => {
    const progress = {
      ...createEmptyPlanProgress(profile.id),
      currentPlanFingerprint: 'plan-old',
      objectives: [
        {
          actionKey: 'equipment:armor:old',
          category: 'equipment-upgrade' as const,
          status: 'pending' as const,
          source: 'manual' as const,
          planFingerprint: 'plan-old',
          updatedAt: '2026-09-01T10:00:00.000Z',
        },
      ],
    };

    const result = reconcileProgress({
      profile: { ...profile, level: 10, maxFloor: 2, ownedItemIds: [], equipped: {} },
      progress,
      tasks: [tasks[0]!],
      planFingerprint: 'plan-new',
      datasetVersion: profile.datasetVersion,
      now: () => now,
      randomUUID: ids('event-superseded'),
    });

    expect(result.superseded).toEqual(['equipment:armor:old']);
    expect(result.progress.objectives.map((item) => item.actionKey)).not.toContain(
      'equipment:armor:old',
    );
    expect(result.progress.history[0]).toMatchObject({
      id: 'event-superseded',
      actionKey: 'equipment:armor:old',
      outcome: 'superseded',
    });
  });

  it('records manual complete, reopen, and note changes without duplicate transitions', () => {
    const task: ProgressTask = {
      id: 'manual:quest',
      actionKey: 'manual:quest',
      group: 'do-now',
      kind: 'unlock',
      category: 'manual-objective',
      planFingerprint: 'plan-new',
      automatic: false,
      title: 'Complete the field quest',
      detail: 'Confirm in game',
    };
    const completed = setManualTaskState({
      progress: createEmptyPlanProgress(profile.id),
      task,
      status: 'completed',
      now: () => now,
      randomUUID: ids('event-completed'),
    });
    const repeated = setManualTaskState({
      progress: completed,
      task,
      status: 'completed',
      now: () => now,
      randomUUID: ids('unused'),
    });
    const reopened = setManualTaskState({
      progress: repeated,
      task,
      status: 'pending',
      note: 'Try again with a party',
      now: () => '2026-09-01T13:00:00.000Z',
      randomUUID: ids('event-reopened'),
    });

    expect(completed.history).toHaveLength(1);
    expect(repeated).toEqual(completed);
    expect(reopened.objectives[0]).toMatchObject({
      status: 'pending',
      note: 'Try again with a party',
    });
    expect(reopened.history.at(-1)?.outcome).toBe('reopened');
  });

  it('reconciles twenty material plan changes without duplicate history', () => {
    let progress = createEmptyPlanProgress(profile.id);
    let finalTask: ProgressTask | undefined;
    for (let index = 0; index < 20; index += 1) {
      const fingerprint = `plan-change-${index}`;
      finalTask = {
        id: `manual:route:${index}`,
        actionKey: `manual:route:${index}`,
        group: 'next-floor',
        kind: 'unlock',
        category: 'manual-objective',
        planFingerprint: fingerprint,
        automatic: false,
        title: `Route change ${index}`,
        detail: 'Confirm in game',
      };
      progress = reconcileProgress({
        profile,
        progress,
        tasks: [finalTask],
        planFingerprint: fingerprint,
        datasetVersion: profile.datasetVersion,
        now: () => now,
        randomUUID: () => `plan-change-event-${index}`,
      }).progress;
    }

    expect(progress.objectives).toHaveLength(1);
    expect(progress.objectives[0]?.actionKey).toBe('manual:route:19');
    expect(progress.history).toHaveLength(19);
    expect(new Set(progress.history.map((event) => event.id)).size).toBe(19);

    const repeated = reconcileProgress({
      profile,
      progress,
      tasks: [finalTask!],
      planFingerprint: 'plan-change-19',
      datasetVersion: profile.datasetVersion,
      now: () => now,
      randomUUID: () => 'unused-event',
    });
    expect(repeated.progress).toEqual(progress);
  });
});
