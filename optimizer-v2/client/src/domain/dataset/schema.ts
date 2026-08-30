import { z } from 'zod';
import {
  equipmentSlotSchema,
  weaponPathSchema,
} from '../build/schema';
import type {
  CatalogEquipmentRecord,
  EquipmentRecord,
  FormulaRecord,
} from './model';
import {
  hasApprovedEquipmentProvenance,
  hasApprovedFormulaProvenance,
  hasApprovedKnownGapProvenance,
  hasNonblankSourceRevision,
  isCanonicalWikiSourceUrl,
  isMediaWikiRevisionId,
} from './provenance';

const formulaIdSchema = z.enum([
  'points-per-level',
  'attack-from-str',
  'damage-reduction-from-def',
  'bonus-hp-from-vit',
  'stamina',
  'walk-speed-from-agi',
  'sprint-speed-from-agi',
  'crit-bonus-from-luk',
  'drop-bonus-from-luk',
]);

const catalogVerificationStatusSchema = z.enum([
  'verified',
  'partial',
  'conflicting',
  'unknown',
  'legacy',
]);

const catalogAvailabilitySchema = z.enum([
  'always',
  'active-event',
  'inactive-event',
  'rotating',
  'limited',
  'gamepass',
  'badge',
  'legacy',
  'unobtainable',
  'unknown',
]);

const catalogAccessTypeSchema = z.enum([
  'free',
  'event',
  'gamepass',
  'badge',
  'limited',
  'owned-only',
]);

const acquisitionTypeSchema = z.enum([
  'starter',
  'shop',
  'mob-drop',
  'boss-drop',
  'crafting',
  'quest',
  'event',
  'badge',
  'gamepass',
]);

export const equipmentRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slot: equipmentSlotSchema,
    weaponPaths: z.array(weaponPathSchema),
    attack: z.number().finite().nonnegative(),
    defense: z.number().finite().nonnegative(),
    dexterity: z.number().finite().nonnegative(),
    levelRequirement: z.number().int().min(1),
    skillRequirement: z.number().int().min(0).optional(),
    floor: z.number().int().min(1).max(19),
    acquisitionType: acquisitionTypeSchema,
    acquisitionDetail: z.string().min(1),
    availability: catalogAvailabilitySchema,
    sourceUrl: z.url().refine(
      isCanonicalWikiSourceUrl,
      'source must use the canonical wiki',
    ),
    sourceRevision: z.string().refine(
      isMediaWikiRevisionId,
      'source revision must be a positive MediaWiki revision ID',
    ),
    lastReviewedAt: z.iso.date(),
    verificationStatus: z.enum(['verified', 'candidate']),
  })
  .superRefine((item, context) => {
    if (!hasApprovedEquipmentProvenance(item)) {
      context.addIssue({
        code: 'custom',
        message: 'equipment must have canonical verified provenance',
        path: ['sourceUrl'],
      });
    }
    if (
      (item.slot === 'main-hand' || item.slot === 'off-hand') &&
      item.weaponPaths.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'weapon equipment requires a compatible path',
        path: ['weaponPaths'],
      });
    }
  });

const equipmentAcquisitionSchema = z
  .object({
    id: z.string().min(1),
    type: acquisitionTypeSchema,
    detail: z.string().min(1),
    floor: z.number().int().min(1).max(19).optional(),
    cost: z.number().finite().nonnegative().optional(),
    currency: z.string().min(1).optional(),
    availability: catalogAvailabilitySchema,
    accessType: catalogAccessTypeSchema,
    sourceUrl: z.url().refine(
      isCanonicalWikiSourceUrl,
      'source must use the canonical wiki',
    ),
    sourceRevision: z.string().refine(
      isMediaWikiRevisionId,
      'source revision must be a positive MediaWiki revision ID',
    ),
  })
  .superRefine((source, context) => {
    if (!hasApprovedEquipmentProvenance(source)) {
      context.addIssue({
        code: 'custom',
        message: 'acquisition must have canonical verified provenance',
        path: ['sourceUrl'],
      });
    }
  });

const equipmentResistanceSchema = z
  .object({
    status: z.string().min(1),
    percent: z.number().finite().min(0).max(100),
    sourceUrl: z.url().refine(
      isCanonicalWikiSourceUrl,
      'source must use the canonical wiki',
    ),
    sourceRevision: z.string().refine(
      isMediaWikiRevisionId,
      'source revision must be a positive MediaWiki revision ID',
    ),
  })
  .superRefine((source, context) => {
    if (!hasApprovedEquipmentProvenance(source)) {
      context.addIssue({
        code: 'custom',
        message: 'resistance must have canonical verified provenance',
        path: ['sourceUrl'],
      });
    }
  });

export const catalogEquipmentRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    variantGroupId: z.string().min(1).optional(),
    slot: equipmentSlotSchema,
    weaponPaths: z.array(weaponPathSchema),
    attack: z.number().finite().nonnegative().nullable(),
    defense: z.number().finite().nonnegative().nullable(),
    dexterity: z.number().finite().nonnegative().nullable(),
    levelRequirement: z.number().int().min(1).nullable(),
    skillRequirement: z.number().int().min(0).optional(),
    acquisitions: z.array(equipmentAcquisitionSchema),
    resistances: z.array(equipmentResistanceSchema),
    specialEffects: z.array(z.string().min(1)),
    verificationStatus: catalogVerificationStatusSchema,
    sourceUrl: z.url().refine(
      isCanonicalWikiSourceUrl,
      'source must use the canonical wiki',
    ),
    sourceRevision: z.string().refine(
      isMediaWikiRevisionId,
      'source revision must be a positive MediaWiki revision ID',
    ),
    lastReviewedAt: z.iso.date(),
  })
  .superRefine((item, context) => {
    if (!hasApprovedEquipmentProvenance(item)) {
      context.addIssue({
        code: 'custom',
        message: 'catalog equipment must have canonical verified provenance',
        path: ['sourceUrl'],
      });
    }
    if (
      (item.slot === 'main-hand' || item.slot === 'off-hand') &&
      item.weaponPaths.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'weapon equipment requires a compatible path',
        path: ['weaponPaths'],
      });
    }
    if (
      item.verificationStatus === 'verified' &&
      (item.attack === null ||
        item.defense === null ||
        item.dexterity === null ||
        item.levelRequirement === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'verified equipment requires complete numeric stats',
        path: ['verificationStatus'],
      });
    }
    if (
      new Set(item.acquisitions.map((source) => source.id)).size !==
      item.acquisitions.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'acquisition IDs must be unique',
        path: ['acquisitions'],
      });
    }
  });

export const formulaRecordSchema = z
  .object({
    id: formulaIdSchema,
    expression: z.string().min(1),
    units: z.string().min(1),
    applicability: z.string().min(1),
    boundaryBehavior: z.string().min(1),
    sourceUrl: z.url(),
    sourceRevision: z
      .string({ error: 'source revision is required' })
      .refine(hasNonblankSourceRevision, 'source revision is required'),
    lastReviewedAt: z.iso.date(),
    verificationStatus: z.literal('verified'),
  })
  .superRefine((formula, context) => {
    if (!hasApprovedFormulaProvenance(formula)) {
      context.addIssue({
        code: 'custom',
        message: 'formula must have canonical verified provenance',
        path: ['sourceUrl'],
      });
    }
  });

const mechanicRecordSchema = z
  .object({
    id: z.string().min(1),
    expression: z.string().min(1),
    units: z.string().min(1),
    applicability: z.string().min(1),
    boundaryBehavior: z.string().min(1),
    computability: z
      .enum(['exact', 'descriptive', 'conflicting', 'unknown'])
      .default('exact'),
    parameters: z.record(z.string(), z.number().finite()).default({}),
    sourceUrl: z.url(),
    sourceRevision: z.string().min(1),
    lastReviewedAt: z.iso.date(),
    verificationStatus: catalogVerificationStatusSchema,
  })
  .superRefine((mechanic, context) => {
    if (!hasApprovedFormulaProvenance(mechanic)) {
      context.addIssue({
        code: 'custom',
        message: 'mechanic must have canonical verified provenance',
        path: ['sourceUrl'],
      });
    }
  });

function accessTypeFor(type: EquipmentRecord['acquisitionType']) {
  if (type === 'event') return 'event' as const;
  if (type === 'gamepass') return 'gamepass' as const;
  if (type === 'badge') return 'badge' as const;
  return 'free' as const;
}

function catalogFromLegacy(item: EquipmentRecord): CatalogEquipmentRecord {
  return {
    id: item.id,
    name: item.name,
    aliases: [],
    slot: item.slot,
    weaponPaths: [...item.weaponPaths],
    attack: item.attack,
    defense: item.defense,
    dexterity: item.dexterity,
    levelRequirement: item.levelRequirement,
    skillRequirement: item.skillRequirement,
    acquisitions: [
      {
        id: `${item.id}:acquisition:0`,
        type: item.acquisitionType,
        detail: item.acquisitionDetail,
        floor: item.floor,
        availability: item.availability,
        accessType: accessTypeFor(item.acquisitionType),
        sourceUrl: item.sourceUrl,
        sourceRevision: item.sourceRevision,
      },
    ],
    resistances: [],
    specialEffects: [],
    verificationStatus:
      item.verificationStatus === 'verified' ? 'verified' : 'unknown',
    sourceUrl: item.sourceUrl,
    sourceRevision: item.sourceRevision,
    lastReviewedAt: item.lastReviewedAt,
  };
}

function legacyFormulaParameters(
  formula: FormulaRecord,
): Record<string, number> {
  const numbers = [...formula.expression.matchAll(/\d+(?:\.\d+)?/g)].map(
    (match) => Number(match[0]),
  );
  switch (formula.id) {
    case 'points-per-level':
      return { pointsPerLevel: numbers.at(-1) ?? 3 };
    case 'attack-from-str':
      return { statCap: numbers[1] ?? 500, damagePerStr: numbers[2] ?? 0.004 };
    case 'damage-reduction-from-def':
      return {
        baseDefenseMultiplier: numbers[0] ?? 5,
        statCap: numbers[1] ?? 500,
        defenseMultiplierPerDef: numbers[2] ?? 0.01,
      };
    case 'bonus-hp-from-vit':
      return {
        dexHpBaseMultiplier: numbers[0] ?? 10,
        statCap: numbers[1] ?? 500,
        dexHpMultiplierPerVit: numbers[2] ?? 0.01,
      };
    case 'stamina':
      return {
        staminaBase: numbers[0] ?? 100,
        staminaPerLevel: numbers[1] ?? 5,
        staminaPerStrAgiVitPoint: numbers[2] ?? 0.1,
        statCap: 500,
      };
    case 'walk-speed-from-agi':
      return { statCap: numbers[0] ?? 500, walkSpeedPerAgi: numbers[1] ?? 0.004 };
    case 'sprint-speed-from-agi':
      return { statCap: numbers[0] ?? 500, sprintSpeedPerAgi: numbers[1] ?? 0.02 };
    case 'crit-bonus-from-luk':
      return { critPerLuk: numbers[0] ?? 0.0001, critCap: numbers[1] ?? 0.05, statCap: 500 };
    case 'drop-bonus-from-luk':
      return { dropPerLuk: numbers[0] ?? 0.0001, dropCap: numbers[1] ?? 0.05, statCap: 500 };
  }
}

function mechanicFromFormula(formula: FormulaRecord) {
  return {
    ...formula,
    computability: 'exact' as const,
    parameters: legacyFormulaParameters(formula),
    verificationStatus: 'verified' as const,
  };
}

export const datasetSnapshotSchema = z
  .object({
    version: z.string().min(1),
    publishedAt: z.iso.datetime(),
    lastReviewedAt: z.iso.date(),
    sourceSummary: z.string().min(1),
    formulaSetVersion: z.enum(['sbor-stats-v1', 'sbor-stats-v2']),
    strategyPolicyVersion: z
      .enum(['sbor-policy-v1', 'sbor-policy-v2'])
      .default('sbor-policy-v1'),
    pointsPerLevel: z.literal(3),
    dualWieldSkillGate: z.literal(200).default(200),
    knownGaps: z
      .array(
        z
          .object({
            path: weaponPathSchema,
            band: z.enum([
              '1-49',
              '50-99',
              '100-149',
              '150-199',
              '200-249',
              '250-299',
              '300+',
            ]),
            reason: z.string().min(1),
            sourceUrl: z.url().refine(
              isCanonicalWikiSourceUrl,
              'source must use the canonical wiki',
            ),
            sourceRevision: z.string().refine(
              isMediaWikiRevisionId,
              'source revision must be a positive MediaWiki revision ID',
            ),
            lastReviewedAt: z.iso.date(),
            verificationStatus: z.literal('verified'),
          })
          .superRefine((gap, context) => {
            if (!hasApprovedKnownGapProvenance(gap)) {
              context.addIssue({
                code: 'custom',
                message: 'known gap must have canonical verified provenance',
                path: ['sourceUrl'],
              });
            }
          }),
      )
      .default([]),
    formulas: z
      .array(formulaRecordSchema)
      .length(9)
      .refine(
        (rows) => new Set(rows.map((row) => row.id)).size === 9,
        'all formula IDs must appear exactly once',
      ),
    mechanics: z.array(mechanicRecordSchema).optional(),
    catalog: z.array(catalogEquipmentRecordSchema).optional(),
    equipment: z
      .array(equipmentRecordSchema)
      .refine(
        (rows) => rows.every((row) => row.verificationStatus === 'verified'),
        'production equipment must be verified',
      ),
  })
  .transform((snapshot) => ({
    ...snapshot,
    mechanics:
      snapshot.mechanics ?? snapshot.formulas.map(mechanicFromFormula),
    catalog: snapshot.catalog ?? snapshot.equipment.map(catalogFromLegacy),
  }));
