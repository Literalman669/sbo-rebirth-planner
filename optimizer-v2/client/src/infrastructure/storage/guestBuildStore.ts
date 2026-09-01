import { z } from 'zod';
import type { CharacterProfile } from '../../domain/build/model';
import { characterProfileSchema } from '../../domain/build/schema';
import type {
  BuildRevisionSnapshot,
  SavedBuildKind,
  SavedBuildRecord,
} from '../../domain/build/record';
import {
  buildRevisionSnapshotSchema,
  legacyRevisionId,
  migrateSavedBuildRecord,
  savedBuildKindSchema,
  savedBuildRecordSchema,
} from '../../domain/build/recordSchema';
import type {
  PlannerPreferences,
  PlanProgress,
  QuarantinedRecord,
} from '../../domain/planner/state';
import {
  migratePlannerPreferences,
  migratePlanProgress,
  plannerPreferencesSchema,
  planProgressSchema,
} from '../../domain/planner/stateSchema';
import {
  DEFAULT_GUEST_DATABASE_NAME,
  GUEST_DATABASE_VERSION,
  openPlannerDatabase,
} from './plannerDatabase';

export { DEFAULT_GUEST_DATABASE_NAME, GUEST_DATABASE_VERSION };
const DRAFT_KEY = 'active';
const PREFERENCES_KEY = 'primary';

const quarantinedRecordSchema = z
  .object({
    id: z.string().min(1),
    kind: z.string().min(1),
    rawJson: z.string(),
    quarantinedAt: z.iso.datetime(),
  })
  .strict();

export type StoredGuestBuild = SavedBuildRecord;

export type SaveStoredBuildOptions = {
  kind?: SavedBuildKind;
  revisionId?: string;
  parentRevisionId?: string;
};

export type GuestBuildListResult =
  | { ok: true; value: StoredGuestBuild }
  | { ok: false; id: string; error: string };

export interface GuestBuildStore {
  loadDraft(): Promise<CharacterProfile | null>;
  saveDraft(profile: CharacterProfile): Promise<void>;
  clearDraft(): Promise<void>;
  listBuilds(): Promise<GuestBuildListResult[]>;
  saveBuild(
    profile: CharacterProfile,
    options?: SaveStoredBuildOptions,
  ): Promise<void>;
  listBuildHistory(buildId: string): Promise<BuildRevisionSnapshot[]>;
  restoreBuildRevision(
    buildId: string,
    sourceRevisionId: string,
    newRevisionId: string,
  ): Promise<CharacterProfile>;
  deleteBuild(id: string): Promise<void>;
  renameBuild(id: string, name: string): Promise<void>;
  duplicateBuild(
    id: string,
    duplicateId: string,
    name: string,
  ): Promise<CharacterProfile>;
  setBuildArchived(id: string, archived: boolean): Promise<void>;
  loadPreferences(): Promise<PlannerPreferences>;
  savePreferences(preferences: PlannerPreferences): Promise<void>;
  loadPlanProgress(buildId: string): Promise<PlanProgress | null>;
  savePlanProgress(progress: PlanProgress): Promise<void>;
  deletePlanProgress(buildId: string): Promise<void>;
  listQuarantinedRecords(): Promise<QuarantinedRecord[]>;
  exportQuarantinedRecord(id: string): Promise<string | null>;
  deleteQuarantinedRecord(id: string): Promise<void>;
}

type GuestBuildStoreOptions = {
  databaseName?: string;
  now?: () => string;
};

const storedIdSchema = z.string().min(1).max(100);

function revisionKey(buildId: string, revisionId: string) {
  return `${buildId}:${revisionId}`;
}

function sameSavedInput(
  current: SavedBuildRecord,
  profile: CharacterProfile,
  kind: SavedBuildKind,
) {
  return (
    current.kind === kind &&
    JSON.stringify(current.profile) === JSON.stringify(profile)
  );
}

export function createGuestBuildStore({
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
  now = () => new Date().toISOString(),
}: GuestBuildStoreOptions = {}): GuestBuildStore {
  const databasePromise = openPlannerDatabase(databaseName);

  async function quarantine(kind: string, raw: unknown) {
    const database = await databasePromise;
    const record: QuarantinedRecord = {
      id: `${kind}:${crypto.randomUUID()}`,
      kind,
      rawJson: JSON.stringify(raw),
      quarantinedAt: now(),
    };
    quarantinedRecordSchema.parse(record);
    await database.put('quarantine', record, record.id);
  }

  return {
    async loadDraft() {
      const database = await databasePromise;
      const raw = await database.get('draft', DRAFT_KEY);
      if (raw === undefined) return null;
      const parsed = characterProfileSchema.safeParse(raw);
      if (!parsed.success) throw new Error('Stored draft is invalid');
      return parsed.data;
    },

    async saveDraft(profile) {
      const validProfile = characterProfileSchema.parse(profile);
      const database = await databasePromise;
      await database.put('draft', validProfile, DRAFT_KEY);
    },

    async clearDraft() {
      const database = await databasePromise;
      await database.delete('draft', DRAFT_KEY);
    },

    async listBuilds() {
      const database = await databasePromise;
      const transaction = database.transaction(
        ['builds', 'build-revisions'],
        'readwrite',
      );
      const [keys, rows] = await Promise.all([
        transaction.objectStore('builds').getAllKeys(),
        transaction.objectStore('builds').getAll(),
      ]);
      const valid: Array<{ ok: true; value: StoredGuestBuild }> = [];
      const invalid: Array<{ ok: false; id: string; error: string }> = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const key = String(keys[index]);
        try {
          const migrated = migrateSavedBuildRecord(row);
          if (migrated.profile.id !== key) {
            throw new Error('Stored build key does not match its profile');
          }
          const alreadyCurrent = savedBuildRecordSchema.safeParse(row).success;
          if (!alreadyCurrent) {
            const baseline = buildRevisionSnapshotSchema.parse({
              id: migrated.headRevisionId,
              buildId: migrated.profile.id,
              kind: migrated.kind,
              profile: migrated.profile,
              createdAt: migrated.createdAt,
            });
            await transaction.objectStore('builds').put(migrated, key);
            await transaction.objectStore('build-revisions').put(
              baseline,
              revisionKey(baseline.buildId, baseline.id),
            );
          }
          valid.push({ ok: true, value: migrated });
        } catch {
          invalid.push({
            ok: false, id: key, error: 'Stored build is invalid',
          });
        }
      }
      await transaction.done;

      valid.sort((left, right) =>
        right.value.updatedAt.localeCompare(left.value.updatedAt),
      );
      return [...valid, ...invalid];
    },

    async saveBuild(profile, options = {}) {
      const validProfile = characterProfileSchema.parse(profile);
      const kind = savedBuildKindSchema.parse(options.kind ?? 'build');
      const database = await databasePromise;
      const transaction = database.transaction(
        ['builds', 'build-revisions'],
        'readwrite',
      );
      const rawExisting = await transaction.objectStore('builds').get(
        validProfile.id,
      );
      const existing = rawExisting === undefined
        ? null
        : migrateSavedBuildRecord(rawExisting);
      if (
        existing &&
        !savedBuildRecordSchema.safeParse(rawExisting).success
      ) {
        const baseline = buildRevisionSnapshotSchema.parse({
          id: existing.headRevisionId,
          buildId: existing.profile.id,
          kind: existing.kind,
          profile: existing.profile,
          createdAt: existing.createdAt,
        });
        await transaction.objectStore('build-revisions').put(
          baseline,
          revisionKey(baseline.buildId, baseline.id),
        );
        await transaction.objectStore('builds').put(existing, validProfile.id);
      }
      if (existing && sameSavedInput(existing, validProfile, kind)) {
        await transaction.done;
        return;
      }
      const revisionId = storedIdSchema.parse(
        options.revisionId ?? crypto.randomUUID(),
      );
      const parentRevisionId = options.parentRevisionId ?? existing?.headRevisionId;
      if (parentRevisionId) {
        storedIdSchema.parse(parentRevisionId);
        const parent = buildRevisionSnapshotSchema.safeParse(
          await transaction.objectStore('build-revisions').get(
            revisionKey(validProfile.id, parentRevisionId),
          ),
        );
        if (!parent.success || parent.data.buildId !== validProfile.id) {
          throw new Error('Parent revision is unavailable');
        }
      }
      const existingRevision = await transaction
        .objectStore('build-revisions')
        .get(revisionKey(validProfile.id, revisionId));
      if (existingRevision !== undefined) {
        throw new Error('Revision ID already exists');
      }
      const currentTimestamp = now();
      const revision = buildRevisionSnapshotSchema.parse({
        id: revisionId,
        buildId: validProfile.id,
        ...(parentRevisionId ? { parentRevisionId } : {}),
        kind,
        profile: validProfile,
        createdAt: currentTimestamp,
      });
      const stored: StoredGuestBuild = {
        profile: validProfile,
        kind,
        headRevisionId: revisionId,
        createdAt: existing?.createdAt ?? currentTimestamp,
        updatedAt: currentTimestamp,
        ...(existing?.archivedAt ? { archivedAt: existing.archivedAt } : {}),
      };
      savedBuildRecordSchema.parse(stored);
      await transaction.objectStore('build-revisions').put(
        revision,
        revisionKey(validProfile.id, revisionId),
      );
      await transaction.objectStore('builds').put(stored, validProfile.id);
      await transaction.done;
    },

    async listBuildHistory(buildId) {
      const validBuildId = storedIdSchema.parse(buildId);
      const database = await databasePromise;
      return (await database.getAll('build-revisions'))
        .flatMap((raw) => {
          const parsed = buildRevisionSnapshotSchema.safeParse(raw);
          return parsed.success && parsed.data.buildId === validBuildId
            ? [parsed.data]
            : [];
        })
        .sort(
          (left, right) =>
            left.createdAt.localeCompare(right.createdAt) ||
            left.id.localeCompare(right.id),
        );
    },

    async restoreBuildRevision(buildId, sourceRevisionId, newRevisionId) {
      const validBuildId = storedIdSchema.parse(buildId);
      const validSourceRevisionId = storedIdSchema.parse(sourceRevisionId);
      const validNewRevisionId = storedIdSchema.parse(newRevisionId);
      const database = await databasePromise;
      const transaction = database.transaction(
        ['builds', 'build-revisions'],
        'readwrite',
      );
      const rawCurrent = await transaction.objectStore('builds').get(
        validBuildId,
      );
      const current = migrateSavedBuildRecord(rawCurrent);
      if (!savedBuildRecordSchema.safeParse(rawCurrent).success) {
        const baseline = buildRevisionSnapshotSchema.parse({
          id: current.headRevisionId,
          buildId: current.profile.id,
          kind: current.kind,
          profile: current.profile,
          createdAt: current.createdAt,
        });
        await transaction.objectStore('build-revisions').put(
          baseline,
          revisionKey(baseline.buildId, baseline.id),
        );
        await transaction.objectStore('builds').put(current, validBuildId);
      }
      const source = buildRevisionSnapshotSchema.safeParse(
        await transaction.objectStore('build-revisions').get(
          revisionKey(validBuildId, validSourceRevisionId),
        ),
      );
      if (!source.success || source.data.buildId !== validBuildId) {
        throw new Error('Stored revision is unavailable');
      }
      if (
        await transaction.objectStore('build-revisions').get(
          revisionKey(validBuildId, validNewRevisionId),
        )
      ) {
        throw new Error('Revision ID already exists');
      }
      const timestamp = now();
      const restoredProfile = structuredClone(source.data.profile);
      const revision = buildRevisionSnapshotSchema.parse({
        id: validNewRevisionId,
        buildId: validBuildId,
        parentRevisionId: current.headRevisionId,
        kind: source.data.kind,
        profile: restoredProfile,
        createdAt: timestamp,
      });
      const stored = savedBuildRecordSchema.parse({
        ...current,
        profile: restoredProfile,
        kind: source.data.kind,
        headRevisionId: validNewRevisionId,
        updatedAt: timestamp,
      });
      await transaction.objectStore('build-revisions').put(
        revision,
        revisionKey(validBuildId, validNewRevisionId),
      );
      await transaction.objectStore('builds').put(stored, validBuildId);
      await transaction.done;
      return restoredProfile;
    },

    async deleteBuild(id) {
      const validId = storedIdSchema.parse(id);
      const database = await databasePromise;
      const transaction = database.transaction(
        ['builds', 'build-revisions', 'plan-progress'],
        'readwrite',
      );
      const revisionKeys = await transaction
        .objectStore('build-revisions')
        .getAllKeys();
      for (const key of revisionKeys) {
        if (String(key).startsWith(`${validId}:`)) {
          await transaction.objectStore('build-revisions').delete(key);
        }
      }
      await transaction.objectStore('plan-progress').delete(validId);
      await transaction.objectStore('builds').delete(validId);
      await transaction.done;
    },

    async renameBuild(id, name) {
      const validId = storedIdSchema.parse(id);
      const validName = z.string().trim().min(1).max(60).parse(name);
      const database = await databasePromise;
      const transaction = database.transaction(
        ['builds', 'build-revisions'],
        'readwrite',
      );
      const raw = await transaction.objectStore('builds').get(validId);
      let current: SavedBuildRecord;
      try {
        current = migrateSavedBuildRecord(raw);
      } catch {
        throw new Error('Stored build is unavailable');
      }
      if (!savedBuildRecordSchema.safeParse(raw).success) {
        const baseline = buildRevisionSnapshotSchema.parse({
          id: current.headRevisionId,
          buildId: current.profile.id,
          kind: current.kind,
          profile: current.profile,
          createdAt: current.createdAt,
        });
        await transaction.objectStore('build-revisions').put(
          baseline,
          revisionKey(baseline.buildId, baseline.id),
        );
      }
      await transaction.objectStore('builds').put(
        savedBuildRecordSchema.parse({
          ...current,
          profile: { ...current.profile, name: validName },
          updatedAt: now(),
        }),
        validId,
      );
      await transaction.done;
    },

    async duplicateBuild(id, duplicateId, name) {
      const sourceId = storedIdSchema.parse(id);
      const validId = storedIdSchema.parse(duplicateId);
      const validName = z.string().trim().min(1).max(60).parse(name);
      const database = await databasePromise;
      const transaction = database.transaction(
        ['builds', 'build-revisions'],
        'readwrite',
      );
      if (await transaction.objectStore('builds').get(validId)) {
        throw new Error('Duplicate build ID already exists');
      }
      const raw = await transaction.objectStore('builds').get(sourceId);
      let current: SavedBuildRecord;
      try {
        current = migrateSavedBuildRecord(raw);
      } catch {
        throw new Error('Stored build is unavailable');
      }
      if (!savedBuildRecordSchema.safeParse(raw).success) {
        const baseline = buildRevisionSnapshotSchema.parse({
          id: current.headRevisionId,
          buildId: current.profile.id,
          kind: current.kind,
          profile: current.profile,
          createdAt: current.createdAt,
        });
        await transaction.objectStore('build-revisions').put(
          baseline,
          revisionKey(baseline.buildId, baseline.id),
        );
        await transaction.objectStore('builds').put(current, sourceId);
      }
      const copied = characterProfileSchema.parse({
        ...structuredClone(current.profile),
        id: validId,
        name: validName,
      });
      const timestamp = now();
      const revisionId = crypto.randomUUID();
      const revision = buildRevisionSnapshotSchema.parse({
        id: revisionId,
        buildId: validId,
        kind: current.kind,
        profile: copied,
        createdAt: timestamp,
      });
      await transaction.objectStore('build-revisions').put(
        revision,
        revisionKey(validId, revisionId),
      );
      await transaction.objectStore('builds').put(
        savedBuildRecordSchema.parse({
          profile: copied,
          kind: current.kind,
          headRevisionId: revisionId,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
        validId,
      );
      await transaction.done;
      return structuredClone(copied);
    },

    async setBuildArchived(id, archived) {
      const validId = storedIdSchema.parse(id);
      const database = await databasePromise;
      const transaction = database.transaction(
        ['builds', 'build-revisions'],
        'readwrite',
      );
      const raw = await transaction.objectStore('builds').get(validId);
      let current: SavedBuildRecord;
      try {
        current = migrateSavedBuildRecord(raw);
      } catch {
        throw new Error('Stored build is unavailable');
      }
      if (!savedBuildRecordSchema.safeParse(raw).success) {
        const baseline = buildRevisionSnapshotSchema.parse({
          id: current.headRevisionId,
          buildId: current.profile.id,
          kind: current.kind,
          profile: current.profile,
          createdAt: current.createdAt,
        });
        await transaction.objectStore('build-revisions').put(
          baseline,
          revisionKey(baseline.buildId, baseline.id),
        );
      }
      if (Boolean(current.archivedAt) === archived) {
        await transaction.done;
        return;
      }
      const timestamp = now();
      await transaction.objectStore('builds').put(
        savedBuildRecordSchema.parse({
          ...current,
          ...(archived ? { archivedAt: timestamp } : { archivedAt: undefined }),
          updatedAt: timestamp,
        }),
        validId,
      );
      await transaction.done;
    },

    async loadPreferences() {
      const database = await databasePromise;
      const raw = await database.get('planner-preferences', PREFERENCES_KEY);
      try {
        return migratePlannerPreferences(raw);
      } catch (error) {
        await quarantine('planner-preferences', raw);
        throw error;
      }
    },

    async savePreferences(preferences) {
      const valid = plannerPreferencesSchema.parse(preferences);
      const database = await databasePromise;
      await database.put('planner-preferences', valid, PREFERENCES_KEY);
    },

    async loadPlanProgress(buildId) {
      const database = await databasePromise;
      const raw = await database.get('plan-progress', buildId);
      if (raw === undefined) return null;
      try {
        return migratePlanProgress(raw);
      } catch (error) {
        await quarantine('plan-progress', raw);
        throw error;
      }
    },

    async savePlanProgress(progress) {
      const valid = planProgressSchema.parse(progress);
      const database = await databasePromise;
      await database.put('plan-progress', valid, valid.buildId);
    },

    async deletePlanProgress(buildId) {
      const database = await databasePromise;
      await database.delete('plan-progress', buildId);
    },

    async listQuarantinedRecords() {
      const database = await databasePromise;
      return (await database.getAll('quarantine'))
        .flatMap((row) => {
          const parsed = quarantinedRecordSchema.safeParse(row);
          return parsed.success ? [parsed.data] : [];
        })
        .sort((left, right) =>
          right.quarantinedAt.localeCompare(left.quarantinedAt),
        );
    },

    async exportQuarantinedRecord(id) {
      const database = await databasePromise;
      const parsed = quarantinedRecordSchema.safeParse(
        await database.get('quarantine', id),
      );
      return parsed.success ? parsed.data.rawJson : null;
    },

    async deleteQuarantinedRecord(id) {
      const database = await databasePromise;
      await database.delete('quarantine', id);
    },
  };
}
