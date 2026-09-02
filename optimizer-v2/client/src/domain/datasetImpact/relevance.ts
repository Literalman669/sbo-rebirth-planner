import type { CharacterProfile } from '../build/model';
import type { DatasetSnapshot } from '../dataset/model';
import { classifyCandidate } from '../optimizer/eligibility';
import type { DatasetFactChange } from './factDiff';
import type { PlanEndpointResult } from './planDiff';

type RelevanceInput = {
  profile: CharacterProfile;
  pinned: DatasetSnapshot;
  target: DatasetSnapshot;
  pinnedPlan: PlanEndpointResult;
  targetPlan: PlanEndpointResult;
  changes: readonly DatasetFactChange[];
};

function addPlanItems(
  itemIds: Set<string>,
  endpoint: PlanEndpointResult,
) {
  if (endpoint.status !== 'ready') return;
  if (endpoint.plan.immediateAction.kind !== 'keep-current') {
    itemIds.add(endpoint.plan.immediateAction.itemId);
  }
  for (const target of endpoint.plan.upgradeTargets) itemIds.add(target.itemId);
}

function childEquipmentIndex(
  snapshots: readonly DatasetSnapshot[],
): Map<string, string> {
  const result = new Map<string, string>();
  for (const snapshot of snapshots) {
    for (const item of snapshot.catalog) {
      for (const acquisition of item.acquisitions) {
        result.set(acquisition.id, item.id);
      }
      for (const resistance of item.resistances) {
        result.set(`${item.id}:${resistance.status}`, item.id);
      }
      for (const effect of item.specialEffects) {
        result.set(`${item.id}:${effect}`, item.id);
      }
    }
    for (const item of snapshot.equipment) {
      result.set(`${item.id}:legacy-acquisition`, item.id);
    }
  }
  return result;
}

export function selectRelevantFactChanges({
  profile,
  pinned,
  target,
  pinnedPlan,
  targetPlan,
  changes,
}: RelevanceInput): {
  changes: DatasetFactChange[];
  omittedCount: number;
  relevantEquipmentIds: string[];
} {
  const relevantEquipmentIds = new Set([
    ...Object.values(profile.equipped).filter(
      (itemId): itemId is string => itemId !== undefined,
    ),
    ...profile.ownedItemIds,
  ]);
  addPlanItems(relevantEquipmentIds, pinnedPlan);
  addPlanItems(relevantEquipmentIds, targetPlan);
  const owned = new Set(profile.ownedItemIds);
  for (const snapshot of [pinned, target]) {
    for (const item of snapshot.equipment) {
      if (classifyCandidate(profile, item, owned).eligible) {
        relevantEquipmentIds.add(item.id);
      }
    }
  }
  const childItems = childEquipmentIndex([pinned, target]);
  const included = changes.filter((change) => {
    if (
      change.entity === 'formula' ||
      change.entity === 'mechanic' ||
      change.entity === 'release-policy'
    ) {
      return true;
    }
    if (change.entity === 'known-gap') {
      return change.entityId.split(':', 1)[0] === profile.weaponPath;
    }
    if (change.entity === 'equipment') {
      return relevantEquipmentIds.has(change.entityId);
    }
    const parent = childItems.get(change.entityId);
    if (parent) return relevantEquipmentIds.has(parent);
    return [...relevantEquipmentIds].some((itemId) =>
      change.entityId.startsWith(`${itemId}:`),
    );
  });
  included.sort(
    (left, right) =>
      left.entity.localeCompare(right.entity) ||
      left.entityId.localeCompare(right.entityId) ||
      left.field.localeCompare(right.field) ||
      left.id.localeCompare(right.id),
  );
  return {
    changes: included,
    omittedCount: changes.length - included.length,
    relevantEquipmentIds: [...relevantEquipmentIds].sort(),
  };
}
