export const OFFICIAL_GAME_URL =
  'https://www.roblox.com/games/4733278992/Sword-Blox-Online-Rebirth';

const canonicalWikiSourcePattern =
  /^https:\/\/swordbloxonlinerebirth\.fandom\.com\/wiki\/[A-Za-z0-9_%().,'-]+$/;
const ownerAttestationPattern = /^owner-gameplay-attestation:(\d{4}-\d{2}-\d{2})$/;

export function isCanonicalWikiSourceUrl(value: unknown): value is string {
  return typeof value === 'string' && canonicalWikiSourcePattern.test(value);
}

export function hasNonblankSourceRevision(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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
    hasNonblankSourceRevision(source.sourceRevision)
  );
}

export function hasApprovedFormulaProvenance(source: {
  id: unknown;
  sourceUrl: unknown;
  sourceRevision: unknown;
}): boolean {
  return (
    (isCanonicalWikiSourceUrl(source.sourceUrl) &&
      hasNonblankSourceRevision(source.sourceRevision)) ||
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
