import type {
  OptimizationGoal,
  WeaponPath,
} from './model';
import type { CharacterProfile } from './model';
import { characterProfileSchema } from './schema';

export const CURATED_PRESET_POLICY_VERSION = 'sbo-presets-v1' as const;

export interface CuratedBuildPreset {
  id: string;
  policyVersion: typeof CURATED_PRESET_POLICY_VERSION;
  name: string;
  description: string;
  weaponPath: WeaponPath;
  goal: OptimizationGoal;
}

export function createDraftFromCuratedPreset(
  preset: CuratedBuildPreset,
  options: { id: string; datasetVersion: string },
): CharacterProfile {
  return characterProfileSchema.parse({
    schemaVersion: 2,
    id: options.id,
    name: preset.name,
    level: 1,
    maxFloor: 1,
    weaponPath: preset.weaponPath,
    goal: preset.goal,
    stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
    equipped: {},
    ownedItemIds: [],
    datasetVersion: options.datasetVersion,
    accessPreferences: {
      activeEvent: false,
      gamepass: false,
      badge: false,
      limited: false,
    },
  });
}

export function createDraftFromPersonalPreset(
  source: CharacterProfile,
  id: string,
): CharacterProfile {
  const valid = characterProfileSchema.parse(source);
  const fallbackName = `Level ${valid.level} build`;
  const baseName = valid.name ?? fallbackName;
  const suffix = ' copy';
  return characterProfileSchema.parse({
    ...structuredClone(valid),
    id,
    name: `${baseName.slice(0, 60 - suffix.length)}${suffix}`,
  });
}
