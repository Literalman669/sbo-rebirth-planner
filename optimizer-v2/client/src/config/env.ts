export const appEnv = {
  spacetimeUri:
    import.meta.env.VITE_SPACETIME_URI ?? 'http://127.0.0.1:3000',
  databaseName:
    import.meta.env.VITE_SPACETIME_DATABASE ?? 'sbo-rebirth-optimizer-v2-dev',
  spacetimeAuthClientId:
    import.meta.env.VITE_SPACETIMEAUTH_CLIENT_ID ?? null,
} as const;
