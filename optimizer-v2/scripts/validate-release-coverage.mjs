import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const REQUIRED_FORMULA_IDS = [
  'points-per-level',
  'attack-from-str',
  'damage-reduction-from-def',
  'bonus-hp-from-vit',
  'stamina',
  'walk-speed-from-agi',
  'sprint-speed-from-agi',
  'crit-bonus-from-luk',
  'drop-bonus-from-luk',
];

export const OPTIMIZER_PATHS = [
  'two-handed',
  'one-handed',
  'rapier',
  'dagger',
  'dual-wield',
  'melee',
];

export const PROGRESSION_BANDS = [
  { id: '1-49', minimum: 1, maximum: 49 },
  { id: '50-99', minimum: 50, maximum: 99 },
  { id: '100-149', minimum: 100, maximum: 149 },
  { id: '150-199', minimum: 150, maximum: 199 },
  { id: '200-249', minimum: 200, maximum: 249 },
  { id: '250-299', minimum: 250, maximum: 299 },
  { id: '300+', minimum: 300, maximum: Number.POSITIVE_INFINITY },
];

const canonicalSource =
  /^https:\/\/swordbloxonlinerebirth\.fandom\.com\/wiki\/[A-Za-z0-9_%().,'-]+$/;
const officialGameUrl =
  'https://www.roblox.com/games/4733278992/Sword-Blox-Online-Rebirth';
const ownerAttestation = /^owner-gameplay-attestation:\d{4}-\d{2}-\d{2}$/;

function isVerifiedCanonical(row) {
  return (
    row?.verificationStatus === 'verified' &&
    typeof row.sourceUrl === 'string' &&
    canonicalSource.test(row.sourceUrl)
  );
}

function hasVerifiedFormulaProvenance(formula) {
  return (
    isVerifiedCanonical(formula) ||
    (formula?.id === 'points-per-level' &&
      formula.verificationStatus === 'verified' &&
      formula.sourceUrl === officialGameUrl &&
      ownerAttestation.test(formula.sourceRevision ?? ''))
  );
}

function isUsable(item) {
  return (
    isVerifiedCanonical(item) &&
    item.availability !== 'inactive-event' &&
    ['main-hand', 'off-hand'].includes(item.slot)
  );
}

function requirementFor(item) {
  return item.skillRequirement ?? item.levelRequirement;
}

function hasKnownGap(snapshot, path, band) {
  return (snapshot.knownGaps ?? []).some(
    (gap) =>
      gap.path === path &&
      gap.band === band.id &&
      typeof gap.reason === 'string' &&
      gap.reason.trim().length > 0 &&
      typeof gap.sourceRevision === 'string' &&
      gap.sourceRevision.length > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(gap.lastReviewedAt ?? '') &&
      isVerifiedCanonical(gap),
  );
}

export function validateReleaseCoverage(snapshot) {
  const errors = [];
  const formulas = Array.isArray(snapshot?.formulas) ? snapshot.formulas : [];
  const equipment = Array.isArray(snapshot?.equipment) ? snapshot.equipment : [];

  for (const formulaId of REQUIRED_FORMULA_IDS) {
    const matches = formulas.filter((formula) => formula.id === formulaId);
    if (matches.length !== 1) {
      errors.push(`Required formula ${formulaId} must appear exactly once`);
      continue;
    }
    if (!hasVerifiedFormulaProvenance(matches[0])) {
      errors.push(`Formula ${formulaId} does not have approved provenance`);
    }
  }
  for (const item of equipment) {
    if (!isVerifiedCanonical(item)) {
      errors.push(`Equipment ${item?.id ?? '<unknown>'} is not verified and canonical`);
    }
  }

  const usableWeapons = equipment.filter(isUsable);
  for (const path of OPTIMIZER_PATHS) {
    const hasEntryModel = usableWeapons.some(
      (item) =>
        item.weaponPaths?.includes(path) &&
        requirementFor(item) <= (path === 'dual-wield' ? 200 : 1),
    );
    if (!hasEntryModel) errors.push(`Missing usable entry item for ${path}`);
  }
  if (snapshot?.dualWieldSkillGate !== 200) {
    errors.push('Dual Wield must declare the documented 200-skill gate');
  }
  if (
    !usableWeapons.some(
      (item) =>
        item.weaponPaths?.includes('one-handed') &&
        item.weaponPaths?.includes('dual-wield'),
    )
  ) {
    errors.push('One-Handed data does not support the Dual Wield item model');
  }

  const hasArmor = equipment.some(
    (item) =>
      item.slot === 'armor' &&
      item.availability !== 'inactive-event' &&
      isVerifiedCanonical(item),
  );
  if (!hasArmor) errors.push('Missing verified obtainable armor');
  const hasShield = equipment.some(
    (item) =>
      item.slot === 'shield' &&
      item.availability !== 'inactive-event' &&
      ['one-handed', 'rapier', 'dagger'].some((path) =>
        item.weaponPaths?.includes(path),
      ) &&
      isVerifiedCanonical(item),
  );
  if (!hasShield) errors.push('Missing verified applicable shield');

  for (const path of OPTIMIZER_PATHS) {
    for (const band of PROGRESSION_BANDS) {
      if (path === 'dual-wield' && band.maximum < 200) continue;
      const covered = usableWeapons.some((item) => {
        const requirement = requirementFor(item);
        return (
          item.weaponPaths?.includes(path) &&
          Number.isFinite(requirement) &&
          requirement >= band.minimum &&
          requirement <= band.maximum
        );
      });
      if (!covered && !hasKnownGap(snapshot, path, band)) {
        errors.push(`Missing ${path} coverage for progression band ${band.id}`);
      }
    }
  }
  return [...new Set(errors)];
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('Usage: validate-release-coverage.mjs <release.json>');
  const snapshot = JSON.parse(await readFile(inputPath, 'utf8'));
  const errors = validateReleaseCoverage(snapshot);
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `Coverage valid: ${snapshot.version ?? '<unknown version>'}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
