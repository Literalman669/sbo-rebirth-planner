import { expect, test, type Page } from '@playwright/test';

const databaseName = 'sbo-rebirth-optimizer-v2';

async function seedProgressBuilds(page: Page) {
  await page.goto('/');
  await page.evaluate(({ databaseName }) => new Promise<void>((resolve, reject) => {
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
      'dataset-review-receipts',
    ];
    const active = {
      schemaVersion: 2,
      id: 'progress-proof-active',
      name: 'Progress Proof Active',
      level: 8,
      maxFloor: 2,
      weaponPath: 'two-handed',
      goal: 'balanced',
      stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
      equipped: { 'main-hand': 'iron-greatsword', armor: 'fields-warrior' },
      ownedItemIds: [],
      datasetVersion: '2026.08.30.1',
    };
    const saved = {
      ...active,
      id: 'progress-proof-saved',
      name: 'Progress Proof Saved',
      level: 9,
    };
    const request = indexedDB.open(databaseName, 7);
    request.onerror = () => reject(request.error);
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
        ['draft', 'builds', 'build-revisions', 'plan-progress'],
        'readwrite',
      );
      transaction.objectStore('draft').put(active, 'active');
      for (const profile of [active, saved]) {
        const revisionId = `${profile.id}-revision-1`;
        const createdAt = '2026-09-01T10:00:00.000Z';
        transaction.objectStore('builds').put({
          profile,
          kind: 'build',
          headRevisionId: revisionId,
          createdAt,
          updatedAt: createdAt,
        }, profile.id);
        transaction.objectStore('build-revisions').put({
          id: revisionId,
          buildId: profile.id,
          kind: 'build',
          profile,
          createdAt,
        }, `${profile.id}:${revisionId}`);
      }
      transaction.objectStore('plan-progress').put({
        schemaVersion: 1,
        buildId: active.id,
        completedActionIds: ['manual:legacy-proof'],
        dismissedRecommendationIds: [],
      }, active.id);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }), { databaseName });
}

async function readActiveDraftId(page: Page) {
  return page.evaluate(({ databaseName }) => new Promise<string | null>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction('draft', 'readonly').objectStore('draft').get('active');
      get.onerror = () => reject(get.error);
      get.onsuccess = () => {
        resolve((get.result as { id?: string } | undefined)?.id ?? null);
        database.close();
      };
    };
  }), { databaseName });
}

test('tracks a guest route, survives reload, switches builds safely, and resets', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Complete progress journey runs once.');
  await seedProgressBuilds(page);
  await page.goto('/progress');

  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Progress build context' })).toContainText(
    'Progress Proof Active',
  );
  await page.getByLabel('Current Col').fill('10000');
  await page.getByRole('button', { name: 'Save Col balance' }).click();
  await expect(page.getByText(/Affordable now|Need .* more Col/)).toBeVisible();

  await page.getByRole('button', { name: 'Show all tasks' }).click();
  await page.getByLabel('Notes for Unlock Floor 3').fill('Guild clear on Friday');
  await page.getByRole('button', { name: 'Save note for Unlock Floor 3' }).click();
  await page.getByRole('button', { name: 'Complete Unlock Floor 3' }).click();
  await expect(page.getByRole('status')).toContainText('Task completed');

  await page.reload();
  await page.getByRole('button', { name: 'Show journey history' }).click();
  await expect(page.getByText('Unlock Floor 3 completed')).toBeVisible();
  await expect(page.getByText('Guild clear on Friday')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Before progress history' })).toBeVisible();

  await page.getByLabel('View progress for').selectOption('local:progress-proof-saved');
  await expect(page).toHaveURL(/\/progress\?build=progress-proof-saved&source=local$/);
  await expect(page.getByRole('region', { name: 'Progress build context' })).toContainText(
    'Progress Proof Saved',
  );
  expect(await readActiveDraftId(page)).toBe('progress-proof-active');

  await page.getByRole('button', { name: 'Reset progress' }).click();
  const resetDialog = page.getByRole('alertdialog', { name: 'Reset progress?' });
  await expect(resetDialog).toBeVisible();
  await resetDialog.getByRole('button', { name: 'Reset permanently' }).click();
  await expect(page.getByRole('status')).toContainText('Progress reset');
});

test('keeps 250 builds and capped progress recoverable without a framework crash', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Bounded browser stress runs once.');
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await seedProgressBuilds(page);
  await page.evaluate(({ databaseName }) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(
        ['builds', 'build-revisions', 'plan-progress'],
        'readwrite',
      );
      const builds = transaction.objectStore('builds');
      const revisions = transaction.objectStore('build-revisions');
      for (let index = 2; index < 250; index += 1) {
        const id = `progress-stress-${index}`;
        const revisionId = `${id}-revision-1`;
        const profile = {
          schemaVersion: 2,
          id,
          name: `Progress Stress ${index}`,
          level: 8,
          maxFloor: 2,
          weaponPath: 'two-handed',
          goal: 'balanced',
          stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
          equipped: { 'main-hand': 'iron-greatsword', armor: 'fields-warrior' },
          ownedItemIds: [],
          datasetVersion: '2026.08.30.1',
        };
        const createdAt = '2026-09-01T10:00:00.000Z';
        builds.put({ profile, kind: 'build', headRevisionId: revisionId, createdAt, updatedAt: createdAt }, id);
        revisions.put({ id: revisionId, buildId: id, kind: 'build', profile, createdAt }, `${id}:${revisionId}`);
      }
      const occurredAt = '2026-09-01T12:00:00.000Z';
      transaction.objectStore('plan-progress').put({
        schemaVersion: 2,
        buildId: 'progress-proof-active',
        objectives: Array.from({ length: 200 }, (_, index) => ({
          actionKey: `manual:capped:${index}`,
          category: 'manual-objective',
          status: 'pending',
          source: 'manual',
          planFingerprint: 'capped-plan',
          updatedAt: occurredAt,
        })),
        history: Array.from({ length: 1_000 }, (_, index) => ({
          id: `capped-event-${index}`,
          actionKey: `manual:history:${index}`,
          category: 'manual-objective',
          label: `History ${index}`,
          outcome: 'completed',
          source: 'manual',
          planFingerprint: 'capped-plan',
          occurredAt,
        })),
        currentPlanFingerprint: 'capped-plan',
      }, 'progress-proof-active');
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }), { databaseName });

  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'Progress limit reached' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Export build backup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset progress' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
