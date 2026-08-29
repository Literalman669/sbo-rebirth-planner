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
}
