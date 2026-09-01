import { z } from 'zod';
import type { PlanProgress } from '../planner/state';
import { planProgressSchema } from '../planner/stateSchema';
import type { CharacterProfile } from './model';
import type { BuildRevisionSnapshot, SavedBuildKind } from './record';
import {
  buildRevisionSnapshotSchema,
  savedBuildKindSchema,
} from './recordSchema';
import { characterProfileSchema } from './schema';

export const MAX_BUILD_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_BUILD_BACKUP_RECORDS = 250;
export const MAX_BUILD_BACKUP_REVISIONS = 100;

export interface PortableBuildRecord {
  profile: CharacterProfile;
  kind: SavedBuildKind;
  headRevisionId: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  planProgress?: PlanProgress;
  revisions: BuildRevisionSnapshot[];
}

export interface PortableBuildEnvelope {
  format: 'sbo-rebirth-build-library';
  schemaVersion: 1;
  scope: 'single' | 'library';
  exportedAt: string;
  records: PortableBuildRecord[];
}

export type BuildImportMode = 'duplicate' | 'overwrite';
export type BuildImportAction = 'duplicate' | 'overwrite' | 'create';

export interface BuildImportPreviewRow {
  sourceId: string;
  targetId: string;
  name: string;
  kind: SavedBuildKind;
  datasetVersion: string;
  revisionCount: number;
  conflict: boolean;
  action: BuildImportAction;
}

export interface BuildImportPlan {
  mode: BuildImportMode;
  records: PortableBuildRecord[];
  preview: BuildImportPreviewRow[];
}

export interface CloudPortableBuildSource {
  profile: CharacterProfile;
  kind: SavedBuildKind;
  headRevisionId: string;
  archivedAt?: string;
  history: Array<{
    revisionId: string;
    createdAt: string;
    datasetVersion: string;
    profile: CharacterProfile;
    kind: SavedBuildKind;
  }>;
}

const strictProfileSchema = characterProfileSchema.strict();

const portableRevisionSchema = buildRevisionSnapshotSchema.superRefine(
  (revision, context) => {
    const strictProfile = strictProfileSchema.safeParse(revision.profile);
    if (!strictProfile.success) {
      context.addIssue({
        code: 'custom',
        message: 'Revision profile is invalid',
        path: ['profile'],
      });
    }
  },
);

const portableRecordSchema = z
  .object({
    profile: strictProfileSchema,
    kind: savedBuildKindSchema,
    headRevisionId: z.string().min(1).max(100),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().optional(),
    planProgress: planProgressSchema.optional(),
    revisions: z
      .array(portableRevisionSchema)
      .min(1)
      .max(MAX_BUILD_BACKUP_REVISIONS),
  })
  .strict()
  .superRefine((record, context) => {
    const revisionIds = new Set(record.revisions.map((revision) => revision.id));
    if (revisionIds.size !== record.revisions.length) {
      context.addIssue({
        code: 'custom',
        message: 'Revision IDs must be unique',
        path: ['revisions'],
      });
    }
    const head = record.revisions.find(
      (revision) => revision.id === record.headRevisionId,
    );
    if (!head || head.kind !== record.kind) {
      context.addIssue({
        code: 'custom',
        message: 'Build head is invalid',
        path: ['headRevisionId'],
      });
    }
    if (
      record.revisions.some(
        (revision) =>
          revision.buildId !== record.profile.id ||
          revision.profile.id !== record.profile.id ||
          (revision.parentRevisionId !== undefined &&
            !revisionIds.has(revision.parentRevisionId)),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Revision chain is invalid',
        path: ['revisions'],
      });
    }
    if (
      record.planProgress &&
      record.planProgress.buildId !== record.profile.id
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Plan progress belongs to another build',
        path: ['planProgress', 'buildId'],
      });
    }
  });

const portableEnvelopeSchema = z
  .object({
    format: z.literal('sbo-rebirth-build-library'),
    schemaVersion: z.literal(1),
    scope: z.enum(['single', 'library']),
    exportedAt: z.iso.datetime(),
    records: z.array(portableRecordSchema).max(MAX_BUILD_BACKUP_RECORDS),
  })
  .strict()
  .superRefine((envelope, context) => {
    const ids = envelope.records.map((record) => record.profile.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'Build IDs must be unique',
        path: ['records'],
      });
    }
    if (envelope.scope === 'single' && envelope.records.length !== 1) {
      context.addIssue({
        code: 'custom',
        message: 'Single-build backups require exactly one record',
        path: ['records'],
      });
    }
  });

function normalizedRecord(record: PortableBuildRecord): PortableBuildRecord {
  return {
    ...structuredClone(record),
    revisions: [...record.revisions]
      .map((revision) => structuredClone(revision))
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id),
      ),
  };
}

function normalizeEnvelope(
  envelope: PortableBuildEnvelope,
): PortableBuildEnvelope {
  return {
    ...structuredClone(envelope),
    records: envelope.records
      .map(normalizedRecord)
      .sort((left, right) => left.profile.id.localeCompare(right.profile.id)),
  };
}

export function createBuildBackup(input: {
  scope: PortableBuildEnvelope['scope'];
  exportedAt: string;
  records: readonly PortableBuildRecord[];
}): PortableBuildEnvelope {
  const parsed = portableEnvelopeSchema.parse({
    format: 'sbo-rebirth-build-library',
    schemaVersion: 1,
    scope: input.scope,
    exportedAt: input.exportedAt,
    records: input.records,
  });
  return normalizeEnvelope(parsed);
}

export function serializeBuildBackup(envelope: PortableBuildEnvelope): string {
  const parsed = portableEnvelopeSchema.parse(envelope);
  return `${JSON.stringify(normalizeEnvelope(parsed), null, 2)}\n`;
}

export function parseBuildBackup(text: string): PortableBuildEnvelope {
  if (new TextEncoder().encode(text).byteLength > MAX_BUILD_BACKUP_BYTES) {
    throw new Error('Build backup exceeds 10 MiB');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Build backup is not valid JSON');
  }
  const parsed = portableEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Build backup is invalid or unsupported');
  }
  return normalizeEnvelope(parsed.data);
}

export function portableRecordFromCloud(
  source: CloudPortableBuildSource,
  planProgress?: PlanProgress,
): PortableBuildRecord {
  const history = [...source.history].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.revisionId.localeCompare(right.revisionId),
  );
  const revisions = history.map((revision, index) =>
    buildRevisionSnapshotSchema.parse({
      id: revision.revisionId,
      buildId: source.profile.id,
      ...(index > 0
        ? { parentRevisionId: history[index - 1]!.revisionId }
        : {}),
      kind: revision.kind,
      profile: revision.profile,
      createdAt: revision.createdAt,
    }),
  );
  return portableRecordSchema.parse({
    profile: source.profile,
    kind: source.kind,
    headRevisionId: source.headRevisionId,
    createdAt: history[0]?.createdAt,
    updatedAt:
      history.find((revision) => revision.revisionId === source.headRevisionId)
        ?.createdAt ?? history.at(-1)?.createdAt,
    archivedAt: source.archivedAt,
    ...(planProgress ? { planProgress } : {}),
    revisions,
  });
}

function importedName(profile: CharacterProfile) {
  const sourceName = profile.name ?? `Level ${profile.level} build`;
  const suffix = ' imported';
  return `${sourceName.slice(0, 60 - suffix.length)}${suffix}`;
}

export function planBuildImport(
  envelope: PortableBuildEnvelope,
  existing: ReadonlyMap<string, { headRevisionId: string }>,
  options: { mode?: BuildImportMode; randomUUID(): string },
): BuildImportPlan {
  const validated = portableEnvelopeSchema.parse(envelope);
  const mode = options.mode ?? 'duplicate';
  const records = validated.records.map((source) => {
    const conflict = existing.get(source.profile.id);
    const overwriting = mode === 'overwrite' && Boolean(conflict);
    const targetBuildId = mode === 'duplicate'
      ? options.randomUUID()
      : source.profile.id;
    const targetName = mode === 'duplicate'
      ? importedName(source.profile)
      : source.profile.name;
    const revisionIds = new Map(
      source.revisions.map((revision) => [revision.id, options.randomUUID()]),
    );
    const revisions = source.revisions.map((revision, index) =>
      portableRevisionSchema.parse({
        ...structuredClone(revision),
        id: revisionIds.get(revision.id)!,
        buildId: targetBuildId,
        profile: {
          ...structuredClone(revision.profile),
          id: targetBuildId,
          ...(targetName ? { name: targetName } : { name: undefined }),
        },
        parentRevisionId:
          index === 0 && overwriting
            ? conflict!.headRevisionId
            : revision.parentRevisionId
              ? revisionIds.get(revision.parentRevisionId)
              : undefined,
      }),
    );
    const plannedProfile = strictProfileSchema.parse({
      ...structuredClone(source.profile),
      id: targetBuildId,
      ...(targetName ? { name: targetName } : { name: undefined }),
    });
    return {
      ...structuredClone(source),
      profile: plannedProfile,
      headRevisionId: revisionIds.get(source.headRevisionId)!,
      revisions,
      ...(source.planProgress
        ? {
            planProgress: {
              ...structuredClone(source.planProgress),
              buildId: targetBuildId,
            },
          }
        : {}),
    };
  });

  return {
    mode,
    records,
    preview: records.map((record, index) => {
      const source = validated.records[index]!;
      const conflict = existing.has(source.profile.id);
      const action: BuildImportAction = mode === 'duplicate'
        ? 'duplicate'
        : conflict
          ? 'overwrite'
          : 'create';
      return {
        sourceId: source.profile.id,
        targetId: record.profile.id,
        name: record.profile.name ?? `Level ${record.profile.level} build`,
        kind: record.kind,
        datasetVersion: record.profile.datasetVersion,
        revisionCount: record.revisions.length,
        conflict,
        action,
      };
    }),
  };
}
