import { describe, expect, it } from 'vitest';
import type { StatBlock, StatName } from '../build/model';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import { compileMechanics } from './mechanics';
import { allocateNextTenLevels, allocateStatPlan } from './allocateStats';

const mechanics = compileMechanics(bootstrapRelease);

const standardInput = {
  level: 20,
  stats: { str: 20, def: 20, agi: 20, vit: 20, luk: 20 },
  gear: { attack: 30, defense: 20, dexterity: 50 },
  mechanics,
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
      mechanics,
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
      mechanics,
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

describe('allocateStatPlan', () => {
  it('allocates three current Level-1 points before ten future levels', () => {
    const plan = allocateStatPlan({
      level: 1,
      stats: { str: 0, def: 0, agi: 0, vit: 0, luk: 0 },
      gear: { attack: 2.5, defense: 0.5, dexterity: 3 },
      goal: 'balanced',
      mechanics,
      unspentPoints: 3,
    });

    expect(sum(plan.spendNow.added)).toBe(3);
    expect(plan.spendNow.totals).toEqual(plan.spendNow.added);
    expect(plan.levelRows.map((row) => row.level)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(plan.levelRows).toHaveLength(10);
    expect(plan.levelRows.every((row) => sum(row.added) === 3)).toBe(true);
    expect(sum(plan.final)).toBe(33);
  });

  it('reconciles every running total from spend-now through Level +10', () => {
    const plan = allocateStatPlan({
      ...standardInput,
      level: 8,
      stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
      goal: 'balanced',
      unspentPoints: 0,
    });
    let previous = plan.spendNow.totals;

    for (const row of plan.levelRows) {
      expect(row.totals).toEqual({
        str: previous.str + row.added.str,
        def: previous.def + row.added.def,
        agi: previous.agi + row.added.agi,
        vit: previous.vit + row.added.vit,
        luk: previous.luk + row.added.luk,
      });
      previous = row.totals;
    }

    expect(plan.final).toEqual(previous);
    expect(sum(plan.futureAdded)).toBe(30);
  });
});
