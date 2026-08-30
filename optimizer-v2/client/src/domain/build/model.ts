export type WeaponPath =
  | 'two-handed'
  | 'one-handed'
  | 'rapier'
  | 'dagger'
  | 'dual-wield'
  | 'melee';

export type OptimizationGoal =
  | 'balanced'
  | 'damage'
  | 'survivability'
  | 'mobility'
  | 'farming';

export type StatName = 'str' | 'def' | 'agi' | 'vit' | 'luk';

export type EquipmentSlot =
  | 'main-hand'
  | 'off-hand'
  | 'armor'
  | 'shield'
  | 'upper-head'
  | 'lower-head';

export type StatBlock = Record<StatName, number>;

export interface AccessPreferences {
  activeEvent: boolean;
  gamepass: boolean;
  badge: boolean;
  limited: boolean;
}

export const DEFAULT_ACCESS_PREFERENCES: AccessPreferences = {
  activeEvent: false,
  gamepass: false,
  badge: false,
  limited: false,
};

export interface CharacterProfile {
  schemaVersion: 2;
  id: string;
  name?: string;
  level: number;
  maxFloor: number;
  weaponPath: WeaponPath;
  goal: OptimizationGoal;
  weaponSkill?: number;
  stats: StatBlock;
  equipped: Partial<Record<EquipmentSlot, string>>;
  ownedItemIds: string[];
  datasetVersion: string;
  accessPreferences?: AccessPreferences;
}
