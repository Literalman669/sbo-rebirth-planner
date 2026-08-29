import { expect, test } from '@playwright/test';

test('renders the current release received from SpacetimeDB', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'SBO:Rebirth Build Optimizer' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /^Dataset \S+ · (live|cached|bundled) · verified \d{4}-\d{2}-\d{2}$/,
    ),
  ).toBeVisible();
});
