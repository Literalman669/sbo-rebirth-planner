const canonicalApiBase =
  'https://swordbloxonlinerebirth.fandom.com/api.php';
export const MAXIMUM_WIKI_RESPONSE_BYTES = 2_000_000;

export const ALLOWED_WIKI_PAGES = new Set([
  'Stats',
  'One-Handed',
  'Two-Handed',
  'Rapier',
  'Dagger',
  'Melee',
  'Fists',
  'Armor',
  'Shields',
  'Upper Headwear',
  'Lower Headwear',
  'Gamepass and Badge Equipment',
  'Bestiary',
]);

export interface ParsedWikiRevision {
  pageTitle: string;
  revisionId: string;
  revisionTimestamp: string;
  content: string;
}

export function assertWikiResponseSize(byteLength: number): void {
  if (byteLength > MAXIMUM_WIKI_RESPONSE_BYTES) {
    throw new Error('MediaWiki response exceeds 2 MB');
  }
}

export function buildWikiApiUrl(
  pageTitle: string,
  baseUrl = canonicalApiBase,
): string {
  if (!ALLOWED_WIKI_PAGES.has(pageTitle)) {
    throw new Error('Wiki page is not allowlisted');
  }
  return (
    `${baseUrl}?action=query&prop=revisions&` +
    'rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&format=json&' +
    `formatversion=2&titles=${encodeURIComponent(pageTitle)}`
  );
}

export function parseMediaWikiRevisionResponse(
  body: string,
  expectedPageTitle: string,
): ParsedWikiRevision {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error('MediaWiki response is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || !('query' in parsed)) {
    throw new Error('MediaWiki response is missing query data');
  }
  const query = parsed.query;
  if (typeof query !== 'object' || query === null || !('pages' in query)) {
    throw new Error('MediaWiki response is missing pages');
  }
  const pages = query.pages;
  if (!Array.isArray(pages) || pages.length !== 1) {
    throw new Error('MediaWiki response must contain exactly one page');
  }
  const page = pages[0];
  if (
    typeof page !== 'object' ||
    page === null ||
    !('title' in page) ||
    page.title !== expectedPageTitle ||
    !('revisions' in page) ||
    !Array.isArray(page.revisions) ||
    page.revisions.length !== 1
  ) {
    throw new Error('MediaWiki page or revision is ambiguous');
  }
  const revision = page.revisions[0];
  if (
    typeof revision !== 'object' ||
    revision === null ||
    !('revid' in revision) ||
    !['number', 'string'].includes(typeof revision.revid) ||
    !('timestamp' in revision) ||
    typeof revision.timestamp !== 'string' ||
    !('slots' in revision) ||
    typeof revision.slots !== 'object' ||
    revision.slots === null ||
    !('main' in revision.slots) ||
    typeof revision.slots.main !== 'object' ||
    revision.slots.main === null ||
    !('content' in revision.slots.main) ||
    typeof revision.slots.main.content !== 'string'
  ) {
    throw new Error('MediaWiki revision fields are invalid');
  }
  return {
    pageTitle: expectedPageTitle,
    revisionId: String(revision.revid),
    revisionTimestamp: revision.timestamp,
    content: revision.slots.main.content,
  };
}
