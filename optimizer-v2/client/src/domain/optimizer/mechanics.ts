import type { DatasetSnapshot, MechanicRecord } from '../dataset/model';

export interface CompiledMechanics {
  version: DatasetSnapshot['formulaSetVersion'];
  pointsPerLevel: 3;
  statCap: number;
  strDamagePerPoint?: number;
  defMultiplierBase?: number;
  defMultiplierPerPoint?: number;
  dexHpBaseMultiplier?: number;
  vitDexMultiplierPerPoint?: number;
  staminaBase?: number;
  staminaPerLevel?: number;
  staminaPerStrAgiVitPoint?: number;
  walkSpeedPerAgi?: number;
  sprintSpeedPerAgi?: number;
  critPerLuk?: number;
  critCap?: number;
  dropPerLuk?: number;
  dropCap?: number;
  multiHitPerStrLuk?: number;
  multiHitIndividualCap?: number;
  multiHitCombinedCap?: number;
  resistancePerVit?: number;
  resistanceCap?: number;
  descriptive: MechanicRecord[];
}

function exactMechanic(snapshot: DatasetSnapshot, id: string) {
  return snapshot.mechanics.find(
    (mechanic) =>
      mechanic.id === id &&
      mechanic.verificationStatus === 'verified' &&
      mechanic.computability === 'exact',
  );
}

function parameter(
  mechanic: MechanicRecord | undefined,
  name: string,
) {
  const value = mechanic?.parameters[name];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function compileMechanics(
  snapshot: DatasetSnapshot,
): CompiledMechanics {
  const attack = exactMechanic(snapshot, 'attack-from-str');
  const defense = exactMechanic(snapshot, 'damage-reduction-from-def');
  const hp = exactMechanic(snapshot, 'bonus-hp-from-vit');
  const stamina = exactMechanic(snapshot, 'stamina');
  const walk = exactMechanic(snapshot, 'walk-speed-from-agi');
  const sprint = exactMechanic(snapshot, 'sprint-speed-from-agi');
  const crit = exactMechanic(snapshot, 'crit-bonus-from-luk');
  const drop = exactMechanic(snapshot, 'drop-bonus-from-luk');
  const multiHit = exactMechanic(snapshot, 'multi-hit-from-str-luk');
  const resistance = exactMechanic(snapshot, 'resistance-from-vit');
  const statCap =
    parameter(attack, 'statCap') ??
    parameter(defense, 'statCap') ??
    parameter(hp, 'statCap') ??
    500;

  return {
    version: snapshot.formulaSetVersion,
    pointsPerLevel: snapshot.pointsPerLevel,
    statCap,
    strDamagePerPoint: parameter(attack, 'damagePerStr'),
    defMultiplierBase: parameter(defense, 'baseDefenseMultiplier'),
    defMultiplierPerPoint: parameter(defense, 'defenseMultiplierPerDef'),
    dexHpBaseMultiplier: parameter(hp, 'dexHpBaseMultiplier'),
    vitDexMultiplierPerPoint: parameter(hp, 'dexHpMultiplierPerVit'),
    staminaBase: parameter(stamina, 'staminaBase'),
    staminaPerLevel: parameter(stamina, 'staminaPerLevel'),
    staminaPerStrAgiVitPoint: parameter(
      stamina,
      'staminaPerStrAgiVitPoint',
    ),
    walkSpeedPerAgi: parameter(walk, 'walkSpeedPerAgi'),
    sprintSpeedPerAgi: parameter(sprint, 'sprintSpeedPerAgi'),
    critPerLuk: parameter(crit, 'critPerLuk'),
    critCap: parameter(crit, 'critCap'),
    dropPerLuk: parameter(drop, 'dropPerLuk'),
    dropCap: parameter(drop, 'dropCap'),
    multiHitPerStrLuk: parameter(multiHit, 'bonusPerPoint'),
    multiHitIndividualCap: parameter(multiHit, 'individualCap'),
    multiHitCombinedCap: parameter(multiHit, 'combinedCap'),
    resistancePerVit: parameter(resistance, 'bonusPerVit'),
    resistanceCap: parameter(resistance, 'cap'),
    descriptive: snapshot.mechanics.filter(
      (mechanic) => mechanic.computability !== 'exact',
    ),
  };
}
