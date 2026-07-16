import { expect, test } from './fixtures';

test('new installs request General posts and search with controlled data', async ({
  mockedPage: page,
  apiRequests,
}) => {
  await expect
    .poll(() => apiRequests.some((url) => new URL(url).searchParams.get('tags')?.includes('rating:g')))
    .toBe(true);

  const search = page.getByPlaceholder('Search tags, artists, characters...');
  await search.fill('1girl');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  await expect(page.getByTitle('Remove 1girl')).toBeVisible();
  await expect
    .poll(() => apiRequests.some((url) => new URL(url).searchParams.get('tags')?.includes('1girl')))
    .toBe(true);
});

test('pagination continues without relying on a remote result count', async ({ mockedPage: page, apiRequests }) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => apiRequests.some((url) => new URL(url).searchParams.get('page') === '2')).toBe(true);
  await expect(page.getByText('42 loaded', { exact: true })).toBeVisible();
});

test('details, local favorites, and download form a complete workflow', async ({ mockedPage: page }) => {
  await page.getByRole('link', { name: 'Open post details' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: '#1' })).toBeVisible();
  await expect(dialog.getByText('sample pool')).toBeVisible();

  await dialog.getByRole('button', { name: 'Save locally' }).click();
  await expect(dialog.getByRole('button', { name: 'Saved locally' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Local favorites/ })).toContainText('1');

  await dialog.getByTitle('Choose download size').click();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Original', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('danbooru-1-sample_artist.png');
  await expect(page.getByText('Download started', { exact: true })).toBeVisible();
});
