import { z } from 'zod';
import type { CharacterProfile } from '../../domain/build/model';
import { characterProfileSchema } from '../../domain/build/schema';
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

const storedGuestBuildSchema = z.object({
  profile: characterProfileSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const quarantinedRecordSchema = z
  .object({
    id: z.string().min(1),
    kind: z.string().min(1),
    rawJson: z.string(),
    quarantinedAt: z.iso.datetime(),
  })
  .strict();

export interface StoredGuestBuild {
  profile: CharacterProfile;
  createdAt: string;
  updatedAt: string;
}

export type GuestBuildListResult =
  | { ok: true; value: StoredGuestBuild }
  | { ok: false; id: string; error: string };

export interface GuestBuildStore {
  loadDraft(): Promise<CharacterProfile | null>;
  saveDraft(profile: CharacterProfile): Promise<void>;
  clearDraft(): Promise<void>;
  listBuilds(): Promise<GuestBuildListResult[]>;
  saveBuild(profile: CharacterProfile): Promise<void>;
  deleteBuild(id: string): Promise<void>;
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
      const [keys, rows] = await Promise.all([
        database.getAllKeys('builds'),
        database.getAll('builds'),
      ]);
      const valid: Array<{ ok: true; value: StoredGuestBuild }> = [];
      const invalid: Array<{ ok: false; id: string; error: string }> = [];

      rows.forEach((row, index) => {
        const parsed = storedGuestBuildSchema.safeParse(row);
        if (parsed.success) {
          valid.push({ ok: true, value: parsed.data });
        } else {
          invalid.push({
            ok: false,
            id: String(keys[index]),
            error: 'Stored build is invalid',
          });
        }
      });

      valid.sort((left, right) =>
        right.value.updatedAt.localeCompare(left.value.updatedAt),
      );
      return [...valid, ...invalid];
    },

    async saveBuild(profile) {
      const validProfile = characterProfileSchema.parse(profile);
      const database = await databasePromise;
      const currentTimestamp = now();
      const existing = storedGuestBuildSchema.safeParse(
        await database.get('builds', validProfile.id),
      );
      const stored: StoredGuestBuild = {
        profile: validProfile,
        createdAt: existing.success
          ? existing.data.createdAt
          : currentTimestamp,
        updatedAt: currentTimestamp,
      };
      storedGuestBuildSchema.parse(stored);
      await database.put('builds', stored, validProfile.id);
    },

    async deleteBuild(id) {
      const database = await databasePromise;
      await database.delete('builds', id);
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
