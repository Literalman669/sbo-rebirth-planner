import { z } from 'zod';
import { characterProfileSchema } from './schema';
import type { SavedBuildRecord } from './record';

const persistedIdSchema = z.string().min(1).max(100);

export const savedBuildKindSchema = z.enum(['build', 'personal-preset']);

export const savedBuildRecordSchema = z
  .object({
    profile: characterProfileSchema,
    kind: savedBuildKindSchema,
    headRevisionId: persistedIdSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().optional(),
  })
  .strict();

export const buildRevisionSnapshotSchema = z
  .object({
    id: persistedIdSchema,
    buildId: persistedIdSchema,
    parentRevisionId: persistedIdSchema.optional(),
    kind: savedBuildKindSchema,
    profile: characterProfileSchema,
    createdAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((revision, context) => {
    if (revision.profile.id !== revision.buildId) {
      context.addIssue({
        code: 'custom',
        message: 'Revision profile must belong to its build',
        path: ['profile', 'id'],
      });
    }
    if (revision.parentRevisionId === revision.id) {
      context.addIssue({
        code: 'custom',
        message: 'Revision cannot be its own parent',
        path: ['parentRevisionId'],
      });
    }
  });

const deployedV5BuildRecordSchema = z
  .object({
    profile: characterProfileSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().optional(),
  })
  .strict();

export function legacyRevisionId(buildId: string): string {
  const validBuildId = persistedIdSchema.parse(buildId);
  return `legacy:${validBuildId.slice(0, 93)}`;
}

export function migrateSavedBuildRecord(raw: unknown): SavedBuildRecord {
  const current = savedBuildRecordSchema.safeParse(raw);
  if (current.success) return current.data;

  const legacy = deployedV5BuildRecordSchema.safeParse(raw);
  if (!legacy.success) throw new Error('Stored build is invalid');

  return savedBuildRecordSchema.parse({
    ...legacy.data,
    kind: 'build',
    headRevisionId: legacyRevisionId(legacy.data.profile.id),
  });
}
