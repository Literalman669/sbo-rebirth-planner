import { expect, test, type Page } from '@playwright/test';

async function createVerifiedBuild(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Build' }).click();
  await page.getByLabel('Current Level').fill('8');
  await page.getByLabel('Highest Unlocked Floor').fill('2');
  await page.getByRole('radio', { name: 'Two-Handed' }).check();
  await page.getByText('Improve accuracy', { exact: true }).click();
  await page.getByLabel('Weapon Skill').fill('5');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('spinbutton', { name: 'STR', exact: true }).fill('14');
  await page.getByRole('spinbutton', { name: 'DEF', exact: true }).fill('0');
  await page.getByRole('spinbutton', { name: 'AGI', exact: true }).fill('3');
  await page.getByRole('spinbutton', { name: 'VIT', exact: true }).fill('7');
  await page.getByRole('spinbutton', { name: 'LUK', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/results$/);
}

async function selectInventoryItem(page: Page, name: string) {
  const search = page.getByRole('searchbox', {
    name: 'Search verified equipment',
  });
  await search.fill(name);
  await page.getByRole('button', { name: `Inspect ${name}` }).click();
  return page.getByRole('complementary', {
    name: `${name} inventory details`,
  });
}

test('inventory actions persist while UI-only state keeps the plan fingerprint stable', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Inventory lifecycle runs once.');
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });

  await createVerifiedBuild(page);
  const results = page.locator('.results-screen');
  const fingerprint = await results.getAttribute('data-plan-fingerprint');
  expect(fingerprint).toMatch(/^plan-[a-f0-9]{8}$/);

  await page.getByRole('link', { name: 'Inventory' }).click();
  let details = await selectInventoryItem(page, 'Steel Greatsword');
  await details.getByRole('button', { name: 'Favorite Steel Greatsword' }).click();
  await details
    .getByRole('button', { name: 'Add Steel Greatsword to comparison' })
    .click();
  const note = details.getByRole('textbox', {
    name: 'Personal note for Steel Greatsword',
  });
  await note.fill('Next weapon target');
  await note.blur();

  details = await selectInventoryItem(page, 'Iron Greatsword');
  await details
    .getByRole('button', { name: 'Add Iron Greatsword to comparison' })
    .click();
  let inventorySummary = page.getByRole('region', {
    name: 'Inventory summary',
  });
  await expect(inventorySummary).toContainText('saving');
  await expect(inventorySummary.getByText('saved-local')).toBeVisible();

  await page.goto('/results');
  await expect(results).toHaveAttribute('data-plan-fingerprint', fingerprint!);

  await page.getByRole('link', { name: 'Inventory' }).click();
  details = await selectInventoryItem(page, 'Steel Greatsword');
  await details
    .getByRole('button', { name: 'Mark Steel Greatsword owned' })
    .click();
  inventorySummary = page.getByRole('region', {
    name: 'Inventory summary',
  });
  await expect(inventorySummary).toContainText('saving');
  await details.getByRole('button', { name: 'Equip Steel Greatsword' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'equipped' }),
  ).toBeVisible();
  await expect(
    inventorySummary.getByText('saved-local'),
  ).toBeVisible();

  await page.reload();
  details = await selectInventoryItem(page, 'Steel Greatsword');
  await expect(
    details.getByRole('button', { name: 'Remove Steel Greatsword from owned' }),
  ).toBeVisible();
  await expect(
    details.getByRole('button', { name: 'Unfavorite Steel Greatsword' }),
  ).toBeVisible();
  await expect(
    details.getByRole('button', {
      name: 'Remove Steel Greatsword from comparison',
    }),
  ).toBeVisible();
  await expect(
    details.getByRole('textbox', {
      name: 'Personal note for Steel Greatsword',
    }),
  ).toHaveValue('Next weapon target');

  await page.getByRole('link', { name: 'Compare selected equipment' }).click();
  await expect(page).toHaveURL(/\/compare\/equipment$/);
  await expect(
    page.getByRole('columnheader', { name: 'Steel Greatsword' }),
  ).toBeVisible();
  expect(failures).toEqual([]);
});
