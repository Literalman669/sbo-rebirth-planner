import { expect, test, type Page } from '@playwright/test';

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

  await page.getByLabel('STR').fill('14');
  await page.getByLabel('DEF').fill('0');
  await page.getByLabel('AGI').fill('3');
  await page.getByLabel('VIT').fill('7');
  await page.getByLabel('LUK').fill('0');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Main-hand weapon').selectOption('iron-greatsword');
  await page.getByLabel('Armor', { exact: true }).selectOption('beginner-armor');
  await page.getByText('Owned items').click();
  await page.getByRole('checkbox', { name: 'Steel Greatsword' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(
    page.getByRole('heading', { name: 'Your next ten levels, made clear.' }),
  ).toBeVisible();
  await expect(page.getByText('Equip Steel Greatsword now')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Do now' })).toBeVisible();
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
    page.getByRole('heading', { name: 'Tell us where your adventurer stands.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Current Level')).toHaveValue('8');
});
