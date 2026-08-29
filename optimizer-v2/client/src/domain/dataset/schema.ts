import { z } from 'zod';
import {
  equipmentSlotSchema,
  weaponPathSchema,
} from '../build/schema';

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
    acquisitionType: z.enum([
      'starter',
      'shop',
      'mob-drop',
      'boss-drop',
      'crafting',
      'quest',
      'event',
      'badge',
      'gamepass',
    ]),
    acquisitionDetail: z.string().min(1),
    availability: z.enum(['always', 'active-event', 'inactive-event']),
    sourceUrl: z
      .url()
      .refine((url) => url.startsWith('https://'), 'source must use HTTPS'),
    sourceRevision: z.string().optional(),
    lastReviewedAt: z.iso.date(),
    verificationStatus: z.enum(['verified', 'candidate']),
  })
  .superRefine((item, context) => {
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

export const formulaRecordSchema = z.object({
  id: formulaIdSchema,
  expression: z.string().min(1),
  units: z.string().min(1),
  applicability: z.string().min(1),
  boundaryBehavior: z.string().min(1),
  sourceUrl: z
    .url()
    .refine((url) => url.startsWith('https://'), 'source must use HTTPS'),
  sourceRevision: z.string().optional(),
  lastReviewedAt: z.iso.date(),
  verificationStatus: z.literal('verified'),
});

export const datasetSnapshotSchema = z.object({
  version: z.string().min(1),
  publishedAt: z.iso.datetime(),
  lastReviewedAt: z.iso.date(),
  sourceSummary: z.string().min(1),
  formulaSetVersion: z.literal('sbor-stats-v1'),
  pointsPerLevel: z.literal(3),
  dualWieldSkillGate: z.literal(200).default(200),
  knownGaps: z
    .array(
      z.object({
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
        sourceUrl: z.url().refine((url) => url.startsWith('https://')),
        sourceRevision: z.string().min(1),
        lastReviewedAt: z.iso.date(),
        verificationStatus: z.literal('verified'),
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
  equipment: z
    .array(equipmentRecordSchema)
    .refine(
      (rows) => rows.every((row) => row.verificationStatus === 'verified'),
      'production equipment must be verified',
    ),
});
