import { expect, test } from '@playwright/test';

for (const directPath of [
  '/auth/callback?code=proof-code&state=proof-state#complete',
  '/shared/proof-share?view=compact',
  '/builds/compare?left=proof-a&right=proof-b',
  '/builds/presets',
  '/progress?build=proof-build&source=local',
  '/updates?build=proof-build&source=local',
]) {
  test(`recovers ${directPath} through the built GitHub Pages artifact`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const directUrl =
      `http://127.0.0.1:4174/sbo-rebirth-planner${directPath}`;
    await page.goto(directUrl);

    await expect(page).toHaveURL(directUrl);
    await expect(
      page.getByRole('link', { name: 'SBO:Rebirth Build Optimizer' }),
    ).toBeVisible();
    if (directPath.startsWith('/auth/callback')) {
      await expect(
        page.getByRole('heading', {
          name: /Completing sign in|Sign-in (?:was not completed|could not be completed)/,
        }),
      ).toBeVisible();
    } else if (directPath.startsWith('/shared/')) {
      await expect(
        page.getByText(
          /Loading shared build|This shared build is unavailable|Read-only shared snapshot/,
        ),
      ).toBeVisible();
    } else if (directPath.startsWith('/builds/compare')) {
      await expect(
        page.getByRole('heading', { name: 'Compare Builds' }),
      ).toBeVisible();
    } else if (directPath.startsWith('/builds/presets')) {
      await expect(
        page.getByRole('heading', { name: 'Build Presets' }),
      ).toBeVisible();
    } else if (directPath.startsWith('/progress')) {
      await expect(
        page.getByRole('heading', { name: 'Progress' }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole('heading', { name: 'Dataset Updates' }),
      ).toBeVisible();
    }
    expect(pageErrors).toEqual([]);
  });
}

test('serves the configured base-aware favicon from the Pages artifact', async ({
  page,
}) => {
  const pageUrl = 'http://127.0.0.1:4174/sbo-rebirth-planner/';
  await page.goto(pageUrl);

  const iconHref = await page.locator('link[rel~="icon"]').getAttribute('href');
  expect(iconHref).toBe('/sbo-rebirth-planner/favicon.svg');
  const response = await page.request.get(new URL(iconHref!, pageUrl).href);
  expect(response.ok()).toBe(true);
});
