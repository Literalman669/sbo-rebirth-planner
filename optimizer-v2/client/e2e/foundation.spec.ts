import { expect, test } from '@playwright/test';

test('renders the current release received from SpacetimeDB', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'SBO:Rebirth Build Optimizer' }),
  ).toBeVisible();
  await expect(page.getByText('Dataset bootstrap-0 · live')).toBeVisible();
});
