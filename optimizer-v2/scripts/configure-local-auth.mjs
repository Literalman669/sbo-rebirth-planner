import { pathToFileURL } from 'node:url';

const fixedUri = 'http://127.0.0.1:3000';
const fixedDatabase = 'sbo-rebirth-optimizer-v2-test';

export function assertLocalAuthTarget(uri, database) {
  if (uri !== fixedUri || database !== fixedDatabase) {
    throw new Error(
      `Refusing local auth configuration outside ${fixedUri}/${fixedDatabase}`,
    );
  }
}

export async function configureLocalAuth({
  uri = fixedUri,
  database = fixedDatabase,
  ownerToken,
  fetchImpl = fetch,
} = {}) {
  assertLocalAuthTarget(uri, database);
  if (typeof ownerToken !== 'string' || ownerToken.length === 0) {
    throw new Error('SBO_LOCAL_OWNER_TOKEN is required');
  }

  const response = await fetchImpl(
    `${uri}/v1/database/${database}/call/configure_auth`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ownerToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(['development', '', '']),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Local auth configuration failed (${response.status}): ${detail}`,
    );
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await configureLocalAuth({ ownerToken: process.env.SBO_LOCAL_OWNER_TOKEN });
  console.info('Local development auth enabled for the fixed test database.');
}
