import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const builder = {
    withUri: vi.fn(),
    withDatabaseName: vi.fn(),
    withToken: vi.fn(),
  };
  builder.withUri.mockReturnValue(builder);
  builder.withDatabaseName.mockReturnValue(builder);
  builder.withToken.mockReturnValue(builder);
  return { builder, create: vi.fn(() => builder) };
});

vi.mock('../../module_bindings', () => ({
  DbConnection: { builder: sdk.create },
}));

import { createConnectionBuilder } from './connection';

describe('createConnectionBuilder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps a tokenless connection for guest data', () => {
    expect(createConnectionBuilder()).toBe(sdk.builder);
    expect(sdk.builder.withToken).not.toHaveBeenCalled();
  });

  it('attaches the OIDC ID token for an authenticated connection', () => {
    expect(createConnectionBuilder('signed-id-token')).toBe(sdk.builder);
    expect(sdk.builder.withToken).toHaveBeenCalledWith('signed-id-token');
  });
});
