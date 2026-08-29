import { describe, expect, it } from 'vitest';
import { datasetSnapshotSchema } from '../domain/dataset/schema';
import { bootstrapRelease } from './bootstrapRelease';

describe('bootstrapRelease', () => {
  it('is a complete verified dataset snapshot', () => {
    const parsed = datasetSnapshotSchema.parse(bootstrapRelease);

    expect(parsed.formulas).toHaveLength(9);
    expect(
      parsed.equipment.every(
        (item) => item.verificationStatus === 'verified',
      ),
    ).toBe(true);
  });

  it('covers all six optimizer weapon paths', () => {
    const paths = new Set(
      bootstrapRelease.equipment.flatMap((item) => item.weaponPaths),
    );

    expect(paths).toEqual(
      new Set([
        'two-handed',
        'one-handed',
        'rapier',
        'dagger',
        'dual-wield',
        'melee',
      ]),
    );
  });
});
