import { z } from 'zod';
import type { CharacterProfile } from '../../domain/build/model';
import { characterProfileSchema } from '../../domain/build/schema';
import {
  DEFAULT_GUEST_DATABASE_NAME,
  openPlannerDatabase,
} from '../storage/plannerDatabase';

const legacyPendingRevisionSchema = z.object({
  revisionId: z.string().min(1).max(100),
  buildId: z.string().min(1).max(100),
  profile: characterProfileSchema,
  parentRevisionId: z.string().min(1).max(100).optional(),
  enqueuedAt: z.iso.datetime(),
  attempts: z.number().int().min(0),
});
const pendingRevisionSchema = legacyPendingRevisionSchema.extend({
  subject: z.string().min(1).max(255),
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

export type LegacyPendingRevision = Omit<PendingRevision, 'subject'>;

export interface PendingRevisionQueue {
  enqueue(revision: PendingRevision): Promise<void>;
  list(subject: string): Promise<PendingRevision[]>;
  acknowledge(subject: string, revisionId: string): Promise<void>;
  incrementAttempts(subject: string, revisionId: string): Promise<void>;
  listLegacyUnscoped(): Promise<LegacyPendingRevision[]>;
  claimLegacyUnscoped(subject: string): Promise<void>;
}

type PendingRevisionQueueOptions = { databaseName?: string };

export function createPendingRevisionQueue({
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
}: PendingRevisionQueueOptions = {}): PendingRevisionQueue {
  const databasePromise = openPlannerDatabase(databaseName);

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

    async listLegacyUnscoped() {
      const database = await databasePromise;
      const rows = await database.getAll('pending-revisions');
      return rows.flatMap((row) => {
        if (typeof row === 'object' && row !== null && 'subject' in row) return [];
        if (pendingRevisionSchema.safeParse(row).success) return [];
        const legacy = legacyPendingRevisionSchema.safeParse(row);
        return legacy.success ? [legacy.data] : [];
      });
    },

    async claimLegacyUnscoped(subject) {
      const validSubject = z.string().min(1).max(255).parse(subject);
      const database = await databasePromise;
      const transaction = database.transaction('pending-revisions', 'readwrite');
      const [keys, rows] = await Promise.all([
        transaction.store.getAllKeys(),
        transaction.store.getAll(),
      ]);
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        if (typeof row === 'object' && row !== null && 'subject' in row) continue;
        if (pendingRevisionSchema.safeParse(row).success) continue;
        const legacy = legacyPendingRevisionSchema.safeParse(row);
        if (!legacy.success) continue;
        const nextKey = `${validSubject}:${legacy.data.revisionId}`;
        if (await transaction.store.get(nextKey)) {
          transaction.abort();
          throw new Error(
            `Revision ${legacy.data.revisionId} is already assigned to this account`,
          );
        }
        await transaction.store.put(
          { ...legacy.data, subject: validSubject },
          nextKey,
        );
        await transaction.store.delete(keys[index]!);
      }
      await transaction.done;
    },
  };
}
