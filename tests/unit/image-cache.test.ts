import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => new Map<string, unknown>());
const entriesMock = vi.hoisted(() => vi.fn(async () => [...database.entries()]));
const setMock = vi.hoisted(() => vi.fn(async (key: string, value: unknown) => { database.set(key, value); }));

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => ({})),
  entries: entriesMock,
  get: vi.fn(async (key: string) => database.get(key)),
  set: setMock,
  del: vi.fn(async (key: string) => { database.delete(key); }),
}));

async function loadCache() {
  vi.resetModules();
  return import('../../src/services/image-cache');
}

describe('image cache bounds', () => {
  beforeEach(() => {
    database.clear();
    entriesMock.mockClear();
    setMock.mockClear();
    vi.stubGlobal('indexedDB', {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['image']), { status: 200 })));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:${crypto.randomUUID()}`) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('scans IndexedDB once and incrementally maintains subsequent writes', async () => {
    const cache = await loadCache();
    for (let index = 0; index < 4; index += 1) {
      const image = await cache.acquireCachedImage(`https://example.com/${index}.jpg`);
      image.release();
    }

    expect(entriesMock).toHaveBeenCalledTimes(1);
    expect(cache.imageCacheDiagnostics()).toMatchObject({ entries: 4, objectUrls: 0 });
  });

  it('reference-counts and revokes object URLs after the last consumer', async () => {
    const cache = await loadCache();
    const first = await cache.acquireCachedImage('https://example.com/shared.jpg');
    const second = await cache.acquireCachedImage('https://example.com/shared.jpg');

    first.release();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    second.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(cache.imageCacheDiagnostics().objectUrls).toBe(0);
  });

  it('does not persist media above the per-item byte limit', async () => {
    const cache = await loadCache();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array(cache.IMAGE_CACHE_MAX_ITEM_BYTES + 1), { status: 200 }));

    const image = await cache.acquireCachedImage('https://example.com/original.jpg');

    expect(image.src).toBe('https://example.com/original.jpg');
    expect(cache.imageCacheDiagnostics()).toMatchObject({ entries: 0, bytes: 0, objectUrls: 0 });
  });

  it('returns a fetched image without waiting for the disk write queue', async () => {
    let finishWrite!: () => void;
    setMock.mockImplementationOnce(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
    const cache = await loadCache();

    const image = await cache.acquireCachedImage('https://example.com/non-blocking.jpg');

    expect(image.src).toMatch(/^blob:/);
    expect(setMock).toHaveBeenCalledTimes(1);
    finishWrite();
    image.release();
  });

  it('keeps long-running media usage within entry and byte budgets', async () => {
    const now = Date.now();
    for (let index = 0; index < 520; index += 1) {
      database.set(`https://example.com/cached-${index}.jpg`, { blob: { size: 256 }, size: 256, expiresAt: now + 60_000, accessedAt: now + index });
    }
    const cache = await loadCache();
    const image = await cache.acquireCachedImage('https://example.com/live.jpg');
    image.release();

    const diagnostics = cache.imageCacheDiagnostics();
    expect(entriesMock).toHaveBeenCalledTimes(1);
    expect(diagnostics.entries).toBeLessThanOrEqual(500);
    expect(diagnostics.bytes).toBeLessThanOrEqual(diagnostics.maxBytes);
  });

  it('does not revoke an expired object URL while consumers still hold it', async () => {
    vi.useFakeTimers();
    const cache = await loadCache();
    const first = await cache.acquireCachedImage('https://example.com/held.jpg');
    vi.setSystemTime(Date.now() + cache.IMAGE_CACHE_TTL + 1);
    const second = await cache.acquireCachedImage('https://example.com/held.jpg');

    expect(second.src).toBe(first.src);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    second.release();
    first.release();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(first.src);
    vi.useRealTimers();
  });

  it('passes local blob URLs through without fetching or recaching them', async () => {
    const cache = await loadCache();
    const image = await cache.acquireCachedImage('blob:comfy-output');

    expect(image.src).toBe('blob:comfy-output');
    expect(fetch).not.toHaveBeenCalled();
    image.release();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
