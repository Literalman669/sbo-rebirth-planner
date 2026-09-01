import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function readStoredBuilds(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open('sbo-rebirth-optimizer-v2');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('builds', 'readonly');
          const rows = transaction.objectStore('builds').getAll();
          rows.onerror = () => reject(rows.error);
          rows.onsuccess = () => {
            const stable = (rows.result as Array<{ profile: { id: string } }>)
              .sort((left, right) => left.profile.id.localeCompare(right.profile.id));
            resolve(JSON.stringify(stable));
            database.close();
          };
        };
      }),
  );
}

async function seedBuilds(page: Page) {
  await page.addInitScript(() => {
    const stores = [
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
    ];
    const request = indexedDB.open('sbo-rebirth-optimizer-v2', 6);
    request.onupgradeneeded = () => {
      for (const store of stores) {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store);
        }
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(
        ['builds', 'build-revisions'],
        'readwrite',
      );
      const profiles = [
        {
          schemaVersion: 2,
          id: 'strength-route',
          name: 'Strength Route',
          level: 8,
          maxFloor: 2,
          weaponPath: 'two-handed',
          goal: 'balanced',
          stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
          equipped: { 'main-hand': 'iron-greatsword', armor: 'fields-warrior' },
          ownedItemIds: [],
          datasetVersion: '2026.08.30.1',
        },
        {
          schemaVersion: 2,
          id: 'defense-route',
          name: 'Defense Route',
          level: 8,
          maxFloor: 2,
          weaponPath: 'two-handed',
          goal: 'balanced',
          stats: { str: 10, def: 4, agi: 3, vit: 7, luk: 0 },
          equipped: { 'main-hand': 'iron-greatsword', armor: 'fields-warrior' },
          ownedItemIds: [],
          datasetVersion: '2026.08.30.1',
        },
      ];
      for (const profile of profiles) {
        const revisionId = `${profile.id}-revision-1`;
        const createdAt = '2026-09-01T10:00:00.000Z';
        transaction.objectStore('builds').put(
          {
            profile,
            kind: 'build',
            headRevisionId: revisionId,
            createdAt,
            updatedAt: createdAt,
          },
          profile.id,
        );
        transaction.objectStore('build-revisions').put(
          {
            id: revisionId,
            buildId: profile.id,
            kind: 'build',
            profile,
            createdAt,
          },
          `${profile.id}:${revisionId}`,
        );
      }
      transaction.oncomplete = () => database.close();
    };
  });
}

test('compares, presets, backs up, imports, and restores guest builds', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Complete build-tools journey runs once.');
  await seedBuilds(page);
  await page.goto('/builds');
  await expect(page.getByText('Strength Route', { exact: true })).toBeVisible();
  await expect(page.getByText('Defense Route', { exact: true })).toBeVisible();

  const storedBefore = await readStoredBuilds(page);
  await page.getByRole('button', { name: 'Compare Strength Route' }).click();
  await page.getByLabel('Second build').selectOption({ label: 'Defense Route' });
  await expect(page).toHaveURL(/\/builds\/compare\?left=strength-route&right=defense-route/);
  await expect(page.getByRole('row', { name: /Damage per hit/ })).toContainText(
    'Higher verified value: First build',
  );
  await page.getByRole('button', { name: /Preview both with dataset/ }).click();
  await expect(page.getByText(/saved builds are unchanged/)).toBeVisible();
  expect(await readStoredBuilds(page)).toBe(storedBefore);

  await page.getByRole('link', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Save Strength Route as preset' }).click();
  await expect(page.getByText('Personal preset saved.')).toBeVisible();
  await page.getByRole('link', { name: 'Presets' }).click();
  await expect(page.getByText('Strength Route preset', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Back up library' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download library backup' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const backup = JSON.parse(await readFile(downloadPath!, 'utf8')) as {
    format?: string;
    records?: unknown[];
  };
  expect(backup.format).toBe('sbo-rebirth-build-library');
  expect(backup.records).toHaveLength(3);
  await page.getByRole('dialog', { name: 'Build backups' }).getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Import builds' }).click();
  await page.getByLabel('Choose build backup').setInputFiles(downloadPath!);
  await expect(page.getByText('3 valid builds')).toBeVisible();
  await page.getByRole('button', { name: 'Import as duplicates' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Import builds' }).getByRole('status'),
  ).toContainText('Builds imported locally');
  await page.getByRole('dialog', { name: 'Import builds' }).getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Import builds' }).click();
  await page.getByLabel('Choose build backup').setInputFiles(downloadPath!);
  await expect(page.getByText('3 valid builds')).toBeVisible();
  await page.getByRole('radio', { name: 'Overwrite matching builds' }).check();
  await page.getByRole('button', { name: 'Review overwrite' }).click();
  await page.getByRole('button', { name: 'Confirm recoverable overwrite' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Import builds' }).getByRole('status'),
  ).toContainText('Builds imported locally');
  await page.getByRole('dialog', { name: 'Import builds' }).getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'History for Strength Route', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Strength Route history' })).toBeVisible();
  const restorable = page.locator('button[aria-label^="Restore revision"]:not(:disabled)');
  await expect(restorable).toHaveCount(1);
  page.once('dialog', (dialog) => void dialog.accept());
  await restorable.click();
  await expect(page).toHaveURL(/\/character$/);
});
