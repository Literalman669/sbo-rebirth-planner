import { z } from 'zod';

export const weaponPathSchema = z.enum([
  'two-handed',
  'one-handed',
  'rapier',
  'dagger',
  'dual-wield',
  'melee',
]);

export const optimizationGoalSchema = z.enum([
  'balanced',
  'damage',
  'survivability',
  'mobility',
  'farming',
]);

export const equipmentSlotSchema = z.enum([
  'main-hand',
  'off-hand',
  'armor',
  'shield',
  'upper-head',
  'lower-head',
]);

const boundedStat = z.number().int().min(0).max(500);

export const characterProfileSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(60).optional(),
  level: z.number().int().min(1).max(10_000),
  maxFloor: z.number().int().min(1).max(19),
  weaponPath: weaponPathSchema,
  goal: optimizationGoalSchema.default('balanced'),
  weaponSkill: z.number().int().min(0).max(10_000).optional(),
  stats: z.object({
    str: boundedStat,
    def: boundedStat,
    agi: boundedStat,
    vit: boundedStat,
    luk: boundedStat,
  }),
  equipped: z.partialRecord(equipmentSlotSchema, z.string().min(1)),
  ownedItemIds: z
    .array(z.string().min(1))
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'owned item IDs must be unique',
    ),
  datasetVersion: z.string().min(1),
});
