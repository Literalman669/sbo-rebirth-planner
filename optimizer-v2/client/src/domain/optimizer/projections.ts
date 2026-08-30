import type { StatBlock } from '../build/model';
import type { CompiledMechanics } from './mechanics';

export interface GearTotals {
  attack: number;
  defense: number;
  dexterity: number;
}

export interface ProjectedMetrics {
  attackPerHit: number | null;
  damageReductionPerHit: number | null;
  bonusHp: number | null;
  stamina: number | null;
  walkSpeedBonus: number | null;
  sprintSpeedBonus: number | null;
  critChanceBonus: number | null;
  dropChanceBonus: number | null;
  multiHitChanceBonus: number | null;
  debuffResistanceBonus: number | null;
}

function capInvestedStat(value: number, cap: number) {
  return Math.min(Math.max(value, 0), cap);
}

function allNumbers(
  values: Array<number | undefined>,
): values is number[] {
  return values.every(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
}

export function projectMetrics(
  input: {
    level: number;
    stats: StatBlock;
    gear: GearTotals;
  },
  mechanics: CompiledMechanics,
): ProjectedMetrics {
  const str = capInvestedStat(input.stats.str, mechanics.statCap);
  const def = capInvestedStat(input.stats.def, mechanics.statCap);
  const agi = capInvestedStat(input.stats.agi, mechanics.statCap);
  const vit = capInvestedStat(input.stats.vit, mechanics.statCap);
  const luk = capInvestedStat(input.stats.luk, mechanics.statCap);

  const attackParameters = [mechanics.strDamagePerPoint];
  const defenseParameters = [
    mechanics.defMultiplierBase,
    mechanics.defMultiplierPerPoint,
  ];
  const hpParameters = [
    mechanics.dexHpBaseMultiplier,
    mechanics.vitDexMultiplierPerPoint,
  ];
  const staminaParameters = [
    mechanics.staminaBase,
    mechanics.staminaPerLevel,
    mechanics.staminaPerStrAgiVitPoint,
  ];
  const multiHitParameters = [
    mechanics.multiHitPerStrLuk,
    mechanics.multiHitIndividualCap,
    mechanics.multiHitCombinedCap,
  ];

  return {
    attackPerHit: allNumbers(attackParameters)
      ? input.gear.attack * (1 + str * attackParameters[0])
      : null,
    damageReductionPerHit: allNumbers(defenseParameters)
      ? input.gear.defense *
        (defenseParameters[0] + def * defenseParameters[1])
      : null,
    bonusHp: allNumbers(hpParameters)
      ? input.gear.dexterity * (hpParameters[0] + vit * hpParameters[1])
      : null,
    stamina: allNumbers(staminaParameters)
      ? staminaParameters[0] +
        input.level * staminaParameters[1] +
        staminaParameters[2] * (str + agi + vit)
      : null,
    walkSpeedBonus:
      mechanics.walkSpeedPerAgi === undefined
        ? null
        : agi * mechanics.walkSpeedPerAgi,
    sprintSpeedBonus:
      mechanics.sprintSpeedPerAgi === undefined
        ? null
        : agi * mechanics.sprintSpeedPerAgi,
    critChanceBonus:
      mechanics.critPerLuk === undefined || mechanics.critCap === undefined
        ? null
        : Math.min(luk * mechanics.critPerLuk, mechanics.critCap),
    dropChanceBonus:
      mechanics.dropPerLuk === undefined || mechanics.dropCap === undefined
        ? null
        : Math.min(luk * mechanics.dropPerLuk, mechanics.dropCap),
    multiHitChanceBonus: allNumbers(multiHitParameters)
      ? Math.min(
          Math.min(str * multiHitParameters[0], multiHitParameters[1]) +
            Math.min(luk * multiHitParameters[0], multiHitParameters[1]),
          multiHitParameters[2],
        )
      : null,
    debuffResistanceBonus:
      mechanics.resistancePerVit === undefined ||
      mechanics.resistanceCap === undefined
        ? null
        : Math.min(vit * mechanics.resistancePerVit, mechanics.resistanceCap),
  };
}
