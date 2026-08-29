import { describe, expect, it } from 'vitest';
import { generateShareId } from './shareId';

describe('generateShareId', () => {
  it('encodes 32 random bytes as an unpadded base64url identifier', () => {
    const shareId = generateShareId((bytes) => {
      bytes.fill(255);
      return bytes;
    });

    expect(shareId).toHaveLength(43);
    expect(shareId).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    expect(shareId).not.toContain('=');
  });
});
