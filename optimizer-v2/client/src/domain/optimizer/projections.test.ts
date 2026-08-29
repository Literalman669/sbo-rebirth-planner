import { describe, expect, it } from 'vitest';
import { projectMetrics } from './projections';

describe('projectMetrics', () => {
  it('projects the documented STR, DEF, VIT, stamina, AGI, and LUK effects', () => {
    const result = projectMetrics({
      level: 10,
      stats: { str: 100, def: 100, agi: 100, vit: 100, luk: 100 },
      gear: { attack: 50, defense: 20, dexterity: 40 },
    });

    expect(result.attackPerHit).toBeCloseTo(70);
    expect(result.damageReductionPerHit).toBeCloseTo(120);
    expect(result.bonusHp).toBeCloseTo(440);
    expect(result.stamina).toBeCloseTo(180);
    expect(result.walkSpeedBonus).toBeCloseTo(0.4);
    expect(result.sprintSpeedBonus).toBeCloseTo(2);
    expect(result.critChanceBonus).toBeCloseTo(0.01);
    expect(result.dropChanceBonus).toBeCloseTo(0.01);
  });

  it('caps invested stats at 500 for formula effects', () => {
    const result = projectMetrics({
      level: 1,
      stats: { str: 700, def: 700, agi: 700, vit: 700, luk: 700 },
      gear: { attack: 10, defense: 10, dexterity: 10 },
    });

    expect(result.attackPerHit).toBe(30);
    expect(result.damageReductionPerHit).toBe(100);
    expect(result.bonusHp).toBe(150);
    expect(result.stamina).toBe(255);
    expect(result.critChanceBonus).toBe(0.05);
    expect(result.dropChanceBonus).toBe(0.05);
  });
});
