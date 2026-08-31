import { z } from 'zod';
import {
  createEmptyInventory,
  normalizeInventoryState,
  type InventoryBackup,
  type InventoryState,
} from './state';

const controlCharacters = /[\u0000-\u001f\u007f]/;
const unsafeTextControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const persistedIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !controlCharacters.test(value), 'ID is invalid');
const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;
const uniqueIdList = (maximum: number) =>
  z
    .array(persistedIdSchema)
    .max(maximum)
    .refine(uniqueIds, 'IDs must be unique');

export const inventoryStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    ownedItemIds: uniqueIdList(2_000),
    favoriteItemIds: uniqueIdList(2_000),
    comparisonItemIds: uniqueIdList(4),
    notes: z
      .record(
        persistedIdSchema,
        z
          .string()
          .trim()
          .min(1)
          .max(500)
          .refine(
            (value) => !unsafeTextControls.test(value),
            'Note is invalid',
          ),
      )
      .refine((notes) => Object.keys(notes).length <= 500, 'Too many notes'),
  })
  .strict();

export const inventoryBackupSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: z.iso.datetime(),
    datasetVersion: persistedIdSchema.max(100),
    inventory: inventoryStateSchema,
  })
  .strict();

export function migrateInventoryState(raw: unknown): InventoryState {
  if (raw === undefined || raw === null) return createEmptyInventory();
  const parsed = inventoryStateSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Stored inventory is invalid');
  return normalizeInventoryState(parsed.data);
}

export function parseInventoryBackup(rawJson: string): InventoryBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(rawJson) as unknown;
  } catch {
    throw new Error('Inventory backup is invalid');
  }
  const parsed = inventoryBackupSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Inventory backup is invalid');
  return {
    ...parsed.data,
    inventory: normalizeInventoryState(parsed.data.inventory),
  };
}
