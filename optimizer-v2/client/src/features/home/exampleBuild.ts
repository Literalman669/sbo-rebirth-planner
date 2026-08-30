import type { CharacterProfile } from '../../domain/build/model';
import type { DatasetSnapshot } from '../../domain/dataset/model';

export type VerifiedExampleBuildResult =
  | {
      available: true;
      profile: CharacterProfile;
      unspentPoints: 3;
    }
  | { available: false; reason: string };

export function createVerifiedExampleBuild(
  snapshot: DatasetSnapshot,
): VerifiedExampleBuildResult {
  const starterWeapon = snapshot.equipment.find(
    (item) =>
      item.verificationStatus === 'verified' &&
      item.slot === 'main-hand' &&
      item.weaponPaths.includes('two-handed') &&
      item.levelRequirement <= 1 &&
      item.floor <= 1 &&
      item.acquisitionType === 'starter',
  );
  if (!starterWeapon) {
    return {
      available: false,
      reason: 'A verified level-one two-handed starter is unavailable.',
    };
  }
  const starterArmor = snapshot.equipment.find(
    (item) =>
      item.verificationStatus === 'verified' &&
      item.slot === 'armor' &&
      item.levelRequirement <= 1 &&
      item.floor <= 1 &&
      item.acquisitionType === 'starter',
  );
  if (!starterArmor) {
    return {
      available: false,
      reason: 'A verified level-one starter armor is unavailable.',
    };
  }

  return {
    available: true,
    unspentPoints: 3,
    profile: {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      name: 'Verified Starter Example',
      level: 1,
      maxFloor: 1,
      weaponPath: 'two-handed',
      goal: 'balanced',
      stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
      equipped: {
        'main-hand': starterWeapon.id,
        armor: starterArmor.id,
      },
      ownedItemIds: [starterWeapon.id, starterArmor.id],
      datasetVersion: snapshot.version,
    },
  };
}
