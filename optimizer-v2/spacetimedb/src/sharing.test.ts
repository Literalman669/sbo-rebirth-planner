import { describe, expect, it } from 'vitest';
import { validateShareableBuildKind } from './validation';

describe('build sharing kind boundary', () => {
  it('allows normal builds and rejects direct personal-preset sharing', () => {
    expect(validateShareableBuildKind('build')).toEqual([]);
    expect(validateShareableBuildKind('personal-preset')).toEqual([
      'Personal presets must be copied to a build before sharing',
    ]);
  });
});
