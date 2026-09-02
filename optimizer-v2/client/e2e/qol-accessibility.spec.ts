import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { DatasetSnapshot } from '../src/domain/dataset/model';

const accessibilityRelease = JSON.parse(
  readFileSync(
    new URL('../src/data/fallback-release.json', import.meta.url),
    'utf8',
  ),
) as DatasetSnapshot;

async function seedAccessibleDatasetUpdate(page: Page) {
  const pinned = structuredClone(accessibilityRelease);
  pinned.version = '2099.08.29.1';
  pinned.publishedAt = '2099-08-29T12:00:00.000Z';
  pinned.lastReviewedAt = '2099-08-29';
  pinned.catalog = pinned.catalog.map((item) =>
    item.id === 'combat-armor'
      ? {
          ...item,
          acquisitions: item.acquisitions.map((acquisition, index) =>
            index === 0 ? { ...acquisition, cost: 3_100 } : acquisition,
          ),
        }
      : item,
  );
  const profile = {
    schemaVersion: 2,
    id: 'accessible-dataset-update',
    name: 'Accessible update route',
    level: 8,
    maxFloor: 2,
    weaponPath: 'two-handed',
    goal: 'balanced',
    stats: { str: 14, def: 0, agi: 3, vit: 7, luk: 0 },
    equipped: {
      'main-hand': 'iron-greatsword',
      armor: 'beginner-armor',
    },
    ownedItemIds: [],
    datasetVersion: pinned.version,
    accessPreferences: {
      activeEvent: false,
      gamepass: false,
      badge: false,
      limited: false,
    },
  };
  const target = structuredClone(accessibilityRelease);
  target.version = '2099.08.30.1';
  target.publishedAt = '2099-08-30T12:00:00.000Z';
  target.lastReviewedAt = '2099-08-30';
  await page.addInitScript(({ pinned, target, profile }) => {
    const request = indexedDB.open('sbo-rebirth-optimizer-v2', 7);
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
        ['draft', 'dataset-releases', 'dataset-review-receipts'],
        'readwrite',
      );
      transaction.objectStore('draft').put(profile, 'active');
      transaction.objectStore('dataset-releases').put(pinned, pinned.version);
      transaction.objectStore('dataset-releases').put(target, target.version);
      transaction
        .objectStore('dataset-review-receipts')
        .delete(profile.id);
      transaction.oncomplete = () => database.close();
    };
  }, { pinned, target, profile });
}

async function expectAccessibleAndContained(page: Page, route: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
    `${route} should have no serious or critical accessibility violations`,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
    `${route} should not overflow horizontally`,
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
}

test('Release routes remain accessible and contained from desktop to 320px', async ({
  page,
}) => {
  test.setTimeout(120_000);

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expectAccessibleAndContained(page, 'home');

    await page.getByRole('button', { name: 'Create Build' }).click();
    await expect(page).toHaveURL(/\/character$/);
    await expectAccessibleAndContained(page, 'character');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/stats$/);
    await expectAccessibleAndContained(page, 'stats');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/equipment$/);
    await expectAccessibleAndContained(page, 'equipment');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/results$/);
    await expectAccessibleAndContained(page, 'results');

    await page.getByRole('link', { name: 'Builds' }).click();
    await expect(page).toHaveURL(/\/builds$/);
    await expectAccessibleAndContained(page, 'builds');

    await page.getByRole('link', { name: 'Inventory' }).click();
    await expect(page).toHaveURL(/\/inventory$/);
    await expectAccessibleAndContained(page, 'inventory');

    await page.goto('/compare/equipment');
    await expectAccessibleAndContained(page, 'equipment comparison');

    await page.goto('/builds/compare');
    await expectAccessibleAndContained(page, 'build comparison');

    await page.goto('/builds/presets');
    await expectAccessibleAndContained(page, 'build presets');

    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
    await expectAccessibleAndContained(page, 'progress default');
    const showAllTasks = page.getByRole('button', { name: 'Show all tasks' });
    if (await showAllTasks.count()) await showAllTasks.click();
    await page.getByLabel('Current Col').fill('10000');
    await page.getByRole('button', { name: 'Save Col balance' }).click();
    const firstNote = page.locator('.progress-task-note textarea').first();
    await firstNote.fill('Accessibility proof');
    await page.locator('.progress-task-note button').first().click();
    await page.getByRole('button', { name: /^Complete / }).first().click();
    await page.getByRole('button', { name: 'Show journey history' }).click();
    await page.getByLabel('History result').selectOption('completed');
    await page.getByLabel('History category').selectOption('all');
    await expectAccessibleAndContained(page, 'progress expanded');
    const resetProgress = page.getByRole('button', { name: 'Reset progress' });
    await resetProgress.click();
    const resetDialog = page.getByRole('alertdialog', { name: 'Reset progress?' });
    await expect(resetDialog.getByRole('button', { name: 'Cancel reset' })).toBeInViewport();
    await expectAccessibleAndContained(page, 'progress reset confirmation');
    await resetDialog.getByRole('button', { name: 'Cancel reset' }).click();
    await expect(resetProgress).toBeFocused();
  }
});

test('mobile sticky actions and dialogs keep controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Build' }).click();
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await continueButton.focus();
  await expect(continueButton).toBeInViewport();
  await continueButton.click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Change Main-hand weapon' }).click();
  const equipmentDialog = page.getByRole('dialog', { name: 'Choose Main-hand weapon' });
  await expect(equipmentDialog).toBeVisible();
  await expect(equipmentDialog.getByRole('button', { name: 'Close' })).toBeInViewport();
  await expectAccessibleAndContained(page, 'equipment picker');

  await page.goto('/inventory');
  await page.getByRole('button', { name: 'Manage inventory backups' }).click();
  const backupDialog = page.getByRole('dialog', { name: 'Inventory backups' });
  await expect(backupDialog).toBeVisible();
  await expect(backupDialog.getByRole('button', { name: 'Close' })).toBeInViewport();
  await expectAccessibleAndContained(page, 'inventory backup dialog');

  await page.goto('/builds');
  const importTrigger = page.getByRole('button', { name: 'Import builds' });
  await importTrigger.click();
  const importDialog = page.getByRole('dialog', { name: 'Import builds' });
  await expect(importDialog).toBeVisible();
  await expect(importDialog.getByRole('button', { name: 'Close' })).toBeInViewport();
  await expectAccessibleAndContained(page, 'build import dialog');
  await importDialog.getByRole('button', { name: 'Close' }).click();
  await expect(importTrigger).toBeFocused();

  const backupTrigger = page.getByRole('button', { name: 'Back up library' });
  await backupTrigger.click();
  const buildBackupDialog = page.getByRole('dialog', { name: 'Build backups' });
  await expect(buildBackupDialog).toBeVisible();
  await expect(buildBackupDialog.getByRole('button', { name: 'Close' })).toBeInViewport();
  await expectAccessibleAndContained(page, 'build backup dialog');
  await buildBackupDialog.getByRole('button', { name: 'Close' }).click();
  await expect(backupTrigger).toBeFocused();
});

test('dataset update reports and confirmation remain accessible at four viewports', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The explicit viewport matrix runs once.');
  test.setTimeout(120_000);
  await seedAccessibleDatasetUpdate(page);

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/updates');
    await expect(
      page.getByRole('heading', { name: 'Verified facts changed' }),
    ).toBeVisible();
    await expectAccessibleAndContained(page, `dataset updates ${viewport.width}`);

    await page.getByRole('button', { name: 'Open current preview' }).click();
    await expect(
      page.getByRole('heading', { name: 'Current planner preview' }),
    ).toBeVisible();
    await expectAccessibleAndContained(page, `dataset preview ${viewport.width}`);

    const firstRelease = page.locator('.dataset-release-trail summary').first();
    await firstRelease.click();
    await expect(firstRelease.locator('..')).toHaveAttribute('open', '');
    await expectAccessibleAndContained(page, `dataset release trail ${viewport.width}`);

    const trigger = page.getByRole('button', { name: 'Update this build' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Update Accessible update route' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Confirm dataset update' }),
    ).toBeFocused();
    await expectAccessibleAndContained(page, `dataset update dialog ${viewport.width}`);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});
