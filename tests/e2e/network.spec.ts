import { expect, test } from '@playwright/test';

test('Danbooru public API smoke', async ({ request }) => {
  test.skip(!process.env.RUN_NETWORK_SMOKE, 'Set RUN_NETWORK_SMOKE=1 to run the non-blocking network smoke test.');
  const response = await request.get('https://danbooru.donmai.us/posts.json?limit=1&tags=rating:g');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual(expect.any(Array));
});
