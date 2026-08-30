import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWikiInventory } from './wiki/inventory.mjs';
import { fetchPageSnapshots } from './wiki/mediawiki-api.mjs';
import { parseEquipmentSnapshot } from '../client/src/domain/wiki/equipmentParser.ts';
import { parseMechanicsSnapshot } from '../client/src/domain/wiki/mechanicsParser.ts';
import { buildCoverageManifest } from '../client/src/domain/wiki/coverage.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestRoot = path.join(root, 'data', 'wiki-manifests');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function outputPathFromArgs(argv) {
  const index = argv.indexOf('--output');
  if (index < 0 || !argv[index + 1]) return null;
  const resolved = path.resolve(root, argv[index + 1]);
  const relative = path.relative(manifestRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Wiki audit output must stay inside data/wiki-manifests');
  }
  return resolved;
}

export async function auditWikiCatalog({
  inventory = buildWikiInventory(),
  fetchSnapshots = fetchPageSnapshots,
} = {}) {
  const resolvedInventory = await inventory;
  const fetched = await fetchSnapshots(
    resolvedInventory.map((entry) => entry.pageTitle),
  );
  const inventoryById = new Map(
    resolvedInventory.map((entry) => [entry.pageId, entry]),
  );
  const parsed = [];
  const mechanicRecords = [];
  const snapshotEvidence = [];

  for (const raw of fetched) {
    const entry = inventoryById.get(raw.pageId) ??
      resolvedInventory.find((candidate) => candidate.pageTitle === raw.pageTitle);
    if (!entry) continue;
    const snapshot = {
      pageId: raw.pageId,
      pageTitle: raw.pageTitle,
      sourceUrl: raw.sourceUrl,
      revisionId: raw.revisionId,
      revisionTimestamp: raw.revisionTimestamp,
      contentHash: `sha256:${sha256(raw.content)}`,
      ...(raw.redirectAlias ? { redirectTarget: raw.pageTitle } : {}),
      content: raw.content,
    };
    snapshotEvidence.push({
      pageId: snapshot.pageId,
      pageTitle: snapshot.pageTitle,
      revisionId: snapshot.revisionId,
      revisionTimestamp: snapshot.revisionTimestamp,
      contentHash: snapshot.contentHash,
    });
    if (entry.kind === 'equipment') {
      parsed.push(parseEquipmentSnapshot(snapshot));
    } else if (entry.kind === 'mechanics') {
      const mechanics = parseMechanicsSnapshot(snapshot);
      mechanicRecords.push(...mechanics.mechanics);
      parsed.push({ page: snapshot, equipment: [], aliases: [], warnings: mechanics.warnings, unresolved: mechanics.warnings.map((reason) => ({ pageTitle: snapshot.pageTitle, reason })) });
    } else {
      parsed.push({ page: snapshot, equipment: [], aliases: [], warnings: [], unresolved: [] });
    }
  }

  const coverage = buildCoverageManifest({
    inventory: resolvedInventory,
    parsed,
  });
  const catalog = parsed.flatMap((page) => page.equipment);
  return {
    generatedAt: new Date().toISOString(),
    wikiOrigin: 'https://swordbloxonlinerebirth.fandom.com',
    coverage,
    snapshots: snapshotEvidence,
    catalog: catalog.map((item) => ({
      id: item.id,
      name: item.name,
      slot: item.slot,
      verificationStatus: item.verificationStatus,
      sourceUrl: item.sourceUrl,
      sourceRevision: item.sourceRevision,
      acquisitionCount: item.acquisitions.length,
    })),
    mechanics: mechanicRecords.map((item) => ({
      id: item.id,
      computability: item.computability,
      verificationStatus: item.verificationStatus,
      sourceUrl: item.sourceUrl,
      sourceRevision: item.sourceRevision,
    })),
  };
}

async function main() {
  const output = outputPathFromArgs(process.argv.slice(2));
  const report = await auditWikiCatalog();
  if (output) {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify({
    output,
    coverage: report.coverage,
    mechanics: report.mechanics.length,
  }, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
