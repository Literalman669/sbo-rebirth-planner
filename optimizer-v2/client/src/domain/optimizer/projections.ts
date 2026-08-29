import type { StatBlock } from '../build/model';

export interface GearTotals {
  attack: number;
  defense: number;
  dexterity: number;
}

export interface ProjectedMetrics {
  attackPerHit: number;
  damageReductionPerHit: number;
  bonusHp: number;
  stamina: number;
  walkSpeedBonus: number;
  sprintSpeedBonus: number;
  critChanceBonus: number;
  dropChanceBonus: number;
}

function capInvestedStat(value: number) {
  return Math.min(Math.max(value, 0), 500);
}

export function projectMetrics(input: {
  level: number;
  stats: StatBlock;
  gear: GearTotals;
}): ProjectedMetrics {
  const str = capInvestedStat(input.stats.str);
  const def = capInvestedStat(input.stats.def);
  const agi = capInvestedStat(input.stats.agi);
  const vit = capInvestedStat(input.stats.vit);
  const luk = capInvestedStat(input.stats.luk);

  return {
    attackPerHit: input.gear.attack * (1 + str * 0.004),
    damageReductionPerHit: input.gear.defense * (5 + def * 0.01),
    bonusHp: input.gear.dexterity * (10 + vit * 0.01),
    stamina: 100 + input.level * 5 + 0.1 * (str + agi + vit),
    walkSpeedBonus: agi * 0.004,
    sprintSpeedBonus: agi * 0.02,
    critChanceBonus: Math.min(luk * 0.0001, 0.05),
    dropChanceBonus: Math.min(luk * 0.0001, 0.05),
  };
}
