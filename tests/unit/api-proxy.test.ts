import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiCacheDiagnostics, cancelProxyRequest, proxyRequest } from '../../src/background/api-proxy';

describe('background API proxy', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  it('rejects requests to hosts outside the allowlist', async () => {
    const response = await proxyRequest({
      type: 'API_REQUEST',
      payload: { url: 'https://example.com/posts.json', method: 'GET' },
    });

    expect(response).toMatchObject({ ok: false, status: 403 });
  });

  it('allows a configured source and forwards authenticated writes', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const response = await proxyRequest({ type: 'API_REQUEST', payload: { url: 'https://danbooru.donmai.us/favorites.json?post_id=7', method: 'POST', headers: { Authorization: 'Basic test', 'Content-Type': 'application/json' }, body: '{}' } });
    expect(response).toMatchObject({ ok: true, status: 204 });
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ method: 'POST', body: '{}', headers: { Authorization: 'Basic test', 'Content-Type': 'application/json' }, signal: expect.any(AbortSignal) }));
  });

  it.each([
    [{ type: 'API_REQUEST' }, 400],
    [{ type: 'API_REQUEST', payload: { url: 'https://safebooru.org/', method: 'POST' } }, 405],
    [{ type: 'API_REQUEST', payload: { url: 'https://yande.re/', headers: { Cookie: 'secret' } } }, 400],
    [{ type: 'API_REQUEST', payload: { url: 'https://yande.re/', method: 'GET', body: '{}' } }, 400],
  ])('rejects malformed request payloads', async (message, status) => {
    await expect(proxyRequest(message)).resolves.toMatchObject({ ok: false, status });
  });

  it('times out stalled requests with a structured response', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const request = proxyRequest({ type: 'API_REQUEST', payload: { url: 'https://safebooru.org/index.php', method: 'GET' } });
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(request).resolves.toEqual({ ok: false, status: 0, error: 'Request timed out' });
  });

  it('cancels an owned request by request ID', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const request = proxyRequest({ type: 'API_REQUEST', payload: { requestId: 'search-1', url: 'https://safebooru.org/index.php', method: 'GET' } });

    expect(cancelProxyRequest('search-1')).toBe(true);
    await expect(request).resolves.toEqual({ ok: false, status: 0, error: 'Request cancelled' });
    expect(fetch.mock.calls[0]?.[1]?.signal).toMatchObject({ aborted: true });
    expect(cancelProxyRequest('search-1')).toBe(false);
  });

  it('applies the same timeout to the Danbooru tab fallback', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<!DOCTYPE html><title>Just a moment...</title>', { status: 403, headers: { 'Content-Type': 'text/html' } }));
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 1 }),
        get: vi.fn().mockResolvedValue({ id: 1, status: 'complete' }),
        remove: vi.fn().mockResolvedValue(undefined),
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      scripting: { executeScript: vi.fn(() => new Promise(() => undefined)) },
    });
    const request = proxyRequest({ type: 'API_REQUEST', payload: { url: 'https://danbooru.donmai.us/posts.json', method: 'GET' } });
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(request).resolves.toEqual({ ok: false, status: 0, error: 'Request timed out' });
  });

  it('does not deduplicate credential-bearing query requests', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const request = { type: 'API_REQUEST' as const, payload: { url: 'https://gelbooru.com/index.php?api_key=secret&user_id=7', method: 'GET' as const } };
    await Promise.all([proxyRequest(request), proxyRequest(request)]);
    expect(fetch).toHaveBeenCalledTimes(2);
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

  it('bounds completed API responses with LRU eviction', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    for (let index = 0; index <= 200; index += 1) {
      await proxyRequest({ type: 'API_REQUEST', payload: { url: `https://yande.re/post.json?tags=cache-${index}`, method: 'GET' } });
    }
    expect(fetch).toHaveBeenCalledTimes(201);
    expect(apiCacheDiagnostics()).toMatchObject({ entries: 200, maxEntries: 200 });
    expect(apiCacheDiagnostics().bytes).toBeLessThanOrEqual(apiCacheDiagnostics().maxBytes);
  });

  it('expires completed API responses after the TTL', async () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const request = { type: 'API_REQUEST' as const, payload: { url: 'https://yande.re/post.json?tags=ttl-test', method: 'GET' as const } };
    await proxyRequest(request);
    await proxyRequest(request);
    vi.setSystemTime(Date.now() + 120_001);
    await proxyRequest(request);

    expect(fetch).toHaveBeenCalledTimes(2);
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
