import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const runtimeFailures = new WeakMap<Page, string[]>();

test.use({ storageState: { cookies: [], origins: [] } });

function collectRuntimeFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  runtimeFailures.set(page, failures);
  return failures;
}

async function expectRuntimeHealth(failures: readonly string[]) {
  expect(failures, `runtime failures:\n${failures.join('\n')}`).toEqual([]);
}

async function expectActiveStep(page: Page, label: string) {
  const active = page.locator('.progress-steps a[aria-current="step"]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveText(label);
}

async function completeCharacter(page: Page) {
  await page.getByLabel('Current Level').fill('8');
  await page.getByLabel('Highest Unlocked Floor').fill('2');
  await page.getByRole('radio', { name: 'Two-Handed' }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expectActiveStep(page, 'Stats');
}

async function completeStats(page: Page) {
  await page.getByLabel('STR').fill('14');
  await page.getByLabel('DEF').fill('0');
  await page.getByLabel('AGI').fill('3');
  await page.getByLabel('VIT').fill('7');
  await page.getByLabel('LUK').fill('0');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/equipment$/);
  await expectActiveStep(page, 'Equipment');
}

async function completeEquipment(page: Page) {
  await page.getByLabel('Main-hand weapon').selectOption('iron-greatsword');
  await page.getByLabel('Armor', { exact: true }).selectOption('beginner-armor');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expectActiveStep(page, 'Results');
  await expect(
    page.getByRole('heading', { name: 'Your next ten levels, made clear.' }),
  ).toHaveCount(1);
  await expect(page.locator('section[aria-labelledby="do-now-heading"]')).toHaveCount(1);
  await expect(page.locator('section[aria-labelledby="next-levels-heading"]')).toHaveCount(1);
  await expect(page.locator('section[aria-labelledby="next-upgrades-heading"]')).toHaveCount(1);
}

async function completeRemainingSteps(page: Page, startingAt: 'character' | 'stats' | 'equipment') {
  if (startingAt === 'character') await completeCharacter(page);
  if (startingAt === 'character' || startingAt === 'stats') await completeStats(page);
  await completeEquipment(page);
}

async function tabTo(page: Page, target: Locator) {
  for (let index = 0; index < 32; index += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('The required control was not reachable with Tab.');
}

async function assertPrimaryPanelFits(page: Page) {
  const panel = page.locator('.planner-frame');
  await expect(panel).toBeVisible();
  const panelBox = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(panelBox, 'primary panel bounding box').not.toBeNull();
  expect(viewport, 'configured viewport').not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(viewport!.width);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function assertNoFrameworkOverlay(page: Page) {
  await expect(page.locator('vite-error-overlay, [data-reactroot] vite-error-overlay')).toHaveCount(0);
  await expect(page.getByText(/Internal Server Error|Failed to compile/i)).toHaveCount(0);
}

test.afterEach(async ({ page }, testInfo) => {
  const failures = runtimeFailures.get(page) ?? [];
  if (testInfo.status === testInfo.expectedStatus) return;

  const domPath = testInfo.outputPath('rendered-dom.html');
  const consolePath = testInfo.outputPath('runtime-failures.txt');
  const screenshotPath = testInfo.outputPath('rendered-page.png');
  await writeFile(domPath, await page.content());
  await writeFile(consolePath, failures.join('\n'));
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('rendered-dom', { path: domPath, contentType: 'text/html' });
  await testInfo.attach('runtime-failures', { path: consolePath, contentType: 'text/plain' });
  await testInfo.attach('rendered-page', { path: screenshotPath, contentType: 'image/png' });
});

test('survives exactly twenty routed planner cycles without duplicate results or runtime failures', async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Build' }).click();
  await expectActiveStep(page, 'Character');
  await completeRemainingSteps(page, 'character');

  for (let cycle = 2; cycle <= 20; cycle += 1) {
    const edit = [
      { link: 'Edit Character', step: 'character' as const, label: 'Character' },
      { link: 'Edit Stats', step: 'stats' as const, label: 'Stats' },
      { link: 'Edit Equipment', step: 'equipment' as const, label: 'Equipment' },
    ][(cycle - 2) % 3]!;
    await page.getByRole('link', { name: edit.link }).click();
    await expect(page).toHaveURL(new RegExp(`/${edit.step}$`));
    await expectActiveStep(page, edit.label);
    if (edit.step === 'character') {
      await expect(page.getByLabel('Current Level')).toHaveValue('8');
      await expect(page.getByLabel('Highest Unlocked Floor')).toHaveValue('2');
    }
    if (edit.step === 'stats') {
      await expect(page.getByLabel('STR')).toHaveValue('14');
      await expect(page.getByLabel('AGI')).toHaveValue('3');
    }
    if (edit.step === 'equipment') {
      await expect(page.getByLabel('Main-hand weapon')).toHaveValue('iron-greatsword');
      await expect(page.getByLabel('Armor', { exact: true })).toHaveValue('beginner-armor');
    }
    await completeRemainingSteps(page, edit.step);
  }
  await expectRuntimeHealth(failures);
});

test('keeps invalid keyboard-only continuation on the route and focuses the first invalid control', async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  await page.goto('/equipment');
  await expect(page).toHaveURL(/\/equipment$/);

  const mainHand = page.getByLabel('Main-hand weapon');
  const continueEquipment = page.getByRole('button', { name: 'Continue' });
  await tabTo(page, continueEquipment);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/equipment$/);
  await expect(mainHand).toBeFocused();
  await expect(mainHand).toHaveAttribute('aria-invalid', 'true');

  await page.keyboard.press('ArrowDown');
  await tabTo(page, continueEquipment);
  await page.keyboard.press('Enter');
  const armor = page.getByLabel('Armor', { exact: true });
  await expect(page).toHaveURL(/\/equipment$/);
  await expect(armor).toBeFocused();
  await expect(armor).toHaveAttribute('aria-invalid', 'true');

  await page.keyboard.press('ArrowDown');
  await tabTo(page, continueEquipment);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/results$/);
  await expectRuntimeHealth(failures);
});

test('keeps required planner actions visible and avoids horizontal overflow', async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create Build' }).click();
  await assertPrimaryPanelFits(page);
  await page.getByRole('button', { name: 'Continue' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeInViewport();

  await completeCharacter(page);
  await assertPrimaryPanelFits(page);
  await page.getByRole('button', { name: 'Continue' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeInViewport();

  await completeStats(page);
  await assertPrimaryPanelFits(page);
  await page.getByRole('button', { name: 'Continue' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeInViewport();

  await completeEquipment(page);
  await assertPrimaryPanelFits(page);
  for (const label of ['Edit Character', 'Edit Stats', 'Edit Equipment']) {
    await page.getByRole('link', { name: label }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('link', { name: label })).toBeInViewport();
  }
  await expectRuntimeHealth(failures);
});

test('reloads direct routes with expected screens or guards and no framework overlay', async ({ page }) => {
  const failures = collectRuntimeFailures(page);
  const routes: Array<{ path: string; screen: RegExp; guard?: RegExp }> = [
    { path: '/character', screen: /Tell us where your adventurer stands\./ },
    { path: '/stats', screen: /^Stats$/ },
    { path: '/equipment', screen: /^Equipment$/ },
    { path: '/results', screen: /^Equipment$/, guard: /\/equipment$/ },
    { path: '/auth/callback', screen: /Sign-in was not completed|Completing sign in/ },
    { path: '/shared/missing', screen: /Loading shared build|This shared build is unavailable/ },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await page.reload();
    const screen = route.path.startsWith('/shared/')
      ? page.getByText(route.screen)
      : page.getByRole('heading', { name: route.screen });
    await expect(screen).toBeVisible();
    if (route.guard) await expect(page).toHaveURL(route.guard);
    await assertNoFrameworkOverlay(page);
  }
  await expectRuntimeHealth(failures);
});
