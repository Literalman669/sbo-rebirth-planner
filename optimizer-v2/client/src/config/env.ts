const spacetimeUri =
  import.meta.env.VITE_SPACETIME_URI ?? 'http://127.0.0.1:3000';
const databaseName =
  import.meta.env.VITE_SPACETIME_DATABASE ?? 'sbo-rebirth-optimizer-v2-dev';
const isFixedLocalTestTarget =
  import.meta.env.DEV &&
  spacetimeUri === 'http://127.0.0.1:3000' &&
  databaseName === 'sbo-rebirth-optimizer-v2-test';

export const appEnv = {
  spacetimeUri,
  databaseName,
  spacetimeAuthClientId:
    import.meta.env.VITE_SPACETIMEAUTH_CLIENT_ID ?? null,
  testAuthToken: isFixedLocalTestTarget
    ? (import.meta.env.VITE_TEST_AUTH_TOKEN ?? null)
    : null,
} as const;
