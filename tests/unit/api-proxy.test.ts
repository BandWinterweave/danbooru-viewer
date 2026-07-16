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

  it('normalizes an empty JSON response to an empty collection', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const response = await proxyRequest({ type: 'API_REQUEST', payload: { url: 'https://safebooru.org/index.php?page=dapi&json=1', method: 'GET' } });
    expect(response).toMatchObject({ ok: true, status: 200, data: [] });
  });

  it('deduplicates identical GET requests while the first is pending', async () => {
    let resolveFetch!: (response: Response) => void;
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    const request = { type: 'API_REQUEST' as const, payload: { url: 'https://yande.re/post.json?tags=dedupe-check', method: 'GET' as const } };
    const first = proxyRequest(request);
    const second = proxyRequest(request);
    expect(fetch).toHaveBeenCalledTimes(1);
    resolveFetch(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ ok: true, data: [] }),
      expect.objectContaining({ ok: true, data: [] }),
    ]);
  });

  it('uses Danbooru verification cookies and replaces Cloudflare HTML with guidance', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<!DOCTYPE html><title>Just a moment...</title><script src="https://challenges.cloudflare.com/check"></script>', { status: 403, headers: { 'Content-Type': 'text/html' } }));
    const response = await proxyRequest({ type: 'API_REQUEST', payload: { url: 'https://danbooru.donmai.us/posts.json?tags=cloudflare-check', method: 'GET' } });
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ credentials: 'include' }));
    expect(response).toMatchObject({ ok: false, status: 403 });
    expect(response.error).toContain('reload this extension');
    expect(response.error).not.toContain('<!DOCTYPE html>');
  });
});
