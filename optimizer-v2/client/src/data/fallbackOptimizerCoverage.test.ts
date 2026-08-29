import { describe, expect, it } from 'vitest';
import type { CharacterProfile, WeaponPath } from '../domain/build/model';
import { optimizeBuild } from '../domain/optimizer/optimizeBuild';
import { fallbackRelease } from './fallbackRelease';

const paths: WeaponPath[] = [
  'two-handed',
  'one-handed',
  'rapier',
  'dagger',
  'dual-wield',
  'melee',
];
const levels = [1, 50, 100, 150, 200, 250, 300];
const starterByPath: Record<WeaponPath, string> = {
  'two-handed': 'iron-greatsword',
  'one-handed': 'beginner-sword',
  rapier: 'iron-rapier',
  dagger: 'iron-dagger',
  'dual-wield': 'beginner-sword',
  melee: 'fists',
};

function profile(path: WeaponPath, level: number): CharacterProfile {
  const starter = starterByPath[path];
  return {
    schemaVersion: 2,
    id: `${path}-${level}`,
    level,
    maxFloor: level === 1 ? 1 : 19,
    weaponPath: path,
    goal: 'balanced',
    weaponSkill: path === 'dual-wield' ? Math.max(200, level) : Math.max(1, level),
    stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
    equipped: {
      'main-hand': starter,
      ...(path === 'dual-wield' ? { 'off-hand': starter } : {}),
      armor: 'beginner-armor',
    },
    ownedItemIds: [],
    datasetVersion: fallbackRelease.version,
  };
}

describe('fallback optimizer coverage', () => {
  it.each(paths.flatMap((path) => levels.map((level) => [path, level] as const)))(
    'returns a verified plan for %s at level %i',
    (path, level) => {
      const plan = optimizeBuild(profile(path, level), fallbackRelease);
      const equipment = new Map(
        fallbackRelease.equipment.map((item) => [item.id, item]),
      );

      expect(plan.datasetVersion).toBe(fallbackRelease.version);
      for (const target of plan.upgradeTargets) {
        expect(equipment.get(target.itemId)).toMatchObject({
          verificationStatus: 'verified',
          availability: 'always',
        });
      }
    },
  );
});
