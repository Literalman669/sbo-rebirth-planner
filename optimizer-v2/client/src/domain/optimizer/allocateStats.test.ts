import { describe, expect, it } from 'vitest';
import type { StatBlock, StatName } from '../build/model';
import { allocateNextTenLevels } from './allocateStats';

const standardInput = {
  level: 20,
  stats: { str: 20, def: 20, agi: 20, vit: 20, luk: 20 },
  gear: { attack: 30, defense: 20, dexterity: 50 },
} as const;

const statNames: StatName[] = ['str', 'def', 'agi', 'vit', 'luk'];

function sum(stats: StatBlock) {
  return statNames.reduce((total, stat) => total + stats[stat], 0);
}

describe('allocateNextTenLevels', () => {
  it('allocates exactly thirty points with five- and ten-level milestones', () => {
    const result = allocateNextTenLevels({
      ...standardInput,
      goal: 'balanced',
    });

    expect(result.levels).toBe(10);
    expect(result.totalPoints).toBe(30);
    expect(sum(result.added)).toBe(30);
    expect(result.milestones.map((milestone) => milestone.afterLevel)).toEqual([
      5, 10,
    ]);
    expect(sum(result.milestones[0].added)).toBe(15);
    expect(sum(result.milestones[1].added)).toBe(30);
  });

  it('is deterministic for the same profile and goal', () => {
    const input = { ...standardInput, goal: 'balanced' as const };

    expect(allocateNextTenLevels(input)).toEqual(allocateNextTenLevels(input));
  });

  it('keeps every final stat at or below 500', () => {
    const result = allocateNextTenLevels({
      level: 300,
      stats: { str: 500, def: 500, agi: 490, vit: 490, luk: 490 },
      gear: { attack: 500, defense: 500, dexterity: 500 },
      goal: 'balanced',
    });

    expect(Math.max(...Object.values(result.final))).toBeLessThanOrEqual(500);
    expect(sum(result.added)).toBe(30);
  });

  it('keeps a balanced plan distributed across at least three stats', () => {
    const result = allocateNextTenLevels({
      ...standardInput,
      goal: 'balanced',
    });

    expect(Object.values(result.added).filter((value) => value > 0).length).toBeGreaterThanOrEqual(3);
  });

  it('does not let low-level mobility gains erase a balanced defense deficit', () => {
    const result = allocateNextTenLevels({
      level: 8,
      stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
      gear: { attack: 3, defense: 0.5, dexterity: 3 },
      goal: 'balanced',
    });

    expect(result.added.def).toBeGreaterThan(0);
    expect(result.added.agi).toBeLessThan(25);
    expect(Object.values(result.added).filter((value) => value > 0).length).toBeGreaterThanOrEqual(3);
  });

  it('lets focused goals emphasize their defining stat group', () => {
    const damage = allocateNextTenLevels({ ...standardInput, goal: 'damage' });
    const survival = allocateNextTenLevels({
      ...standardInput,
      goal: 'survivability',
    });
    const mobility = allocateNextTenLevels({
      ...standardInput,
      goal: 'mobility',
    });
    const farming = allocateNextTenLevels({ ...standardInput, goal: 'farming' });

    expect(damage.added.str).toBeGreaterThan(damage.added.luk);
    expect(survival.added.def + survival.added.vit).toBeGreaterThan(
      survival.added.str + survival.added.luk,
    );
    expect(mobility.added.agi).toBeGreaterThan(mobility.added.def);
    expect(farming.added.luk).toBeGreaterThan(farming.added.str);
  });
});
