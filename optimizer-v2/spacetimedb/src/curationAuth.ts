import { SenderError } from 'spacetimedb/server';
import type { AppReducerCtx } from './auth';

export function isOwner(ctx: AppReducerCtx): boolean {
  return Boolean(ctx.db.appConfig.ownerIdentity.find(ctx.sender));
}

export function isCurator(ctx: AppReducerCtx): boolean {
  return isOwner(ctx) || Boolean(ctx.db.curatorRole.identity.find(ctx.sender));
}

export function assertCurator(ctx: AppReducerCtx): void {
  if (!isCurator(ctx)) {
    throw new SenderError('Curator authorization required');
  }
}
