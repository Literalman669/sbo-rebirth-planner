import { z } from 'zod';
import {
  mergeInventoryStates,
  normalizeInventoryState,
  type InventoryState,
} from '../../domain/inventory/state';
import {
  inventoryBackupSchema,
  inventoryStateSchema,
  migrateInventoryState,
  parseInventoryBackup,
} from '../../domain/inventory/stateSchema';
import {
  DEFAULT_GUEST_DATABASE_NAME,
  openPlannerDatabase,
} from './plannerDatabase';

const INVENTORY_KEY = 'primary';

const quarantinedRecordSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal('inventory'),
    rawJson: z.string(),
    quarantinedAt: z.iso.datetime(),
  })
  .strict();

export type InventoryImportMode = 'merge' | 'replace';

export interface InventoryStore {
  load(): Promise<InventoryState>;
  save(inventory: InventoryState): Promise<void>;
  reset(): Promise<void>;
  exportBackup(datasetVersion: string): Promise<string>;
  importBackup(
    rawJson: string,
    mode: InventoryImportMode,
  ): Promise<InventoryState>;
}

type InventoryStoreOptions = {
  databaseName?: string;
  now?: () => string;
};

export function createInventoryStore({
  databaseName = DEFAULT_GUEST_DATABASE_NAME,
  now = () => new Date().toISOString(),
}: InventoryStoreOptions = {}): InventoryStore {
  const databasePromise = openPlannerDatabase(databaseName);

  async function quarantine(raw: unknown) {
    const database = await databasePromise;
    const record = quarantinedRecordSchema.parse({
      id: `inventory:${crypto.randomUUID()}`,
      kind: 'inventory',
      rawJson: JSON.stringify(raw),
      quarantinedAt: now(),
    });
    await database.put('quarantine', record, record.id);
  }

  async function load(): Promise<InventoryState> {
    const database = await databasePromise;
    const raw = await database.get('inventory', INVENTORY_KEY);
    try {
      return migrateInventoryState(raw);
    } catch (error) {
      await quarantine(raw);
      throw error;
    }
  }

  async function save(inventory: InventoryState): Promise<void> {
    const normalized = normalizeInventoryState(inventory);
    const valid = inventoryStateSchema.parse(normalized);
    const database = await databasePromise;
    await database.put('inventory', valid, INVENTORY_KEY);
  }

  return {
    load,
    save,

    async reset() {
      const database = await databasePromise;
      await database.delete('inventory', INVENTORY_KEY);
    },

    async exportBackup(datasetVersion) {
      const backup = inventoryBackupSchema.parse({
        schemaVersion: 1,
        exportedAt: now(),
        datasetVersion,
        inventory: await load(),
      });
      return `${JSON.stringify(backup, null, 2)}\n`;
    },

    async importBackup(rawJson, mode) {
      const backup = parseInventoryBackup(rawJson);
      const next =
        mode === 'merge'
          ? mergeInventoryStates(await load(), backup.inventory)
          : normalizeInventoryState(backup.inventory);
      await save(next);
      return next;
    },
  };
}
