import { expect, test } from '@playwright/test';

test('hides the private curation route from an ordinary signed-in player', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sbo-rebirth-test-authenticated', 'true');
  });
  await page.goto('/curation');

  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Verified data workshop' }),
  ).not.toBeVisible();
});
