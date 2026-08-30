import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditWikiCatalog } from './audit-wiki-catalog.mjs';
import { bootstrapRelease } from '../client/src/data/bootstrapRelease.ts';
import { datasetSnapshotSchema } from '../client/src/domain/dataset/schema.ts';
import { projectCatalogForOptimizer } from '../client/src/domain/dataset/catalogProjection.ts';
import { firstReleaseSnapshot } from './first-release-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releasePath = path.join(
  root,
  'client',
  'src',
  'data',
  'fallback-release.json',
);
const manifestPath = path.join(
  root,
  'data',
  'wiki-manifests',
  '2026-08-30.json',
);

const { report, verifiedCatalog, mechanicRecords } = await auditWikiCatalog();
const mechanicsById = new Map(
  [...mechanicRecords, ...bootstrapRelease.mechanics].map((mechanic) => [
    mechanic.id,
    mechanic,
  ]),
);
for (const mechanic of mechanicRecords) {
  mechanicsById.set(mechanic.id, mechanic);
}
const equipment = projectCatalogForOptimizer(verifiedCatalog);
const release = datasetSnapshotSchema.parse({
  version: '2026.08.30.1',
  publishedAt: '2026-08-30T00:00:00.000Z',
  lastReviewedAt: '2026-08-30',
  sourceSummary:
    `${report.coverage.verified} verified equipment records reconciled from ` +
    `${report.coverage.discovered} canonical wiki pages; unresolved fields remain excluded.`,
  formulaSetVersion: 'sbor-stats-v2',
  strategyPolicyVersion: 'sbor-policy-v2',
  pointsPerLevel: 3,
  dualWieldSkillGate: 200,
  knownGaps: firstReleaseSnapshot.knownGaps,
  formulas: bootstrapRelease.formulas,
  mechanics: [...mechanicsById.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  ),
  catalog: verifiedCatalog,
  equipment,
});

await mkdir(path.dirname(releasePath), { recursive: true });
await mkdir(path.dirname(manifestPath), { recursive: true });
await Promise.all([
  writeFile(releasePath, `${JSON.stringify(release, null, 2)}\n`, 'utf8'),
  writeFile(manifestPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
]);
process.stdout.write(
  `${JSON.stringify({
    version: release.version,
    catalog: release.catalog.length,
    optimizerEquipment: release.equipment.length,
    priced: release.catalog.filter((item) =>
      item.acquisitions.some((acquisition) => acquisition.cost !== undefined),
    ).length,
    releasePath,
    manifestPath,
  }, null, 2)}\n`,
);
