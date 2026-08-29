import { openDB } from 'idb';
import { z } from 'zod';
import type { CharacterProfile } from '../../domain/build/model';
import { characterProfileSchema } from '../../domain/build/schema';
import {
  DEFAULT_GUEST_DATABASE_NAME,
  GUEST_DATABASE_VERSION,
} from '../storage/guestBuildStore';

const pendingRevisionSchema = z.object({
  subject: z.string().min(1).max(255),
  revisionId: z.string().min(1).max(100),
  buildId: z.string().min(1).max(100),
  profile: characterProfileSchema,
  parentRevisionId: z.string().min(1).max(100).optional(),
  enqueuedAt: z.iso.datetime(),
  attempts: z.number().int().min(0),
});

export interface PendingRevision {
  subject: string;
  revisionId: string;
  buildId: string;
  profile: CharacterProfile;
  parentRevisionId?: string;
  enqueuedAt: string;
  attempts: number;
}

export interface PendingRevisionQueue {
  enqueue(revision: PendingRevision): Promise<void>;
  list(subject: string): Promise<PendingRevision[]>;
  acknowledge(subject: string, revisionId: string): Promise<void>;
  incrementAttempts(subject: string, revisionId: string): Promise<void>;
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
      if (!database.objectStoreNames.contains('dataset-releases')) {
        database.createObjectStore('dataset-releases');
      }
    },
  });

  return {
    async enqueue(revision) {
      const valid = pendingRevisionSchema.parse(revision);
      const database = await databasePromise;
      await database.put(
        'pending-revisions',
        valid,
        `${valid.subject}:${valid.revisionId}`,
      );
    },

    async list(subject) {
      const database = await databasePromise;
      const rows = await database.getAll('pending-revisions');
      return rows
        .flatMap((row) => {
          const result = pendingRevisionSchema.safeParse(row);
          return result.success && result.data.subject === subject
            ? [result.data]
            : [];
        })
        .sort(
          (left, right) =>
            left.enqueuedAt.localeCompare(right.enqueuedAt) ||
            left.revisionId.localeCompare(right.revisionId),
        );
    },

    async acknowledge(subject, revisionId) {
      const database = await databasePromise;
      await database.delete('pending-revisions', `${subject}:${revisionId}`);
    },

    async incrementAttempts(subject, revisionId) {
      const database = await databasePromise;
      const transaction = database.transaction('pending-revisions', 'readwrite');
      const key = `${subject}:${revisionId}`;
      const raw = await transaction.store.get(key);
      if (raw === undefined) {
        await transaction.done;
        return;
      }
      const current = pendingRevisionSchema.parse(raw);
      await transaction.store.put(
        { ...current, attempts: current.attempts + 1 },
        key,
      );
      await transaction.done;
    },
  };
}
