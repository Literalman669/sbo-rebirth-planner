import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { DatasetSnapshot } from '../src/domain/dataset/model';

const fallbackRelease = JSON.parse(
  readFileSync(
    new URL('../src/data/fallback-release.json', import.meta.url),
    'utf8',
  ),
) as DatasetSnapshot;

const databaseName = 'sbo-rebirth-optimizer-v2';

function historicalRelease(
  version: string,
  publishedAt: string,
  combatArmorCost: number,
) {
  const snapshot = structuredClone(fallbackRelease);
  snapshot.version = version;
  snapshot.publishedAt = publishedAt;
  snapshot.lastReviewedAt = publishedAt.slice(0, 10);
  snapshot.catalog = snapshot.catalog.map((item) =>
    item.id === 'combat-armor'
      ? {
          ...item,
          acquisitions: item.acquisitions.map((acquisition, index) =>
            index === 0
              ? { ...acquisition, cost: combatArmorCost }
              : acquisition,
          ),
        }
      : item,
  );
  return snapshot;
}

const pinned = historicalRelease(
  '2099.08.28.1',
  '2099-08-28T12:00:00.000Z',
  3_100,
);
const intermediate = historicalRelease(
  '2099.08.29.1',
  '2099-08-29T12:00:00.000Z',
  3_200,
);
const target = historicalRelease(
  '2099.08.30.1',
  '2099-08-30T12:00:00.000Z',
  3_360,
);
const seededProfile = {
  schemaVersion: 2 as const,
  id: 'dataset-proof-active',
  name: 'Dataset proof route',
  level: 8,
  maxFloor: 2,
  weaponPath: 'two-handed' as const,
  goal: 'balanced' as const,
  stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
  equipped: {
    'main-hand': 'iron-greatsword',
    armor: 'beginner-armor',
  },
  ownedItemIds: [] as string[],
  datasetVersion: pinned.version,
  accessPreferences: {
    activeEvent: false,
    gamepass: false,
    badge: false,
    limited: false,
  },
};

async function seedDatasetUpdateState(page: Page) {
  await page.addInitScript(
    ({ databaseName, profile, pinned, intermediate, target }) => {
      if (sessionStorage.getItem('dataset-update-fixture-seeded') === 'true') {
        return;
      }
      sessionStorage.setItem('dataset-update-fixture-seeded', 'true');
      const request = indexedDB.open(databaseName, 7);
      request.onupgradeneeded = () => {
        for (const store of [
          'draft',
          'builds',
          'pending-revisions',
          'dataset-releases',
          'planner-preferences',
          'plan-progress',
          'pending-planner-state',
          'quarantine',
          'inventory',
          'build-revisions',
          'dataset-review-receipts',
        ]) {
          if (!request.result.objectStoreNames.contains(store)) {
            request.result.createObjectStore(store);
          }
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(
          ['draft', 'dataset-releases'],
          'readwrite',
        );
        transaction.objectStore('draft').put(profile, 'active');
        transaction
          .objectStore('dataset-releases')
          .put(pinned, pinned.version);
        transaction
          .objectStore('dataset-releases')
          .put(intermediate, intermediate.version);
        transaction
          .objectStore('dataset-releases')
          .put(target, target.version);
        transaction.oncomplete = () => database.close();
      };
    },
    {
      databaseName,
      profile: seededProfile,
      pinned,
      intermediate,
      target,
    },
  );
}

async function seedSavedDatasetBuilds(page: Page) {
  const profiles = [
    { ...seededProfile, id: 'saved-proof', name: 'Saved proof route' },
    { ...seededProfile, id: 'preset-proof', name: 'Preset proof route' },
  ];
  await page.addInitScript(
    ({ databaseName, profiles, pinned, intermediate, target }) => {
      if (sessionStorage.getItem('dataset-saved-fixture-seeded') === 'true') {
        return;
      }
      sessionStorage.setItem('dataset-saved-fixture-seeded', 'true');
      const request = indexedDB.open(databaseName, 7);
      request.onupgradeneeded = () => {
        for (const store of [
          'draft',
          'builds',
          'pending-revisions',
          'dataset-releases',
          'planner-preferences',
          'plan-progress',
          'pending-planner-state',
          'quarantine',
          'inventory',
          'build-revisions',
          'dataset-review-receipts',
        ]) {
          if (!request.result.objectStoreNames.contains(store)) {
            request.result.createObjectStore(store);
          }
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(
          ['builds', 'build-revisions', 'dataset-releases'],
          'readwrite',
        );
        for (const [index, profile] of profiles.entries()) {
          const kind = index === 0 ? 'build' : 'personal-preset';
          const revisionId = `${profile.id}-revision-1`;
          const createdAt = `2026-08-29T10:0${index}:00.000Z`;
          transaction.objectStore('build-revisions').put({
            id: revisionId,
            buildId: profile.id,
            kind,
            profile,
            createdAt,
          }, `${profile.id}:${revisionId}`);
          transaction.objectStore('builds').put({
            profile,
            kind,
            headRevisionId: revisionId,
            createdAt,
            updatedAt: createdAt,
          }, profile.id);
        }
        transaction.objectStore('dataset-releases').put(pinned, pinned.version);
        transaction
          .objectStore('dataset-releases')
          .put(intermediate, intermediate.version);
        transaction.objectStore('dataset-releases').put(target, target.version);
        transaction.oncomplete = () => database.close();
      };
    },
    { databaseName, profiles, pinned, intermediate, target },
  );
}

async function readDatasetUpdateState(page: Page) {
  return page.evaluate(async (databaseName) => {
    const request = indexedDB.open(databaseName);
    return new Promise<{
      draft: Record<string, unknown> | undefined;
      build: Record<string, unknown> | undefined;
      revisions: Array<Record<string, unknown>>;
      receipt: Record<string, unknown> | undefined;
    }>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(
          ['draft', 'builds', 'build-revisions', 'dataset-review-receipts'],
          'readonly',
        );
        const draftRequest = transaction.objectStore('draft').get('active');
        const buildRequest = transaction
          .objectStore('builds')
          .get('dataset-proof-active');
        const revisionsRequest = transaction
          .objectStore('build-revisions')
          .getAll();
        const receiptRequest = transaction
          .objectStore('dataset-review-receipts')
          .get('dataset-proof-active');
        transaction.oncomplete = () => {
          resolve({
            draft: draftRequest.result,
            build: buildRequest.result,
            revisions: revisionsRequest.result,
            receipt: receiptRequest.result,
          });
          database.close();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, databaseName);
}

test('reviews, invalidates, previews, and atomically updates an unsaved guest draft', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The complete mutation journey runs once.');
  await seedDatasetUpdateState(page);
  await page.goto('/');

  await expect(page.getByText('Verified data update affects 1 build.')).toBeVisible();
  await page.getByRole('link', { name: 'Review changes' }).click();
  await expect(page).toHaveURL(/\/updates\?build=dataset-proof-active&source=local$|\/updates$/);
  const facts = page.getByRole('heading', { name: 'Verified facts changed' });
  const plan = page.getByRole('heading', { name: 'Effect on your plan' });
  await expect(facts).toBeVisible();
  await expect(plan).toBeVisible();
  const targetVersion = await page
    .locator('.dataset-impact-summary strong')
    .nth(1)
    .innerText();
  expect(await facts.evaluate((node) => {
    const other = document.querySelector('#plan-impact-heading');
    return Boolean(
      other &&
      node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING
    );
  })).toBe(true);
  await expect(page.getByRole('heading', { name: 'Release trail' })).toBeVisible();

  const beforePreview = await readDatasetUpdateState(page);
  await page.getByRole('button', { name: 'Open current preview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Current planner preview' }),
  ).toBeVisible();
  expect((await readDatasetUpdateState(page)).draft).toEqual(beforePreview.draft);

  await page.getByRole('button', { name: 'Keep pinned' }).click();
  await expect(page.getByText('Review saved. This build remains pinned.')).toBeVisible();
  await expect(page.getByText('Verified data update affects 1 build.')).toHaveCount(0);

  await page.goto('/character');
  await page.getByLabel('Highest Unlocked Floor').fill('3');
  await expect(page.getByText('Verified data update affects 1 build.')).toBeVisible();
  await page.getByRole('link', { name: 'Review changes' }).click();
  await expect(facts).toBeVisible();

  await page.getByRole('button', { name: 'Update this build' }).click();
  const dialog = page.getByRole('dialog', { name: 'Update Dataset proof route' });
  await expect(dialog).toContainText(
    'Only the dataset pin changes. Stats, equipment, inventory, level, and floor stay the same.',
  );
  await expect(
    dialog.getByRole('button', { name: 'Confirm dataset update' }),
  ).toBeFocused();
  await dialog.getByRole('button', { name: 'Confirm dataset update' }).click();
  await expect(page.getByRole('heading', { name: 'No owned builds need review' }))
    .toBeVisible();

  const stored = await readDatasetUpdateState(page);
  const revisions = stored.revisions
    .filter((revision) => revision.buildId === 'dataset-proof-active')
    .sort((left, right) =>
      Number(Boolean(left.parentRevisionId)) -
      Number(Boolean(right.parentRevisionId)),
    );
  expect(revisions).toHaveLength(2);
  expect(revisions.map((revision) =>
    (revision.profile as { datasetVersion: string }).datasetVersion,
  )).toEqual([pinned.version, targetVersion]);
  const withoutPin = (value: Record<string, unknown>) => {
    const clone = structuredClone(value);
    delete clone.datasetVersion;
    return clone;
  };
  expect(withoutPin(revisions[1]!.profile as Record<string, unknown>)).toEqual(
    withoutPin(revisions[0]!.profile as Record<string, unknown>),
  );
  expect(stored.draft).toMatchObject({
    id: 'dataset-proof-active',
    maxFloor: 3,
    datasetVersion: targetVersion,
  });
  expect(stored.build).toMatchObject({
    kind: 'build',
    headRevisionId: revisions[1]!.id,
  });
  expect(stored.receipt).toMatchObject({
    status: 'applied',
    pinnedDatasetVersion: pinned.version,
    targetDatasetVersion: targetVersion,
  });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'No owned builds need review' }))
    .toBeVisible();
});

test('updates saved builds and personal presets with one kind-preserving child revision', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Saved-record mutation coverage runs once.');
  await seedSavedDatasetBuilds(page);
  await page.goto('/updates?build=preset-proof&source=local');
  await expect(page.getByLabel('Review build')).toHaveValue('local:preset-proof');
  const targetVersion = await page
    .locator('.dataset-impact-summary strong')
    .nth(1)
    .innerText();
  await page.getByRole('button', { name: 'Update this build' }).click();
  await page.getByRole('button', { name: 'Confirm dataset update' }).click();
  await expect(page.getByLabel('Review build')).toHaveValue('local:saved-proof');

  const preset = await page.evaluate(async (databaseName) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const transaction = database.transaction(
      ['builds', 'build-revisions'],
      'readonly',
    );
    const buildRequest = transaction.objectStore('builds').get('preset-proof');
    const revisionsRequest = transaction.objectStore('build-revisions').getAll();
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return {
      build: buildRequest.result,
      revisions: revisionsRequest.result.filter(
        (revision: { buildId: string }) => revision.buildId === 'preset-proof',
      ),
    };
  }, databaseName);
  expect(preset.build).toMatchObject({
    kind: 'personal-preset',
    profile: { datasetVersion: targetVersion },
  });
  expect(preset.revisions).toHaveLength(2);
  expect(preset.revisions).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'personal-preset' }),
    expect.objectContaining({
      kind: 'personal-preset',
      parentRevisionId: 'preset-proof-revision-1',
    }),
  ]));

  await expect(
    page.getByRole('region', { name: 'Saved proof route' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Update this build' }).click();
  await page.getByRole('button', { name: 'Confirm dataset update' }).click();
  await expect(page.getByRole('heading', { name: 'No owned builds need review' }))
    .toBeVisible();
  expect((await readDatasetUpdateState(page)).draft).toBeUndefined();
});
