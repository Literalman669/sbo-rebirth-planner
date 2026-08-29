import { openDB } from 'idb';
import { z } from 'zod';
import type { CharacterProfile } from '../../domain/build/model';
import { characterProfileSchema } from '../../domain/build/schema';

const DEFAULT_DATABASE_NAME = 'sbo-rebirth-optimizer-v2';
const DATABASE_VERSION = 1;
const DRAFT_KEY = 'active';

const storedGuestBuildSchema = z.object({
  profile: characterProfileSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

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
  listBuilds(): Promise<GuestBuildListResult[]>;
  saveBuild(profile: CharacterProfile): Promise<void>;
  deleteBuild(id: string): Promise<void>;
}

type GuestBuildStoreOptions = {
  databaseName?: string;
  now?: () => string;
};

export function createGuestBuildStore({
  databaseName = DEFAULT_DATABASE_NAME,
  now = () => new Date().toISOString(),
}: GuestBuildStoreOptions = {}): GuestBuildStore {
  const databasePromise = openDB(databaseName, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('draft')) {
        database.createObjectStore('draft');
      }
      if (!database.objectStoreNames.contains('builds')) {
        database.createObjectStore('builds');
      }
    },
  });

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
  };
}
