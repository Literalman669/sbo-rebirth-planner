import { expect, test, type Browser, type Page } from '@playwright/test';

async function createGuestBuild(page: Page, name: string, level: number) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Build' }).click();
  await page.getByLabel('Current Level').fill(String(level));
  await page.getByLabel('Highest Unlocked Floor').fill('2');
  await page.getByRole('radio', { name: 'Two-Handed' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('STR').fill('14');
  await page.getByLabel('DEF').fill('0');
  await page.getByLabel('AGI').fill('3');
  await page.getByLabel('VIT').fill('7');
  await page.getByLabel('LUK').fill('0');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Main-hand weapon').selectOption('iron-greatsword');
  await page.getByLabel('Armor', { exact: true }).selectOption('beginner-armor');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Save Build' }).click();
  await page.getByLabel('Build Name').fill(name);
  await page
    .locator('form.save-build-form')
    .getByRole('button', { name: 'Save Build' })
    .click();
  await expect(page.getByText('Build saved locally')).toBeVisible();
}

async function pendingRevisionCount(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('sbo-rebirth-optimizer-v2');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            'pending-revisions',
            'readonly',
          );
          const count = transaction.objectStore('pending-revisions').count();
          count.onerror = () => reject(count.error);
          count.onsuccess = () => {
            resolve(count.result);
            database.close();
          };
        };
      }),
  );
}

async function newSignedInPage(browser: Browser) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.localStorage.setItem('sbo-rebirth-test-authenticated', 'true');
  });
  const page = await context.newPage();
  return { context, page };
}

test('imports selectively, syncs offline history, restores, shares, and revokes', async ({
  browser,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Cloud browser flow runs once.');
  test.setTimeout(90_000);

  await createGuestBuild(page, 'Selected Route', 8);
  await createGuestBuild(page, 'Keep Local', 9);
  await page.getByRole('link', { name: 'SBO:Rebirth Build Optimizer' }).click();
  await expect(page.getByText('Selected Route')).toBeVisible();
  await expect(page.getByText('Keep Local')).toBeVisible();

  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.reload();
  await expect(page.getByText('Local Test Player')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Bring local builds into your archive?',
    }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Keep Local' }).uncheck();
  await page.getByRole('button', { name: 'Import selected' }).click();

  const archive = page.getByRole('region', { name: 'Cloud Archive' });
  await expect(archive).toBeVisible();
  await expect(archive.getByText('Selected Route')).toBeVisible();
  await expect(archive.getByText('Keep Local')).toHaveCount(0);

  const sessionB = await newSignedInPage(browser);
  await sessionB.page.goto('/');
  const archiveB = sessionB.page.getByRole('region', { name: 'Cloud Archive' });
  await expect(archiveB.getByText('Selected Route')).toBeVisible();

  await archive.getByRole('button', { name: 'Load Selected Route' }).click();
  await page.getByRole('link', { name: 'Edit Character' }).click();
  await page.getByLabel('Current Level').fill('21');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForTimeout(900);
  await expect(archiveB.getByText(/Level 21 ·/)).toBeVisible();

  await page.context().setOffline(true);
  await page.getByRole('link', { name: 'Edit Character' }).click();
  await page.getByLabel('Current Level').fill('22');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect.poll(() => pendingRevisionCount(page)).toBeGreaterThan(0);

  await page.context().setOffline(false);
  await expect.poll(() => pendingRevisionCount(page)).toBe(0);
  await expect(archiveB.getByText(/Level 22 ·/)).toBeVisible();

  await page.getByRole('link', { name: 'SBO:Rebirth Build Optimizer' }).click();
  await page.getByRole('button', { name: 'History for Selected Route' }).click();
  const restorable = page.locator(
    'button[aria-label^="Restore revision"]:not([disabled])',
  );
  await expect(restorable.first()).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await restorable.first().click();
  await expect(
    page.getByRole('heading', { name: 'Your next ten levels, made clear.' }),
  ).toBeVisible();

  await expect(page.getByRole('button', { name: 'Share Build' })).toBeVisible();
  await page.getByRole('button', { name: 'Share Build' }).click();
  const sharedLink = page.getByRole('link', {
    name: 'Open read-only shared build',
  });
  await expect(sharedLink).toBeVisible();
  const sharedUrl = await sharedLink.getAttribute('href');
  if (!sharedUrl) throw new Error('Shared URL was not rendered');

  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(sharedUrl);
  await expect(anonymousPage.getByText('Read-only shared snapshot')).toBeVisible();

  await page.getByRole('button', { name: 'Revoke shared link' }).click();
  await expect(page.getByText('Shared link revoked')).toBeVisible();
  await anonymousPage.reload();
  await expect(
    anonymousPage.getByRole('heading', {
      name: 'This shared build is unavailable.',
    }),
  ).toBeVisible();

  await anonymousContext.close();
  await sessionB.context.close();
});
