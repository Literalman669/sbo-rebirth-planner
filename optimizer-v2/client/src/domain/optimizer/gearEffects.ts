import type { CharacterProfile } from '../build/model';
import type { CatalogEquipmentRecord } from '../dataset/model';

export interface GearEffects {
  attack: number;
  defense: number;
  dexterity: number;
  resistances: Record<string, number>;
  descriptiveEffects: string[];
  unsupportedNumericFields: string[];
}

export interface GearEffectComparison {
  rawDelta: {
    attack?: number;
    defense?: number;
    dexterity?: number;
    resistances: Record<string, number>;
  };
  unmodeledEffects: string[];
}

export function aggregateGearEffects(
  equipped: CharacterProfile['equipped'],
  equipment: ReadonlyMap<string, CatalogEquipmentRecord>,
): GearEffects {
  const result: GearEffects = {
    attack: 0,
    defense: 0,
    dexterity: 0,
    resistances: {},
    descriptiveEffects: [],
    unsupportedNumericFields: [],
  };
  const effects = new Set<string>();

  for (const itemId of Object.values(equipped)) {
    if (!itemId) continue;
    const item = equipment.get(itemId);
    if (!item) throw new Error(`equipped item is missing from catalog: ${itemId}`);
    for (const field of ['attack', 'defense', 'dexterity'] as const) {
      const value = item[field];
      if (value === null) {
        result.unsupportedNumericFields.push(`${item.id}:${field}`);
      } else {
        result[field] += value;
      }
    }
    for (const resistance of item.resistances) {
      result.resistances[resistance.status] =
        (result.resistances[resistance.status] ?? 0) + resistance.percent;
    }
    for (const effect of item.specialEffects) effects.add(effect);
  }

  result.descriptiveEffects = [...effects].sort();
  result.unsupportedNumericFields.sort();
  return result;
}

export function compareGearEffects(
  current: CatalogEquipmentRecord | undefined,
  target: CatalogEquipmentRecord,
): GearEffectComparison {
  const difference = (
    next: number | null,
    previous: number | null | undefined,
  ) =>
    next === null || previous === null
      ? undefined
      : next - (previous ?? 0);
  const currentResistances = new Map(
    (current?.resistances ?? []).map((resistance) => [
      resistance.status,
      resistance.percent,
    ]),
  );
  const targetResistances = new Map(
    target.resistances.map((resistance) => [
      resistance.status,
      resistance.percent,
    ]),
  );
  const resistanceNames = new Set([
    ...currentResistances.keys(),
    ...targetResistances.keys(),
  ]);
  const resistances = Object.fromEntries(
    [...resistanceNames]
      .sort()
      .map((status) => [
        status,
        (targetResistances.get(status) ?? 0) -
          (currentResistances.get(status) ?? 0),
      ])
      .filter(([, value]) => value !== 0),
  );

  return {
    rawDelta: {
      attack: difference(target.attack, current?.attack),
      defense: difference(target.defense, current?.defense),
      dexterity: difference(target.dexterity, current?.dexterity),
      resistances,
    },
    unmodeledEffects: [...target.specialEffects],
  };
}
