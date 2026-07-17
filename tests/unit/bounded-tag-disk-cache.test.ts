import { beforeEach, describe, expect, it, vi } from 'vitest';

const databases = vi.hoisted(() => new Map<object, Map<string, unknown>>());

vi.mock('idb-keyval', () => ({
  createStore: vi.fn(() => {
    const store = {};
    databases.set(store, new Map());
    return store;
  }),
  entries: vi.fn(async (store: object) => [...databases.get(store)!.entries()]),
  get: vi.fn(async (key: string, store: object) => databases.get(store)!.get(key)),
  getMany: vi.fn(async (keys: string[], store: object) => keys.map((key) => databases.get(store)!.get(key))),
  set: vi.fn(async (key: string, value: unknown, store: object) => { databases.get(store)!.set(key, value); }),
  setMany: vi.fn(async (values: Array<[string, unknown]>, store: object) => values.forEach(([key, value]) => databases.get(store)!.set(String(key), value))),
  del: vi.fn(async (key: string, store: object) => { databases.get(store)!.delete(key); }),
}));

describe('bounded tag disk caches', () => {
  beforeEach(() => { databases.clear(); vi.resetModules(); vi.stubGlobal('indexedDB', {}); });

  it('serializes concurrent suggestion writes and removes overflow records', async () => {
    const cache = await import('../../src/services/booru-adapters/tag-suggestion-cache');
    await Promise.all(Array.from({ length: 550 }, (_, index) => cache.cacheSuggestions('danbooru', `query-${index}`, [])));
    const store = [...databases.values()].find((value) => value.has('__suggestion_index__'))!;
    expect([...store.keys()].filter((key) => key !== '__suggestion_index__')).toHaveLength(500);
  });

  it('migrates and bounds metadata records on a batched write', async () => {
    const cache = await import('../../src/services/booru-adapters/tag-categories');
    await cache.rememberTagMetadata('danbooru', Array.from({ length: 10_050 }, (_, index) => ({ name: `tag-${index}`, category: 'general' as const, postCount: index })));
    const store = [...databases.values()][0];
    expect([...store.keys()].filter((key) => key !== '__metadata_index__')).toHaveLength(10_000);
  });

  it('hydrates the canonical record even when a source-specific fallback is already in memory', async () => {
    const cache = await import('../../src/services/booru-adapters/tag-categories');
    await cache.rememberTagMetadata('danbooru', [{ name: 'fkey', category: 'artist', postCount: 100 }]);
    cache.resetTagMetadataMemoryForTests();
    cache.rememberTagCategory('gelbooru', 'fkey', 'general');

    await cache.hydrateTagMetadata('gelbooru', ['fkey']);

    expect(cache.tagCategoryFor('gelbooru', 'fkey')).toBe('artist');
  });
});
