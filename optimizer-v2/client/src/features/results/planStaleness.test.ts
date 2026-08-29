import { describe, expect, it } from 'vitest';
import { isPlanStale } from './planStaleness';

describe('isPlanStale', () => {
  it('marks plans made with a different dataset version as stale', () => {
    expect(isPlanStale('2026.08.29.1', '2026.08.29.2')).toBe(true);
    expect(isPlanStale('2026.08.29.2', '2026.08.29.2')).toBe(false);
  });
});
