import type {
  CharacterProfile,
  EquipmentSlot,
} from '../../domain/build/model';
import { characterProfileSchema } from '../../domain/build/schema';

export type CloudBuildRowLike = {
  id: string;
  name: string;
  headRevisionId: string;
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

function parseAccessPreferences(value = '') {
  const tokens = new Set(value.split(',').filter(Boolean));
  return {
    activeEvent: tokens.has('active-event'),
    gamepass: tokens.has('gamepass'),
    badge: tokens.has('badge'),
    limited: tokens.has('limited'),
  };
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
