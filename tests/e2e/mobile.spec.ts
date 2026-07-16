import { expect, test } from './fixtures';

test('mobile workspace remains usable and free of horizontal overflow', async ({ mockedPage: page }) => {
  await expect(page.getByRole('search')).toBeVisible();
  await expect(page.getByRole('complementary')).toBeHidden();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  const sidebar = page.getByRole('complementary');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'Quick tags' })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: 'Filter presets' })).toBeVisible();
  await expect(sidebar.getByRole('heading', { name: /Local favorites/ })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Export' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sidebar).toBeHidden();

  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.getByRole('button', { name: 'Close navigation', exact: true }).last().click();
  await expect(sidebar).toBeHidden();

  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await page.locator('.sidebar-scrim').click({ position: { x: 400, y: 400 } });
  await expect(sidebar).toBeHidden();

  for (const width of [320, 375, 412]) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.getByRole('link', { name: 'Open post details' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByTitle('Close details').click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
