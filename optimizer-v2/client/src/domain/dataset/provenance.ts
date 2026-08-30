export const OFFICIAL_GAME_URL =
  'https://www.roblox.com/games/4733278992/Sword-Blox-Online-Rebirth';

const canonicalWikiOrigin = 'https://swordbloxonlinerebirth.fandom.com';
const canonicalWikiPathPrefix = '/wiki/';
const canonicalWikiPageToken = /^[A-Za-z0-9_%().,'-]+$/;
const mediaWikiRevisionIdPattern = /^[1-9]\d*$/;
const ownerAttestationPattern = /^owner-gameplay-attestation:(\d{4}-\d{2}-\d{2})$/;

export function isCanonicalWikiSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'swordbloxonlinerebirth.fandom.com' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith(canonicalWikiPathPrefix)
  ) {
    return false;
  }
  const pageToken = url.pathname.slice(canonicalWikiPathPrefix.length);
  if (!canonicalWikiPageToken.test(pageToken)) return false;
  try {
    const decodedPageToken = decodeURIComponent(pageToken);
    if (
      decodedPageToken.length === 0 ||
      decodedPageToken === '.' ||
      decodedPageToken === '..' ||
      decodedPageToken.includes('/') ||
      decodedPageToken.includes('\\') ||
      /[\u0000-\u001F\u007F]/.test(decodedPageToken) ||
      pageToken !== encodeURIComponent(decodedPageToken)
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return value === `${canonicalWikiOrigin}${url.pathname}`;
}

export function hasNonblankSourceRevision(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isMediaWikiRevisionId(value: unknown): value is string {
  return typeof value === 'string' && mediaWikiRevisionIdPattern.test(value);
}

export function isOwnerGameplayAttestation(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = ownerAttestationPattern.exec(value)?.[1];
  if (!date) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

export function hasApprovedEquipmentProvenance(source: {
  sourceUrl: unknown;
  sourceRevision: unknown;
}): boolean {
  return (
    isCanonicalWikiSourceUrl(source.sourceUrl) &&
    isMediaWikiRevisionId(source.sourceRevision)
  );
}

export function hasApprovedFormulaProvenance(source: {
  id: unknown;
  sourceUrl: unknown;
  sourceRevision: unknown;
}): boolean {
  return (
    (isCanonicalWikiSourceUrl(source.sourceUrl) &&
      isMediaWikiRevisionId(source.sourceRevision)) ||
    (source.id === 'points-per-level' &&
      source.sourceUrl === OFFICIAL_GAME_URL &&
      isOwnerGameplayAttestation(source.sourceRevision))
  );
}

export function hasApprovedKnownGapProvenance(source: {
  sourceUrl: unknown;
  sourceRevision: unknown;
}): boolean {
  return hasApprovedEquipmentProvenance(source);
}
