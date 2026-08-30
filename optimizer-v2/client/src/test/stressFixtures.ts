import { bootstrapRelease } from '../data/bootstrapRelease';
import type { CharacterProfile, EquipmentSlot } from '../domain/build/model';
import type { DatasetSnapshot, EquipmentRecord } from '../domain/dataset/model';
import { classifyCandidate } from '../domain/optimizer/eligibility';
import type { RecommendationPlan } from '../domain/optimizer/optimizeBuild';
import type { ImmediateAction, UpgradeTarget } from '../domain/optimizer/recommendEquipment';

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Recommendation invariant failed: ${message}`);
}

function sourceBacked(item: EquipmentRecord) {
  try {
    const source = new URL(item.sourceUrl);
    return (
      item.verificationStatus === 'verified' &&
      source.protocol === 'https:' &&
      item.lastReviewedAt.length > 0
    );
  } catch {
    return false;
  }
}

function targetSlotApplies(
  profile: CharacterProfile,
  item: EquipmentRecord,
  slot: EquipmentSlot,
) {
  return (
    item.slot === slot ||
    (profile.weaponPath === 'dual-wield' &&
      item.slot === 'main-hand' &&
      slot === 'off-hand')
  );
}

function invariantItem(
  itemId: string,
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): EquipmentRecord {
  const item = dataset.equipment.find((candidate) => candidate.id === itemId);
  invariant(item, `item ${itemId} is missing from dataset ${dataset.version}`);
  invariant(sourceBacked(item), `item ${itemId} is not verified and source-backed`);
  invariant(
    classifyCandidate(profile, item, new Set(profile.ownedItemIds)).eligible,
    `item ${itemId} is not eligible for this profile`,
  );
  return item;
}

function assertImmediateAction(
  action: ImmediateAction,
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
) {
  invariant(
    action.kind === 'equip-owned' ||
      action.kind === 'obtain-upgrade' ||
      action.kind === 'keep-current',
    'plan must contain exactly one supported immediate action',
  );

  if (action.kind === 'keep-current') return;

  const item = invariantItem(action.itemId, profile, dataset);
  const classification = classifyCandidate(
    profile,
    item,
    new Set(profile.ownedItemIds),
  );
  invariant(classification.eligible && classification.immediate, `action item ${item.id} is not immediately eligible`);
  invariant(
    action.kind !== 'equip-owned' || profile.ownedItemIds.includes(item.id),
    `equip-owned action item ${item.id} is not owned`,
  );
  invariant(
    action.kind !== 'obtain-upgrade' || !profile.ownedItemIds.includes(item.id),
    `obtain-upgrade action item ${item.id} is already owned`,
  );
}

function assertUpgradeTarget(
  target: UpgradeTarget,
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
) {
  const item = invariantItem(target.itemId, profile, dataset);
  invariant(target.sourceUrl === item.sourceUrl, `target ${item.id} source does not match the dataset`);
  invariant(targetSlotApplies(profile, item, target.slot), `target ${item.id} does not apply to ${target.slot}`);
}

export function buildStressProfile(
  overrides: Partial<CharacterProfile> = {},
): CharacterProfile {
  const profile: CharacterProfile = {
    schemaVersion: 2,
    id: 'stress-profile',
    name: 'Reliability Stress Profile',
    level: 8,
    maxFloor: 2,
    weaponPath: 'one-handed',
    goal: 'balanced',
    weaponSkill: 10,
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {
      'main-hand': 'beginner-sword',
      armor: 'beginner-armor',
      shield: 'wooden-shield',
    },
    ownedItemIds: ['beginner-sword', 'beginner-armor', 'wooden-shield'],
    datasetVersion: bootstrapRelease.version,
  };

  return { ...profile, ...overrides };
}

export function buildStressDataset(
  overrides: Partial<DatasetSnapshot> = {},
): DatasetSnapshot {
  const dataset: DatasetSnapshot = {
    ...bootstrapRelease,
    formulas: bootstrapRelease.formulas.map((formula) => ({ ...formula })),
    equipment: bootstrapRelease.equipment.map((item) => ({ ...item })),
    knownGaps: (bootstrapRelease.knownGaps as DatasetSnapshot['knownGaps'])?.map(
      (gap) => ({ ...gap }),
    ),
  };

  return { ...dataset, ...overrides };
}

export function assertRecommendationInvariants(
  plan: RecommendationPlan,
  profile: CharacterProfile,
  dataset: DatasetSnapshot,
): void {
  invariant(profile.datasetVersion === dataset.version, 'profile dataset version must exactly match the dataset');
  invariant(plan.datasetVersion === dataset.version, 'plan dataset version must exactly match the dataset');
  invariant(plan.statPlan.levels === 10, 'plan must cover ten future levels');
  invariant(plan.statPlan.totalPoints === 30, 'plan must allocate thirty future points');
  invariant(
    Object.values(plan.statPlan.added).reduce((total, value) => total + value, 0) === 30,
    'added stats must total thirty future points',
  );

  assertImmediateAction(plan.immediateAction, profile, dataset);
  invariant(plan.upgradeTargets.length <= 3, 'plan must contain at most three upgrade targets');

  const slots = new Set<EquipmentSlot>();
  const itemIds = new Set<string>();
  for (const target of plan.upgradeTargets) {
    assertUpgradeTarget(target, profile, dataset);
    invariant(!slots.has(target.slot), `duplicate target slot ${target.slot}`);
    invariant(!itemIds.has(target.itemId), `duplicate target item ${target.itemId}`);
    slots.add(target.slot);
    itemIds.add(target.itemId);
  }
}
