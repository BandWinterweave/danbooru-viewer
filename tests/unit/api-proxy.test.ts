import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyRequest } from '../../src/background/api-proxy';

describe('background API proxy', () => {
  afterEach(() => vi.restoreAllMocks());
  it('rejects requests to hosts outside the allowlist', async () => {
    const response = await proxyRequest({
      type: 'API_REQUEST',
      payload: { url: 'https://example.com/posts.json', method: 'GET' },
    });

    expect(response).toMatchObject({ ok: false, status: 403 });
  });

  it('allows a configured source and forwards authenticated writes', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const response = await proxyRequest({ type: 'API_REQUEST', payload: { url: 'https://danbooru.donmai.us/favorites.json?post_id=7', method: 'POST', headers: { Authorization: 'Basic test' }, body: '{}' } });
    expect(response).toMatchObject({ ok: true, status: 204 });
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'POST', body: '{}', headers: { Authorization: 'Basic test' } }));
  });
});
