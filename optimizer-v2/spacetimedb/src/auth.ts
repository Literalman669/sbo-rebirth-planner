import { SenderError, type ReducerCtx } from 'spacetimedb/server';
import type { AppSchema } from './schema';

export type AppReducerCtx = ReducerCtx<AppSchema>;

export function assertOwner(ctx: AppReducerCtx): void {
  const owner = ctx.db.appConfig.ownerIdentity.find(ctx.sender);
  if (!owner) throw new SenderError('Owner authorization required');
}

export function assertAppUser(ctx: AppReducerCtx): void {
  const config = ctx.db.authConfig.key.find('primary');
  if (!config || config.mode === 'locked') {
    throw new SenderError('Cloud features are not configured');
  }
  if (config.mode === 'development') return;
  if (config.mode !== 'production') {
    throw new SenderError('Cloud features are not configured');
  }

  const jwt = ctx.senderAuth.jwt;
  if (!ctx.senderAuth.hasJWT || !jwt) throw new SenderError('Sign in required');
  if (jwt.issuer !== config.issuer) throw new SenderError('Invalid token issuer');
  if (!jwt.audience.includes(config.audience)) {
    throw new SenderError('Invalid token audience');
  }
}
