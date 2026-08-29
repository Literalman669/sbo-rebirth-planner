import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export function selectSingleCurrentRelease(releases) {
  const current = releases.filter((release) => release.isCurrent);
  if (current.length !== 1) {
    throw new Error('Fallback export requires exactly one current release');
  }
  return current[0];
}

export function serializeFallback(snapshot) {
  const stable = {
    ...snapshot,
    formulas: [...snapshot.formulas].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    equipment: [...snapshot.equipment].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    knownGaps: [...(snapshot.knownGaps ?? [])].sort((left, right) =>
      `${left.path}:${left.band}`.localeCompare(`${right.path}:${right.band}`),
    ),
  };
  return `${JSON.stringify(stable, null, 2)}\n`;
}

async function connect(DbConnection, uri, databaseName) {
  return new Promise((resolve, reject) => {
    DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(databaseName)
      .onConnect((connection) => resolve(connection))
      .onConnectError((_context, error) => reject(error))
      .build();
  });
}

async function main() {
  const uri = process.env.SBO_SPACETIME_URI ?? 'http://127.0.0.1:3000';
  const databaseName =
    process.env.SBO_SPACETIME_DATABASE ?? 'sbo-rebirth-optimizer-v2-test';
  const outputPath = path.resolve(
    process.env.SBO_FALLBACK_OUTPUT ??
      'client/src/data/fallback-release.json',
  );
  const [{ DbConnection, tables }, { mapPublishedRelease }] = await Promise.all([
    import('../client/src/module_bindings/index.ts'),
    import('../client/src/infrastructure/spacetime/datasetMapper.ts'),
  ]);
  const connection = await connect(DbConnection, uri, databaseName);
  try {
    const subscription = await new Promise((resolve, reject) => {
      const handle = connection
        .subscriptionBuilder()
        .onApplied(() => resolve(handle))
        .onError((_context, error) => reject(error))
        .subscribe([
          tables.datasetRelease,
          tables.equipment,
          tables.formula,
          tables.sourceReference,
        ]);
    });
    try {
      const release = selectSingleCurrentRelease([
        ...connection.db.datasetRelease.iter(),
      ]);
      const snapshot = mapPublishedRelease(
        release,
        [...connection.db.equipment.iter()],
        [...connection.db.formula.iter()],
        [...connection.db.sourceReference.iter()],
      );
      await writeFile(outputPath, serializeFallback(snapshot), 'utf8');
      process.stdout.write(`Exported ${snapshot.version} to ${outputPath}\n`);
    } finally {
      subscription.unsubscribe();
    }
  } finally {
    connection.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
