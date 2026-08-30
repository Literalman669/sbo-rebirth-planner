import { describe, expect, it } from 'vitest';
import { bootstrapRelease } from '../../data/bootstrapRelease';
import { compileMechanics } from './mechanics';
import { projectMetrics } from './projections';

const projectionInput = {
  level: 10,
  stats: { str: 100, def: 100, agi: 100, vit: 100, luk: 100 },
  gear: { attack: 10, defense: 10, dexterity: 10 },
};

describe('compileMechanics', () => {
  it('compiles the historical release from its stored mechanic records', () => {
    const mechanics = compileMechanics(bootstrapRelease);

    expect(mechanics.strDamagePerPoint).toBe(0.004);
    expect(mechanics.defMultiplierBase).toBe(5);
    expect(mechanics.dexHpBaseMultiplier).toBe(10);
    expect(mechanics.staminaPerLevel).toBe(5);
  });

  it('changes projections when a verified dataset parameter changes', () => {
    const changed = {
      ...bootstrapRelease,
      mechanics: bootstrapRelease.mechanics.map((mechanic) =>
        mechanic.id === 'attack-from-str'
          ? {
              ...mechanic,
              parameters: { ...mechanic.parameters, damagePerStr: 0.01 },
            }
          : mechanic,
      ),
    };
    const result = projectMetrics(projectionInput, compileMechanics(changed));

    expect(result.attackPerHit).toBe(20);
  });

  it('reports an unsupported projection instead of manufacturing zero', () => {
    const withoutDefense = {
      ...bootstrapRelease,
      mechanics: bootstrapRelease.mechanics.filter(
        (mechanic) => mechanic.id !== 'damage-reduction-from-def',
      ),
    };
    const result = projectMetrics(
      projectionInput,
      compileMechanics(withoutDefense),
    );

    expect(result.damageReductionPerHit).toBeNull();
  });
});
