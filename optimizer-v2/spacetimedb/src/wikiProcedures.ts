import {
  SenderError,
  t,
  type ProcedureCtx,
  type TransactionCtx,
} from 'spacetimedb/server';
import { assertOwner, type AppReducerCtx } from './auth';
import { assertCurator } from './curationAuth';
import spacetimedb, { wikiCheckJob, type AppSchema } from './schema';
import {
  assertWikiResponseSize,
  buildWikiApiUrl,
  parseMediaWikiRevisionResponse,
  type ParsedWikiRevision,
} from './wikiRevision';

function assertMayStage(ctx: TransactionCtx<AppSchema>): void {
  if (ctx.senderAuth.isInternal) return;
  assertCurator(ctx);
}

function candidateIdFor(revision: ParsedWikiRevision): string {
  const page = revision.pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${page}:${revision.revisionId}`;
}

function toSenderError(error: unknown): SenderError {
  return new SenderError(
    error instanceof Error ? error.message : 'MediaWiki response is invalid',
  );
}

function parseRevision(
  pageTitle: string,
  responseBody: string,
): ParsedWikiRevision {
  try {
    assertWikiResponseSize(new TextEncoder().encode(responseBody).byteLength);
    return parseMediaWikiRevisionResponse(responseBody, pageTitle);
  } catch (error) {
    throw toSenderError(error);
  }
}

function stageParsedRevision(
  ctx: AppReducerCtx,
  pageTitle: string,
  revision: ParsedWikiRevision,
): string {
  const candidateId = candidateIdFor(revision);
  const state = ctx.db.wikiSourceState.pageTitle.find(pageTitle);
  if (state?.lastRevisionId === revision.revisionId) {
    const existing = ctx.db.wikiCandidate.id.find(candidateId);
    if (existing) return existing.id;
  }
  if (!ctx.db.wikiCandidate.id.find(candidateId)) {
    ctx.db.wikiCandidate.insert({
      id: candidateId,
      pageTitle,
      sourceUrl: `https://swordbloxonlinerebirth.fandom.com/wiki/${encodeURIComponent(pageTitle)}`,
      revisionId: revision.revisionId,
      revisionTimestamp: revision.revisionTimestamp,
      content: revision.content,
      status: 'pending',
      createdAt: ctx.timestamp,
    });
  }
  if (state) {
    ctx.db.wikiSourceState.pageTitle.update({
      ...state,
      lastRevisionId: revision.revisionId,
      lastCheckedAt: ctx.timestamp,
    });
  } else {
    ctx.db.wikiSourceState.insert({
      pageTitle,
      lastRevisionId: revision.revisionId,
      lastCheckedAt: ctx.timestamp,
    });
  }
  return candidateId;
}

function stageWikiCandidate(
  ctx: ProcedureCtx<AppSchema>,
  pageTitle: string,
): string {
  ctx.withTx((tx) => {
    assertMayStage(tx);
  });
  let url: string;
  try {
    url = buildWikiApiUrl(pageTitle);
  } catch (error) {
    throw toSenderError(error);
  }
  const response = ctx.http.fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new SenderError(`MediaWiki request failed with status ${response.status}`);
  }
  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    try {
      assertWikiResponseSize(Number(contentLength));
    } catch (error) {
      throw toSenderError(error);
    }
  }
  const bytes = response.bytes();
  try {
    assertWikiResponseSize(bytes.byteLength);
  } catch (error) {
    throw toSenderError(error);
  }
  const revision = parseRevision(pageTitle, new TextDecoder().decode(bytes));

  return ctx.withTx((tx) => {
    assertMayStage(tx);
    return stageParsedRevision(tx, pageTitle, revision);
  });
}

export const stageWikiFixtureForLocalTest = spacetimedb.reducer(
  { pageTitle: t.string(), responseBody: t.string() },
  (ctx, { pageTitle, responseBody }) => {
    assertOwner(ctx);
    const auth = ctx.db.authConfig.key.find('primary');
    if (auth?.mode !== 'development') {
      throw new SenderError('Wiki fixtures require development auth');
    }
    try {
      buildWikiApiUrl(pageTitle);
    } catch (error) {
      throw toSenderError(error);
    }
    const revision = parseRevision(pageTitle, responseBody);
    stageParsedRevision(ctx, pageTitle, revision);
  },
);

export const fetchWikiCandidate = spacetimedb.procedure(
  { pageTitle: t.string() },
  t.string(),
  (ctx, { pageTitle }) => stageWikiCandidate(ctx, pageTitle),
);

export const fetchScheduledWikiCandidate = spacetimedb.procedure(
  { onSchedule: wikiCheckJob },
  { arg: wikiCheckJob.rowType },
  t.unit(),
  (ctx, { arg }) => {
    stageWikiCandidate(ctx, arg.pageTitle);
    return {};
  },
);
