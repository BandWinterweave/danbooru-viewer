import { createStore, del, entries as idbEntries, getMany, set, setMany } from 'idb-keyval';
import type { BooruSource, TagCategory } from '../../types/post';

export const TAG_COUNT_TTL = 7 * 24 * 60 * 60 * 1000;

export interface CachedTagMetadata {
  category: TagCategory;
  postCount: number;
  countUpdatedAt: number;
}

const categoryByType: Record<number, TagCategory> = {
  0: 'general',
  1: 'artist',
  3: 'copyright',
  4: 'character',
  5: 'meta',
  6: 'meta',
};

const categoryCache = new Map<BooruSource, Map<string, CachedTagMetadata>>();
const metadataStore = createStore('danbooru-viewer-tag-metadata', 'tags');
const METADATA_INDEX_KEY = '__metadata_index__';
const MAX_TAG_METADATA = 10_000;
const diskIndex = new Map<string, number>();
let initializePromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
const cacheKey = (source: BooruSource, name: string) => `${source}:${name}`;

async function ensureDiskIndex() {
  if (!initializePromise) initializePromise = (async () => {
    const stored = await idbEntries<string, unknown>(metadataStore);
    const valid = stored.flatMap(([key, value]) => {
      if (key === METADATA_INDEX_KEY || !value || typeof value !== 'object' || !('category' in value)) return [];
      return [{ key, accessedAt: Number((value as CachedTagMetadata).countUpdatedAt) || 0 }];
    }).sort((left, right) => right.accessedAt - left.accessedAt);
    const kept = valid.slice(0, MAX_TAG_METADATA);
    kept.forEach((item) => diskIndex.set(item.key, item.accessedAt));
    const keep = new Set(kept.map((item) => item.key));
    const removed = stored.map(([key]) => key).filter((key) => key !== METADATA_INDEX_KEY && !keep.has(key));
    await Promise.all([...removed.map((key) => del(key, metadataStore)), set(METADATA_INDEX_KEY, kept, metadataStore)]);
  })().catch(() => undefined);
  await initializePromise;
}

function trimMemoryCache() {
  let count = [...categoryCache.values()].reduce((total, cache) => total + cache.size, 0);
  if (count <= MAX_TAG_METADATA) return;
  for (const cache of categoryCache.values()) {
    for (const key of cache.keys()) {
      cache.delete(key);
      count -= 1;
      if (count <= MAX_TAG_METADATA) return;
    }
  }
}

export function tagCategoryFromType(type: number | string | undefined): TagCategory {
  return categoryByType[Number(type)] ?? 'general';
}

export function rememberTagCategory(source: BooruSource, name: string, category: TagCategory) {
  let sourceCache = categoryCache.get(source);
  if (!sourceCache) {
    sourceCache = new Map();
    categoryCache.set(source, sourceCache);
  }
  const current = sourceCache.get(name);
  sourceCache.set(name, { category, postCount: current?.postCount ?? 0, countUpdatedAt: current?.countUpdatedAt ?? 0 });
  trimMemoryCache();
}

export function tagCategoryFor(source: BooruSource, name: string): TagCategory {
  return categoryCache.get(source)?.get(name)?.category ?? 'general';
}

export function hasTagCategory(source: BooruSource, name: string) {
  return categoryCache.get(source)?.has(name) ?? false;
}

export function tagMetadataNeedsRefresh(source: BooruSource, names: string[]) {
  const sourceCache = categoryCache.get(source);
  return names.some((name) => Date.now() - (sourceCache?.get(name)?.countUpdatedAt ?? 0) >= TAG_COUNT_TTL);
}

export async function hydrateTagMetadata(source: BooruSource, names: string[]) {
  const missing = [...new Set(names)].filter((name) => !hasTagCategory(source, name));
  if (!missing.length || typeof indexedDB === 'undefined') return;
  try {
    await ensureDiskIndex();
    const records = await getMany<CachedTagMetadata>(missing.map((name) => cacheKey(source, name)), metadataStore);
    records.forEach((record, index) => {
      if (!record) return;
      let sourceCache = categoryCache.get(source);
      if (!sourceCache) { sourceCache = new Map(); categoryCache.set(source, sourceCache); }
      sourceCache.set(missing[index], record);
    });
    trimMemoryCache();
  } catch {
    // Cache failures must not block live tag lookup.
  }
}

export async function rememberTagMetadata(source: BooruSource, records: Array<{ name: string; category: TagCategory; postCount?: number }>) {
  if (!records.length) return;
  let sourceCache = categoryCache.get(source);
  if (!sourceCache) { sourceCache = new Map(); categoryCache.set(source, sourceCache); }
  const now = Date.now();
  const entries: Array<[IDBValidKey, CachedTagMetadata]> = [];
  records.forEach(({ name, category, postCount }) => {
    const current = sourceCache!.get(name);
    const value = {
      category,
      postCount: postCount ?? current?.postCount ?? 0,
      countUpdatedAt: postCount === undefined ? current?.countUpdatedAt ?? 0 : now,
    };
    sourceCache!.set(name, value);
    entries.push([cacheKey(source, name), value]);
  });
  trimMemoryCache();
  if (typeof indexedDB === 'undefined') return;
  try {
    await ensureDiskIndex();
    const keys = entries.map(([key]) => String(key));
    writeQueue = writeQueue.then(async () => {
      keys.forEach((key) => { diskIndex.delete(key); diskIndex.set(key, now); });
      const removed: string[] = [];
      while (diskIndex.size > MAX_TAG_METADATA) {
        const oldest = [...diskIndex.entries()].sort((left, right) => left[1] - right[1])[0]?.[0];
        if (!oldest) break;
        diskIndex.delete(oldest); removed.push(oldest);
      }
      await Promise.all([setMany(entries, metadataStore), set(METADATA_INDEX_KEY, [...diskIndex].map(([key, accessedAt]) => ({ key, accessedAt })), metadataStore), ...removed.map((key) => del(key, metadataStore))]);
    }).catch(() => undefined);
    await writeQueue;
  } catch { /* Memory cache remains available. */ }
}

export function tagMetadataCacheDiagnostics() {
  return { memoryEntries: [...categoryCache.values()].reduce((total, cache) => total + cache.size, 0), maxEntries: MAX_TAG_METADATA };
}
