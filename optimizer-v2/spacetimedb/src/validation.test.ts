import { describe, expect, it } from 'vitest';
import { assertExactlyOneCurrentRelease } from './validation';

describe('assertExactlyOneCurrentRelease', () => {
  it('rejects two current releases', () => {
    expect(() =>
      assertExactlyOneCurrentRelease([
        { version: 'bootstrap-0', isCurrent: true },
        { version: 'bootstrap-1', isCurrent: true },
      ]),
    ).toThrow('exactly one current dataset release required');
  });
});
