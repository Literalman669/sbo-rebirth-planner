import type { EquipmentSlot, WeaponPath } from '../build/model';

export type AcquisitionType =
  | 'starter'
  | 'shop'
  | 'mob-drop'
  | 'boss-drop'
  | 'crafting'
  | 'quest'
  | 'event'
  | 'badge'
  | 'gamepass';

export type Availability = 'always' | 'active-event' | 'inactive-event';

export interface EquipmentRecord {
  id: string;
  name: string;
  slot: EquipmentSlot;
  weaponPaths: WeaponPath[];
  attack: number;
  defense: number;
  dexterity: number;
  levelRequirement: number;
  skillRequirement?: number;
  floor: number;
  acquisitionType: AcquisitionType;
  acquisitionDetail: string;
  availability: Availability;
  sourceUrl: string;
  sourceRevision?: string;
  lastReviewedAt: string;
  verificationStatus: 'verified' | 'candidate';
}

export type FormulaId =
  | 'points-per-level'
  | 'attack-from-str'
  | 'damage-reduction-from-def'
  | 'bonus-hp-from-vit'
  | 'stamina'
  | 'walk-speed-from-agi'
  | 'sprint-speed-from-agi'
  | 'crit-bonus-from-luk'
  | 'drop-bonus-from-luk';

export interface FormulaRecord {
  id: FormulaId;
  expression: string;
  units: string;
  applicability: string;
  boundaryBehavior: string;
  sourceUrl: string;
  sourceRevision?: string;
  lastReviewedAt: string;
  verificationStatus: 'verified' | 'candidate';
}

export interface DatasetSnapshot {
  version: string;
  publishedAt: string;
  lastReviewedAt: string;
  sourceSummary: string;
  formulaSetVersion: 'sbor-stats-v1';
  pointsPerLevel: 3;
  formulas: FormulaRecord[];
  equipment: EquipmentRecord[];
}
