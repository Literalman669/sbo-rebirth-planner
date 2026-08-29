import { expect, test } from '@playwright/test';

const weaponPaths = [
  'Two-Handed',
  'One-Handed',
  'Rapier',
  'Dagger',
  'Dual Wield',
  'Melee',
];

test('keeps the four-step optimizer routed and the beginner inputs focused', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Build' }).click();
  await expect(page).toHaveURL(/\/character$/);
  await expect(
    page.getByRole('heading', { name: 'Tell us where your adventurer stands.' }),
  ).toBeVisible();

  await expect(page.getByLabel('Current Level')).toBeVisible();
  await expect(page.getByLabel('Highest Unlocked Floor')).toBeVisible();
  for (const path of weaponPaths) {
    await expect(page.getByRole('radio', { name: path })).toBeVisible();
  }
  const goal = page.getByLabel('Optimization Goal');
  await expect(goal).toHaveValue('balanced');
  for (const value of [
    'balanced',
    'damage',
    'survivability',
    'mobility',
    'farming',
  ]) {
    await goal.selectOption(value);
    await expect(goal).toHaveValue(value);
  }
  await expect(page.getByLabel('Weapon Skill')).not.toBeVisible();
  await page.getByText('Improve accuracy').click();
  await expect(page.getByLabel('Weapon Skill')).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/equipment$/);
  await expect(page.getByRole('heading', { name: 'Equipment' })).toBeVisible();
  await page.getByLabel('Main-hand weapon').selectOption('iron-greatsword');
  await page.getByLabel('Armor', { exact: true }).selectOption('beginner-armor');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(
    page.getByRole('heading', { name: 'Your next ten levels, made clear.' }),
  ).toBeVisible();
});

test('supports keyboard focus and reduced-motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const focusedLabels: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    focusedLabels.push(
      await focused.evaluate((element) =>
        (element.getAttribute('aria-label') ?? element.textContent ?? '').trim(),
      ),
    );
    if (focusedLabels.at(-1) === 'Create Build') break;
  }
  expect(new Set(focusedLabels).size).toBeGreaterThanOrEqual(3);
  expect(focusedLabels).toContain('Create Build');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/character$/);

  const transitionSeconds = await page.locator('body').evaluate((element) => {
    const duration = getComputedStyle(element).transitionDuration;
    return Number.parseFloat(duration) || 0;
  });
  expect(transitionSeconds).toBeLessThanOrEqual(0.001);
});
