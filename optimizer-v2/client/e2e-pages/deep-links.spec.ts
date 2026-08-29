import { expect, test } from '@playwright/test';

for (const directPath of [
  '/auth/callback?code=proof-code&state=proof-state#complete',
  '/shared/proof-share?view=compact',
]) {
  test(`recovers ${directPath} through the built GitHub Pages artifact`, async ({
    page,
  }) => {
    await page.route('**/assets/*.js', (route) => route.abort());
    const directUrl =
      `http://127.0.0.1:4174/sbo-rebirth-planner${directPath}`;
    await page.goto(directUrl);

    await expect(page).toHaveURL(directUrl);
    await expect(page.locator('#root')).toHaveCount(1);
  });
}
