import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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
