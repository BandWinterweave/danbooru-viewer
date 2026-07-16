import { expect, test } from './fixtures';

test('mobile workspace remains usable and free of horizontal overflow', async ({ mockedPage: page }) => {
  await expect(page.getByRole('search')).toBeVisible();
  await expect(page.getByRole('complementary')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole('link', { name: 'Open post details' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByTitle('Close details').click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
