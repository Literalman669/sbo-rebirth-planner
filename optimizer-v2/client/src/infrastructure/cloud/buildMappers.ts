import type {
  CharacterProfile,
  EquipmentSlot,
} from '../../domain/build/model';
import { characterProfileSchema } from '../../domain/build/schema';
import type {
  PlannerPreferences,
  PlanProgress,
} from '../../domain/planner/state';
import {
  migratePlannerPreferences,
  migratePlanProgress,
} from '../../domain/planner/stateSchema';

export type CloudBuildRowLike = {
  id: string;
  name: string;
  headRevisionId: string;
  archivedAt?: unknown;
};

export type CloudRevisionRowLike = {
  id: string;
  buildId: string;
  schemaVersion: number;
  level: number;
  maxFloor: number;
  weaponPath: string;
  goal: string;
  weaponSkill?: number;
  str: number;
  def: number;
  agi: number;
  vit: number;
  luk: number;
  accessPreferences?: string;
  datasetVersion: string;
  createdAt?: unknown;
};

export type CloudEquipmentRowLike = {
  revisionId: string;
  slot: string;
  itemId: string;
};
export type CloudOwnedItemRowLike = { revisionId: string; itemId: string };
export type CloudPlanProgressRowLike = {
  buildId: string;
  progressJson: string;
};
export type CloudPreferenceRowLike = { preferencesJson: string };

export function planProgressFromCloudRow(
  row: CloudPlanProgressRowLike,
): PlanProgress {
  const progress = migratePlanProgress(JSON.parse(row.progressJson) as unknown);
  if (progress.buildId !== row.buildId) {
    throw new Error('Cloud plan progress does not belong to the build');
  }
  return progress;
}

export function createPreferenceSelector() {
  let previous: PlannerPreferences | null = null;
  return {
    select(rows: readonly CloudPreferenceRowLike[]) {
      for (const row of rows) {
        try {
          previous = migratePlannerPreferences(
            JSON.parse(row.preferencesJson) as unknown,
          );
        } catch {
          // A malformed subscription row never replaces validated preferences.
        }
      }
      return previous;
    },
  };
}

export function createPlanProgressSelector() {
  let previous = new Map<string, PlanProgress>();
  return {
    select(rows: readonly CloudPlanProgressRowLike[]) {
      const next = new Map<string, PlanProgress>();
      for (const row of rows) {
        try {
          next.set(row.buildId, planProgressFromCloudRow(row));
        } catch {
          const retained = previous.get(row.buildId);
          if (retained) next.set(row.buildId, retained);
        }
      }
      previous = next;
      return [...next.values()];
    },
  };
}

export function profileFingerprint(input: CharacterProfile): string {
  const profile = characterProfileSchema.parse(input);
  const access = profile.accessPreferences;
  return JSON.stringify({
    ...profile,
    stats: { ...profile.stats },
    equipped: Object.fromEntries(
      Object.entries(profile.equipped).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
    ownedItemIds: [...profile.ownedItemIds].sort(),
    accessPreferences: {
      activeEvent: access?.activeEvent ?? false,
      gamepass: access?.gamepass ?? false,
      badge: access?.badge ?? false,
      limited: access?.limited ?? false,
    },
  });
}

function parseAccessPreferences(value = '') {
  const tokens = new Set(value.split(',').filter(Boolean));
  return {
    activeEvent: tokens.has('active-event'),
    gamepass: tokens.has('gamepass'),
    badge: tokens.has('badge'),
    limited: tokens.has('limited'),
  };
}

function serializeAccessPreferences(
  preferences: CharacterProfile['accessPreferences'],
): string | undefined {
  if (!preferences) return undefined;
  const tokens = [
    preferences.activeEvent ? 'active-event' : undefined,
    preferences.gamepass ? 'gamepass' : undefined,
    preferences.badge ? 'badge' : undefined,
    preferences.limited ? 'limited' : undefined,
  ].filter((token): token is string => token !== undefined);
  return tokens.length > 0 ? tokens.join(',') : undefined;
}

export function toSaveBuildRevisionArgs(
  input: CharacterProfile,
  revisionId: string,
  parentRevisionId?: string,
) {
  const profile = characterProfileSchema.parse(input);
  const equipment = Object.entries(profile.equipped).map(
    ([slot, itemId]) => ({ slot, itemId }),
  );
  return {
    buildId: profile.id,
    revisionId,
    name: profile.name?.trim() || 'Untitled build',
    ...(parentRevisionId ? { parentRevisionId } : {}),
    profile: {
      schemaVersion: profile.schemaVersion,
      level: profile.level,
      maxFloor: profile.maxFloor,
      weaponPath: profile.weaponPath,
      goal: profile.goal,
      weaponSkill: profile.weaponSkill,
      str: profile.stats.str,
      def: profile.stats.def,
      agi: profile.stats.agi,
      vit: profile.stats.vit,
      luk: profile.stats.luk,
      datasetVersion: profile.datasetVersion,
      accessPreferences: serializeAccessPreferences(profile.accessPreferences),
    },
    equipment,
    ownedItemIds: [...profile.ownedItemIds],
  };
}

export function profileFromCloudRevision(
  build: CloudBuildRowLike,
  revision: CloudRevisionRowLike,
  equipmentRows: readonly CloudEquipmentRowLike[],
  ownedItemRows: readonly CloudOwnedItemRowLike[],
): CharacterProfile {
  if (revision.buildId !== build.id) {
    throw new Error('Cloud revision does not belong to the build');
  }

  const equipped = Object.fromEntries(
    equipmentRows
      .filter((row) => row.revisionId === revision.id)
      .map((row) => [row.slot as EquipmentSlot, row.itemId]),
  );
  return characterProfileSchema.parse({
    schemaVersion: revision.schemaVersion,
    id: build.id,
    name: build.name,
    level: revision.level,
    maxFloor: revision.maxFloor,
    weaponPath: revision.weaponPath,
    goal: revision.goal,
    weaponSkill: revision.weaponSkill,
    stats: {
      str: revision.str,
      def: revision.def,
      agi: revision.agi,
      vit: revision.vit,
      luk: revision.luk,
    },
    equipped,
    ownedItemIds: ownedItemRows
      .filter((row) => row.revisionId === revision.id)
      .map((row) => row.itemId),
    accessPreferences: parseAccessPreferences(revision.accessPreferences),
    datasetVersion: revision.datasetVersion,
  });
}
