import type {
  CatalogEquipmentRecord,
  DatasetSnapshot,
  EquipmentRecord,
} from '../dataset/model';

export type DatasetFactEntity =
  | 'equipment'
  | 'acquisition'
  | 'resistance'
  | 'special-effect'
  | 'formula'
  | 'mechanic'
  | 'known-gap'
  | 'release-policy';

export type ComparableFactValue =
  | string
  | number
  | boolean
  | null
  | readonly string[];

export interface DatasetFactRow {
  entity: DatasetFactEntity;
  entityId: string;
  field: string;
  value: ComparableFactValue;
  sourceUrl?: string;
  sourceRevision?: string;
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function row(
  entity: DatasetFactEntity,
  entityId: string,
  field: string,
  value: ComparableFactValue | undefined,
  sourceUrl?: string,
  sourceRevision?: string,
): DatasetFactRow | null {
  if (value === undefined) return null;
  return {
    entity,
    entityId,
    field,
    value,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceRevision ? { sourceRevision } : {}),
  };
}

function catalogEquipmentRows(item: CatalogEquipmentRecord): DatasetFactRow[] {
  const values = [
    row('equipment', item.id, 'name', item.name, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'aliases', sorted(item.aliases), item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'variantGroupId', item.variantGroupId, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'slot', item.slot, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'weaponPaths', sorted(item.weaponPaths), item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'attack', item.attack, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'defense', item.defense, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'dexterity', item.dexterity, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'levelRequirement', item.levelRequirement, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'skillRequirement', item.skillRequirement, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'verificationStatus', item.verificationStatus, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'sourceUrl', item.sourceUrl, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'sourceRevision', item.sourceRevision, item.sourceUrl, item.sourceRevision),
    row('equipment', item.id, 'lastReviewedAt', item.lastReviewedAt, item.sourceUrl, item.sourceRevision),
  ].flatMap((value) => (value ? [value] : []));

  for (const acquisition of item.acquisitions) {
    for (const [field, value] of Object.entries({
      type: acquisition.type,
      detail: acquisition.detail,
      floor: acquisition.floor,
      cost: acquisition.cost,
      currency: acquisition.currency,
      availability: acquisition.availability,
      accessType: acquisition.accessType,
      sourceUrl: acquisition.sourceUrl,
      sourceRevision: acquisition.sourceRevision,
    })) {
      const projected = row(
        'acquisition',
        acquisition.id,
        field,
        value,
        acquisition.sourceUrl,
        acquisition.sourceRevision,
      );
      if (projected) values.push(projected);
    }
  }
  for (const resistance of item.resistances) {
    const entityId = `${item.id}:${resistance.status}`;
    values.push(
      row('resistance', entityId, 'status', resistance.status, resistance.sourceUrl, resistance.sourceRevision)!,
      row('resistance', entityId, 'percent', resistance.percent, resistance.sourceUrl, resistance.sourceRevision)!,
      row('resistance', entityId, 'sourceUrl', resistance.sourceUrl, resistance.sourceUrl, resistance.sourceRevision)!,
      row('resistance', entityId, 'sourceRevision', resistance.sourceRevision, resistance.sourceUrl, resistance.sourceRevision)!,
    );
  }
  for (const effect of item.specialEffects) {
    values.push({
      entity: 'special-effect',
      entityId: `${item.id}:${effect}`,
      field: 'effect',
      value: effect,
      sourceUrl: item.sourceUrl,
      sourceRevision: item.sourceRevision,
    });
  }
  return values;
}

function legacyEquipmentRows(item: EquipmentRecord): DatasetFactRow[] {
  const source = [item.sourceUrl, item.sourceRevision] as const;
  return [
    row('equipment', item.id, 'name', item.name, ...source),
    row('equipment', item.id, 'aliases', [], ...source),
    row('equipment', item.id, 'slot', item.slot, ...source),
    row('equipment', item.id, 'weaponPaths', sorted(item.weaponPaths), ...source),
    row('equipment', item.id, 'attack', item.attack, ...source),
    row('equipment', item.id, 'defense', item.defense, ...source),
    row('equipment', item.id, 'dexterity', item.dexterity, ...source),
    row('equipment', item.id, 'levelRequirement', item.levelRequirement, ...source),
    row('equipment', item.id, 'skillRequirement', item.skillRequirement, ...source),
    row('equipment', item.id, 'verificationStatus', item.verificationStatus, ...source),
    row('equipment', item.id, 'sourceUrl', item.sourceUrl, ...source),
    row('equipment', item.id, 'sourceRevision', item.sourceRevision, ...source),
    row('equipment', item.id, 'lastReviewedAt', item.lastReviewedAt, ...source),
    row('acquisition', `${item.id}:legacy-acquisition`, 'type', item.acquisitionType, ...source),
    row('acquisition', `${item.id}:legacy-acquisition`, 'detail', item.acquisitionDetail, ...source),
    row('acquisition', `${item.id}:legacy-acquisition`, 'floor', item.floor, ...source),
    row('acquisition', `${item.id}:legacy-acquisition`, 'availability', item.availability, ...source),
    row('acquisition', `${item.id}:legacy-acquisition`, 'sourceUrl', item.sourceUrl, ...source),
    row('acquisition', `${item.id}:legacy-acquisition`, 'sourceRevision', item.sourceRevision, ...source),
  ].flatMap((value) => (value ? [value] : []));
}

export function projectDatasetFacts(snapshot: DatasetSnapshot): DatasetFactRow[] {
  const values: DatasetFactRow[] = [];
  if (snapshot.catalog.length > 0) {
    for (const item of snapshot.catalog) values.push(...catalogEquipmentRows(item));
  } else {
    for (const item of snapshot.equipment) values.push(...legacyEquipmentRows(item));
  }
  for (const formula of snapshot.formulas) {
    for (const [field, value] of Object.entries({
      expression: formula.expression,
      units: formula.units,
      applicability: formula.applicability,
      boundaryBehavior: formula.boundaryBehavior,
      verificationStatus: formula.verificationStatus,
      sourceUrl: formula.sourceUrl,
      sourceRevision: formula.sourceRevision,
      lastReviewedAt: formula.lastReviewedAt,
    })) {
      values.push(row('formula', formula.id, field, value, formula.sourceUrl, formula.sourceRevision)!);
    }
  }
  for (const mechanic of snapshot.mechanics) {
    for (const [field, value] of Object.entries({
      expression: mechanic.expression,
      units: mechanic.units,
      applicability: mechanic.applicability,
      boundaryBehavior: mechanic.boundaryBehavior,
      computability: mechanic.computability,
      verificationStatus: mechanic.verificationStatus,
      sourceUrl: mechanic.sourceUrl,
      sourceRevision: mechanic.sourceRevision,
      lastReviewedAt: mechanic.lastReviewedAt,
    })) {
      values.push(row('mechanic', mechanic.id, field, value, mechanic.sourceUrl, mechanic.sourceRevision)!);
    }
    for (const [name, value] of Object.entries(mechanic.parameters)) {
      values.push(row('mechanic', mechanic.id, `parameters.${name}`, value, mechanic.sourceUrl, mechanic.sourceRevision)!);
    }
  }
  for (const gap of snapshot.knownGaps ?? []) {
    const entityId = `${gap.path}:${gap.band}`;
    for (const [field, value] of Object.entries(gap)) {
      values.push(row('known-gap', entityId, field, value, gap.sourceUrl, gap.sourceRevision)!);
    }
  }
  for (const [field, value] of Object.entries({
    formulaSetVersion: snapshot.formulaSetVersion,
    strategyPolicyVersion: snapshot.strategyPolicyVersion,
    pointsPerLevel: snapshot.pointsPerLevel,
    dualWieldSkillGate: snapshot.dualWieldSkillGate,
  })) {
    const projected = row('release-policy', 'release', field, value);
    if (projected) values.push(projected);
  }
  return values.sort(
    (left, right) =>
      left.entity.localeCompare(right.entity) ||
      left.entityId.localeCompare(right.entityId) ||
      left.field.localeCompare(right.field),
  );
}
