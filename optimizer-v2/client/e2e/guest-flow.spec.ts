import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function readSavedDraftLevel(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number | null>((resolve, reject) => {
        const request = indexedDB.open('sbo-rebirth-optimizer-v2');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('draft', 'readonly');
          const getRequest = transaction.objectStore('draft').get('active');
          getRequest.onerror = () => reject(getRequest.error);
          getRequest.onsuccess = () => {
            resolve((getRequest.result as { level?: number } | undefined)?.level ?? null);
            database.close();
          };
        };
      }),
  );
}

test('completes and resumes the focused guest optimizer flow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Build' }).click();

  await expect(
    page.getByRole('heading', { name: 'Tell us where your adventurer stands.' }),
  ).toBeVisible();
  await page.getByLabel('Current Level').fill('8');
  await page.getByLabel('Highest Unlocked Floor').fill('2');
  await page.getByRole('radio', { name: 'Two-Handed' }).check();
  await page.getByText('Improve accuracy').click();
  await page.getByLabel('Weapon Skill').fill('5');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('spinbutton', { name: 'STR', exact: true }).fill('14');
  await page.getByRole('spinbutton', { name: 'DEF', exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: 'AGI', exact: true }).fill('3');
  await page.getByRole('spinbutton', { name: 'VIT', exact: true }).fill('7');
  await page.getByRole('spinbutton', { name: 'LUK', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Change Main-hand weapon' }).click();
  await page.getByRole('searchbox', { name: 'Search Main-hand weapon' }).fill('Steel Greatsword');
  await page.getByRole('button', { name: 'Inspect Steel Greatsword' }).click();
  await page.getByRole('button', { name: 'Mark Owned' }).click();
  await page.getByRole('button', { name: 'Close Main-hand weapon picker' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(
    page.getByRole('heading', { name: 'Your next ten levels, made clear.' }),
  ).toBeVisible();
  await expect(page.getByText('Equip Steel Greatsword now')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Do now', level: 3 })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Next ten levels', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next upgrades' })).toBeVisible();
  await expect(page.getByText('Why this plan')).toBeVisible();

  await expect.poll(() => readSavedDraftLevel(page)).toBe(8);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Your next ten levels, made clear.' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'SBO:Rebirth Build Optimizer' }).click();
  await page.getByRole('button', { name: 'Resume Build' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your next ten levels, made clear.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Edit Character' }).click();
  await expect(page.getByLabel('Current Level')).toHaveValue('8');
});

test('covers quick stats, rich equipment, actionable results, save modes, and build management', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Build' }).click();
  await page.getByLabel('Build Name').fill('QOL Route');
  await page.getByText('Improve accuracy').click();
  await page.getByLabel('Weapon Skill').fill('5');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Add 1 STR' }).click();
  await page.getByRole('button', { name: 'Lock STR' }).click();
  await page.getByRole('button', { name: 'Apply recommended current points' }).click();
  await expect(page.getByText('3 / 3 points spent')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Change Main-hand weapon' }).click();
  await page.getByRole('searchbox', { name: 'Search Main-hand weapon' }).fill('Steel Greatsword');
  await page.getByRole('button', { name: 'Inspect Steel Greatsword' }).click();
  const details = page.getByLabel('Steel Greatsword details');
  await expect(details).toContainText('ATK +7');
  await expect(details).toContainText('Equip now');
  await details.getByRole('button', { name: 'Equip Steel Greatsword' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Action checklist' })).toBeVisible();
  const firstAction = page.locator('.action-checklist li').first();
  await firstAction.getByRole('checkbox').check();
  const dismissButtons = page.getByRole('button', { name: 'Dismiss' });
  if (await dismissButtons.count()) {
    await expect(page.getByText(/^\d[\d,]* Col verified$/)).toBeVisible();
    const dismissible = page.locator('.action-checklist li:has(button:text("Dismiss"))').first();
    const dismissedTitle = (await dismissible.locator('strong').first().textContent())?.trim();
    await dismissible.getByRole('button', { name: 'Dismiss' }).click();
    if (dismissedTitle) await expect(page.getByText(dismissedTitle, { exact: true })).toHaveCount(0);
  } else {
    await expect(page.getByText('No verified upgrade is available in your current progression range.')).toBeVisible();
  }

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await readFile(path!, 'utf8')) as { fingerprint?: string };
  expect(exported.fingerprint).toMatch(/^plan-[a-f0-9]{8}$/);

  const saveTrigger = page.getByRole('button', { name: 'Save Build' });
  await saveTrigger.click();
  await page.getByRole('dialog', { name: 'Save Build' }).getByRole('button', { name: 'Cancel' }).click();
  await expect(saveTrigger).toBeFocused();
  await saveTrigger.click();
  await page.getByLabel('Build Name').fill('QOL Route');
  await page.getByRole('dialog', { name: 'Save Build' }).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Build saved locally')).toBeVisible();
  await saveTrigger.click();
  const duplicateDialog = page.getByRole('dialog', { name: 'Save Build' });
  await duplicateDialog.getByRole('radio', { name: 'Save as duplicate' }).check();
  await duplicateDialog.getByLabel('Build Name').fill('QOL Route copy');
  await duplicateDialog.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Open Builds' }).click();
  await page.getByRole('searchbox', { name: 'Search builds' }).fill('QOL');
  await expect(page.getByText('QOL Route', { exact: true })).toBeVisible();
  await expect(page.getByText('QOL Route copy', { exact: true })).toBeVisible();
  await page.getByLabel('Sort builds').selectOption('name');
  await page.getByRole('searchbox', { name: 'Search builds' }).clear();
  await page.getByRole('button', { name: 'Rename QOL Route', exact: true }).click();
  await page.getByRole('textbox', { name: 'Rename QOL Route', exact: true }).fill('Vanguard Route');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByText('Vanguard Route')).toBeVisible();
  await page.getByRole('button', { name: 'Archive Vanguard Route' }).click();
  await expect(page.getByText('Vanguard Route')).toHaveCount(0);
  await page.getByLabel('Build status').selectOption('archived');
  await expect(page.getByText('Vanguard Route')).toBeVisible();
  await page.getByRole('button', { name: 'Delete Vanguard Route' }).click();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Vanguard Route')).toBeVisible();
});
