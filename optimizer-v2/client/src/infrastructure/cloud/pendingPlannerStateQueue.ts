import { z } from 'zod';
import type {
  PlannerPreferences,
  PlanProgress,
} from '../../domain/planner/state';
import type { InventoryState } from '../../domain/inventory/state';
import { inventoryStateSchema } from '../../domain/inventory/stateSchema';
import {
  plannerPreferencesSchema,
  planProgressSchema,
} from '../../domain/planner/stateSchema';
import {
  DEFAULT_GUEST_DATABASE_NAME,
  openPlannerDatabase,
} from '../storage/plannerDatabase';

const mutationBase = {
  subject: z.string().min(1).max(255),
  mutationId: z.string().min(1).max(255),
  enqueuedAt: z.iso.datetime(),
  attempts: z.number().int().min(0),
};

const pendingPlannerStateMutationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...mutationBase,
      kind: z.literal('progress'),
      progress: planProgressSchema,
    })
    .strict(),
  z
    .object({
      ...mutationBase,
      kind: z.literal('progress-reset'),
      buildId: z.string().min(1).max(255),
    })
    .strict(),
  z
    .object({
      ...mutationBase,
      kind: z.literal('preferences'),
      preferences: plannerPreferencesSchema,
    })
    .strict(),
  z
    .object({
      ...mutationBase,
      kind: z.literal('inventory'),
      inventory: inventoryStateSchema,
    })
    .strict(),
]);

export type PendingPlannerStateMutation =
  | {
      kind: 'progress';
      subject: string;
      mutationId: string;
      progress: PlanProgress;
      enqueuedAt: string;
      attempts: number;
    }
  | {
      kind: 'progress-reset';
      subject: string;
      mutationId: string;
      buildId: string;
      enqueuedAt: string;
      attempts: number;
    }
  | {
      kind: 'preferences';
      subject: string;
      mutationId: string;
      preferences: PlannerPreferences;
      enqueuedAt: string;
      attempts: number;
    }
  | {
      kind: 'inventory';
      subject: string;
      mutationId: string;
      inventory: InventoryState;
      enqueuedAt: string;
      attempts: number;
    };

export interface PendingPlannerStateQueue {
  enqueue(mutation: PendingPlannerStateMutation): Promise<void>;
  list(subject: string): Promise<PendingPlannerStateMutation[]>;
  acknowledge(subject: string, mutationId: string): Promise<void>;
  incrementAttempts(subject: string, mutationId: string): Promise<void>;
}

type PendingPlannerStateQueueOptions = { databaseName?: string };

function queueKey(subject: string, mutationId: string) {
  return `${subject}:${mutationId}`;
}

export function createPendingPlannerStateQueue({
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
}: PendingPlannerStateQueueOptions = {}): PendingPlannerStateQueue {
  const databasePromise = openPlannerDatabase(databaseName);
  return {
    async enqueue(mutation) {
      const valid = pendingPlannerStateMutationSchema.parse(mutation);
      const database = await databasePromise;
      await database.put(
        'pending-planner-state',
        valid,
        queueKey(valid.subject, valid.mutationId),
      );
    },

    async list(subject) {
      const validSubject = z.string().min(1).max(255).parse(subject);
      const database = await databasePromise;
      return (await database.getAll('pending-planner-state'))
        .flatMap((row) => {
          const parsed = pendingPlannerStateMutationSchema.safeParse(row);
          return parsed.success && parsed.data.subject === validSubject
            ? [parsed.data]
            : [];
        })
        .sort(
          (left, right) =>
            left.enqueuedAt.localeCompare(right.enqueuedAt) ||
            left.mutationId.localeCompare(right.mutationId),
        );
    },

    async acknowledge(subject, mutationId) {
      const database = await databasePromise;
      await database.delete(
        'pending-planner-state',
        queueKey(subject, mutationId),
      );
    },

    async incrementAttempts(subject, mutationId) {
      const database = await databasePromise;
      const transaction = database.transaction(
        'pending-planner-state',
        'readwrite',
      );
      const key = queueKey(subject, mutationId);
      const raw = await transaction.store.get(key);
      if (raw !== undefined) {
        const current = pendingPlannerStateMutationSchema.parse(raw);
        await transaction.store.put(
          { ...current, attempts: current.attempts + 1 },
          key,
        );
      }
      await transaction.done;
    },
  };
}
