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

export type CatalogVerificationStatus =
  | 'verified'
  | 'partial'
  | 'conflicting'
  | 'unknown'
  | 'legacy';

export type CatalogAvailability =
  | Availability
  | 'rotating'
  | 'limited'
  | 'gamepass'
  | 'badge'
  | 'legacy'
  | 'unobtainable'
  | 'unknown';

export type CatalogAccessType =
  | 'free'
  | 'event'
  | 'gamepass'
  | 'badge'
  | 'limited'
  | 'owned-only';

export interface EquipmentAcquisition {
  id: string;
  type: AcquisitionType;
  detail: string;
  floor?: number;
  cost?: number;
  currency?: string;
  availability: CatalogAvailability;
  accessType: CatalogAccessType;
  sourceUrl: string;
  sourceRevision: string;
}

export interface EquipmentResistance {
  status: string;
  percent: number;
  sourceUrl: string;
  sourceRevision: string;
}

export interface CatalogEquipmentRecord {
  id: string;
  name: string;
  aliases: string[];
  variantGroupId?: string;
  slot: EquipmentSlot;
  weaponPaths: WeaponPath[];
  attack: number | null;
  defense: number | null;
  dexterity: number | null;
  levelRequirement: number | null;
  skillRequirement?: number;
  acquisitions: EquipmentAcquisition[];
  resistances: EquipmentResistance[];
  specialEffects: string[];
  verificationStatus: CatalogVerificationStatus;
  sourceUrl: string;
  sourceRevision: string;
  lastReviewedAt: string;
}

export type OptimizerSafeCatalogEquipment = CatalogEquipmentRecord & {
  attack: number;
  defense: number;
  dexterity: number;
  levelRequirement: number;
  verificationStatus: 'verified';
};

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
  sourceRevision: string;
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
  sourceRevision: string;
  lastReviewedAt: string;
  verificationStatus: 'verified' | 'candidate';
}

export type MechanicComputability =
  | 'exact'
  | 'descriptive'
  | 'conflicting'
  | 'unknown';

export interface MechanicRecord {
  id: string;
  expression: string;
  units: string;
  applicability: string;
  boundaryBehavior: string;
  computability: MechanicComputability;
  parameters: Record<string, number>;
  verificationStatus: CatalogVerificationStatus;
  sourceUrl: string;
  sourceRevision: string;
  lastReviewedAt: string;
}

export interface DatasetSnapshot {
  version: string;
  publishedAt: string;
  lastReviewedAt: string;
  sourceSummary: string;
  formulaSetVersion: 'sbor-stats-v1';
  strategyPolicyVersion: 'sbor-policy-v1' | 'sbor-policy-v2';
  pointsPerLevel: 3;
  dualWieldSkillGate?: 200;
  knownGaps?: KnownGapRecord[];
  formulas: FormulaRecord[];
  mechanics: MechanicRecord[];
  catalog: CatalogEquipmentRecord[];
  equipment: EquipmentRecord[];
}

export interface KnownGapRecord {
  path: WeaponPath;
  band: '1-49' | '50-99' | '100-149' | '150-199' | '200-249' | '250-299' | '300+';
  reason: string;
  sourceUrl: string;
  sourceRevision: string;
  lastReviewedAt: string;
  verificationStatus: 'verified';
}
