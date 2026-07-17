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

test('autocomplete and advanced filters are keyboard friendly and request only applied drafts', async ({
  mockedPage: page,
  apiRequests,
}) => {
  const search = page.getByPlaceholder('Search tags, artists, characters...');
  await search.fill('1g');
  await expect(search).toHaveAttribute('aria-expanded', 'true', { timeout: 10_000 });
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(page.getByTitle('Remove 1girl')).toBeVisible();
  await expect
    .poll(() => apiRequests.some((url) => new URL(url).searchParams.get('tags')?.includes('1girl')))
    .toBe(true);

  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const requestCount = apiRequests.length;
  await page.getByLabel('Minimum score').fill('123');
  await page.waitForTimeout(500);
  expect(apiRequests).toHaveLength(requestCount);
  await page.locator('.brand-mark').click();
  await expect(page.getByLabel('Minimum score')).toBeHidden();
  expect(apiRequests).toHaveLength(requestCount);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Minimum score').fill('123');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect
    .poll(() => apiRequests.some((url) => new URL(url).searchParams.get('tags')?.includes('score:>=123')))
    .toBe(true);
});

test('pagination continues without relying on a remote result count', async ({ mockedPage: page, apiRequests }) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => apiRequests.some((url) => new URL(url).searchParams.get('page') === '2')).toBe(true);
  await expect(page.getByText('42 loaded', { exact: true })).toBeVisible();
});

test('details, local favorites, and download form a complete workflow', async ({ mockedPage: page }) => {
  const trigger = page.getByRole('link', { name: 'Open post details' }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: '#1' })).toBeVisible();
  await expect(dialog.getByTitle('Close details')).toBeFocused();
  await expect(page.locator('.app-background')).toHaveAttribute('inert', '');
  await dialog.evaluate((element) => {
    const focusable = [
      ...element.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    focusable.at(-1)?.focus();
  });
  await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expect(dialog.getByText('sample pool')).toBeVisible();

  await dialog.getByRole('button', { name: 'Save locally' }).click();
  await expect(dialog.getByRole('button', { name: 'Saved locally' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Local favorites/ })).toContainText('1');

  await dialog.getByTitle('Choose download size').click();
  await expect(dialog.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('menu')).toBeHidden();
  await dialog.getByTitle('Choose download size').click();
  const download = page.waitForEvent('download');
  await dialog.getByRole('menuitem', { name: 'Original', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('danbooru-1-sample_artist.png');
  await expect(page.getByText('Download started', { exact: true })).toBeVisible();
  await dialog.getByTitle('Close details').click();
  await expect(trigger).toBeFocused();
});

test('visible count and empty feedback follow preview filtering', async ({ mockedPage: page }) => {
  const search = page.getByPlaceholder('Search tags, artists, characters...');
  await search.fill('unavailable_preview');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('1 loaded', { exact: true })).toBeVisible();
  await page.getByTitle('Hide unavailable previews').click();
  await expect(page.getByText('0 loaded', { exact: true })).toBeVisible();
  await expect(page.getByText('All matching previews are hidden')).toBeVisible();
});

test('reserved gutter absorbs every inline tag action without adding a wrapped row', async ({ mockedPage: page }) => {
  await page.locator('.post-card').first().hover();
  const tooltip = page.locator('.post-tooltip');
  await expect(tooltip).toBeVisible();
  await tooltip.evaluate((element) => {
    element.style.width = '300px';
  });

  const tags = tooltip.locator('.tooltip-tag');
  for (let index = 0; index < (await tags.count()); index += 1) {
    await tooltip.locator('.post-tooltip-header').hover();
    await page.waitForTimeout(350);
    const before = await tags.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      }),
    );
    const tag = tags.nth(index);
    await tag.hover();
    const actions = tag.locator('.tooltip-tag-actions');
    await expect(actions).toBeVisible();
    await page.waitForTimeout(150);
    const actionBox = await actions.boundingBox();
    const tagNameBox = await tag.locator('.tooltip-tag-name').boundingBox();
    expect(actionBox).not.toBeNull();
    expect(tagNameBox).not.toBeNull();
    expect(actionBox!.x).toBeGreaterThanOrEqual(tagNameBox!.x + tagNameBox!.width - 1);
    expect(actionBox!.y).toBeGreaterThanOrEqual(tagNameBox!.y - 2);
    expect(actionBox!.y).toBeLessThan(tagNameBox!.y + tagNameBox!.height + 2);
    const afterRows = await tags.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().y)),
    );
    expect(afterRows).toEqual(before.map((box) => Math.round(box.y)));
  }
});

test('long scrolling keeps media disk and Blob URL usage bounded', async ({
  mockedPage: page,
  apiRequests,
  browserName,
}) => {
  test.setTimeout(90_000);
  test.skip(browserName !== 'chromium', 'Chromium runs the long-lived cache metric check.');
  const search = page.getByPlaceholder('Search tags, artists, characters...');
  await search.fill('cache_stress');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  for (let requestedPage = 2; requestedPage <= 13; requestedPage += 1) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(() => apiRequests.some((url) => new URL(url).searchParams.get('page') === String(requestedPage)))
      .toBe(true);
  }
  await expect
    .poll(() => page.evaluate(() => Number(document.documentElement.dataset.liveObjectUrls ?? 0)))
    .toBeLessThanOrEqual(60);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as Window & { __danbooruImageCacheDiagnostics?: () => { entries: number; bytes: number } }
        ).__danbooruImageCacheDiagnostics?.(),
      ),
    )
    .toMatchObject({ entries: expect.any(Number), bytes: expect.any(Number) });
  const diagnostics = await page.evaluate(() =>
    (window as Window & { __danbooruImageCacheDiagnostics?: () => { entries: number; bytes: number } })
      .__danbooruImageCacheDiagnostics!(),
  );
  expect(diagnostics.entries).toBeGreaterThan(0);
  expect(diagnostics.entries).toBeLessThanOrEqual(500);
  expect(diagnostics.bytes).toBeLessThanOrEqual(96 * 1024 * 1024);
});
