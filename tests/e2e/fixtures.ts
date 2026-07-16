import { expect, test as base, type Page } from '@playwright/test';

const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function post(id: number) {
  return {
    id,
    rating: 'g',
    tag_string: 'sample_artist sample_character sample_series 1girl blue_sky highres',
    tag_string_general: '1girl blue_sky',
    tag_string_artist: 'sample_artist',
    tag_string_copyright: 'sample_series',
    tag_string_character: 'sample_character',
    tag_string_meta: 'highres',
    score: 100 + id,
    up_score: 110,
    down_score: -2,
    fav_count: 24,
    uploader_name: 'e2e_user',
    uploader_id: 7,
    source: 'https://example.com/source',
    image_width: 1200,
    image_height: 1600,
    file_size: 2048,
    file_ext: 'png',
    preview_file_url: `https://cdn.example/${id}-preview.png`,
    large_file_url: `https://cdn.example/${id}-large.png`,
    file_url: `https://cdn.example/${id}.png`,
    md5: `mock-${id}`,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    parent_id: null,
    has_children: false,
    pool_ids: id === 1 ? [7] : [],
  };
}

type Fixtures = { apiRequests: string[]; mockedPage: Page };

export const test = base.extend<Fixtures>({
  // Playwright requires the fixture dependency object even for an isolated value.
  // eslint-disable-next-line no-empty-pattern
  apiRequests: async ({}, use) => use([]),
  mockedPage: async ({ page, apiRequests }, use) => {
    await page.addInitScript(() => {
      localStorage.clear();
      window.addEventListener('unhandledrejection', (event) => {
        document.documentElement.dataset.unhandledRejection = String(event.reason);
      });
    });
    await page.route('**/__image?**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: image }));
    await page.route('**/__api/danbooru/**', (route) => {
      const url = new URL(route.request().url());
      apiRequests.push(url.toString());
      if (url.pathname.endsWith('/posts.json')) {
        const pageNumber = Number(url.searchParams.get('page') ?? '1');
        const items =
          pageNumber === 1
            ? Array.from({ length: 40 }, (_, index) => post(index + 1))
            : pageNumber === 2
              ? [post(41), post(42)]
              : [];
        return route.fulfill({ json: items });
      }
      if (url.pathname.endsWith('/autocomplete.json')) {
        return route.fulfill({ json: [{ value: '1girl', label: '1girl', category: 0, post_count: 1_000_000 }] });
      }
      if (url.pathname.endsWith('/comments.json')) return route.fulfill({ json: [] });
      if (url.pathname.endsWith('/related_tag.json'))
        return route.fulfill({ json: { related_tags: [['blue_sky', 0]] } });
      if (url.pathname.endsWith('/pools.json'))
        return route.fulfill({ json: [{ id: 7, name: 'sample_pool', post_count: 3 }] });
      return route.fulfill({ json: {} });
    });
    await page.goto('/src/newtab/index.html');
    await expect(page.getByRole('link', { name: 'Open post details' }).first()).toBeVisible();
    await use(page);
    expect(await page.locator('html').getAttribute('data-unhandled-rejection')).toBeNull();
  },
});

export { expect } from '@playwright/test';
