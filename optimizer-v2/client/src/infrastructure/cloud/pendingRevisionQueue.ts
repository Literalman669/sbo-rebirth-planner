import { openDB } from 'idb';
import { z } from 'zod';
import type { CharacterProfile } from '../../domain/build/model';
import { characterProfileSchema } from '../../domain/build/schema';
import {
  DEFAULT_GUEST_DATABASE_NAME,
  GUEST_DATABASE_VERSION,
} from '../storage/guestBuildStore';

const pendingRevisionSchema = z.object({
  revisionId: z.string().min(1).max(100),
  buildId: z.string().min(1).max(100),
  profile: characterProfileSchema,
  parentRevisionId: z.string().min(1).max(100).optional(),
  enqueuedAt: z.iso.datetime(),
  attempts: z.number().int().min(0),
});

export interface PendingRevision {
  revisionId: string;
  buildId: string;
  profile: CharacterProfile;
  parentRevisionId?: string;
  enqueuedAt: string;
  attempts: number;
}

export interface PendingRevisionQueue {
  enqueue(revision: PendingRevision): Promise<void>;
  list(): Promise<PendingRevision[]>;
  acknowledge(revisionId: string): Promise<void>;
  incrementAttempts(revisionId: string): Promise<void>;
}

type PendingRevisionQueueOptions = { databaseName?: string };

export function createPendingRevisionQueue({
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
}: PendingRevisionQueueOptions = {}): PendingRevisionQueue {
  const databasePromise = openDB(databaseName, GUEST_DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('draft')) {
        database.createObjectStore('draft');
      }
      if (!database.objectStoreNames.contains('builds')) {
        database.createObjectStore('builds');
      }
      if (!database.objectStoreNames.contains('pending-revisions')) {
        database.createObjectStore('pending-revisions');
      }
    },
  });

  return {
    async enqueue(revision) {
      const valid = pendingRevisionSchema.parse(revision);
      const database = await databasePromise;
      await database.put('pending-revisions', valid, valid.revisionId);
    },

    async list() {
      const database = await databasePromise;
      const rows = await database.getAll('pending-revisions');
      return rows
        .map((row) => pendingRevisionSchema.parse(row))
        .sort(
          (left, right) =>
            left.enqueuedAt.localeCompare(right.enqueuedAt) ||
            left.revisionId.localeCompare(right.revisionId),
        );
    },

    async acknowledge(revisionId) {
      const database = await databasePromise;
      await database.delete('pending-revisions', revisionId);
    },

    async incrementAttempts(revisionId) {
      const database = await databasePromise;
      const transaction = database.transaction('pending-revisions', 'readwrite');
      const raw = await transaction.store.get(revisionId);
      if (raw === undefined) {
        await transaction.done;
        return;
      }
      const current = pendingRevisionSchema.parse(raw);
      await transaction.store.put(
        { ...current, attempts: current.attempts + 1 },
        revisionId,
      );
      await transaction.done;
    },
  };
}
