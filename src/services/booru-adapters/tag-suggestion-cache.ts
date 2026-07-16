import { createStore, del, entries, get, set } from 'idb-keyval';
import type { TagAutocompleteResult } from '../../types/api';
import type { BooruSource } from '../../types/post';
import { TAG_COUNT_TTL } from './tag-categories';

interface CachedSuggestions {
  items: TagAutocompleteResult[];
  updatedAt: number;
}

const suggestionStore = createStore('danbooru-viewer-tag-suggestions', 'queries');
const memoryCache = new Map<string, CachedSuggestions>();
const INDEX_KEY = '__suggestion_index__';
const MAX_SUGGESTIONS = 500;
const diskIndex = new Map<string, number>();
let initializePromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
const cacheKey = (source: BooruSource, query: string) => `${source}:${query.trim().toLowerCase()}`;

async function ensureDiskIndex() {
  if (!initializePromise) initializePromise = (async () => {
    const now = Date.now();
    const stored = await entries<string, unknown>(suggestionStore);
    const valid = stored.flatMap(([key, value]) => {
      if (key === INDEX_KEY || !value || typeof value !== 'object') return [];
      const updatedAt = (value as Partial<CachedSuggestions>).updatedAt;
      return typeof updatedAt === 'number' && now - updatedAt < TAG_COUNT_TTL ? [{ key, updatedAt }] : [];
    }).sort((left, right) => right.updatedAt - left.updatedAt);
    const kept = valid.slice(0, MAX_SUGGESTIONS);
    kept.forEach((item) => diskIndex.set(item.key, item.updatedAt));
    const keep = new Set(kept.map((item) => item.key));
    const removed = stored.map(([key]) => key).filter((key) => key !== INDEX_KEY && !keep.has(key));
    await Promise.all([...removed.map((key) => del(key, suggestionStore)), set(INDEX_KEY, kept, suggestionStore)]);
  })().catch(() => undefined);
  await initializePromise;
}

function rememberInMemory(key: string, value: CachedSuggestions) {
  memoryCache.delete(key);
  memoryCache.set(key, value);
  while (memoryCache.size > MAX_SUGGESTIONS) memoryCache.delete(memoryCache.keys().next().value!);
}

export async function getCachedSuggestions(source: BooruSource, query: string) {
  const key = cacheKey(source, query);
  const memory = memoryCache.get(key);
  if (memory && Date.now() - memory.updatedAt < TAG_COUNT_TTL) { rememberInMemory(key, memory); return { ...memory, stale: false }; }
  if (memory) memoryCache.delete(key);
  if (typeof indexedDB === 'undefined') return undefined;
  try {
    await ensureDiskIndex();
    const cached = await get<CachedSuggestions>(key, suggestionStore);
    if (!cached || Date.now() - cached.updatedAt >= TAG_COUNT_TTL) { if (cached) { diskIndex.delete(key); await del(key, suggestionStore); } return undefined; }
    rememberInMemory(key, cached);
    return { ...cached, stale: false };
  } catch { return undefined; }
}

export async function cacheSuggestions(source: BooruSource, query: string, items: TagAutocompleteResult[]) {
  const key = cacheKey(source, query);
  const value = { items, updatedAt: Date.now() };
  rememberInMemory(key, value);
  if (typeof indexedDB === 'undefined') return;
  try {
    await ensureDiskIndex();
    writeQueue = writeQueue.then(async () => {
      diskIndex.delete(key);
      diskIndex.set(key, value.updatedAt);
      const removed: string[] = [];
      while (diskIndex.size > MAX_SUGGESTIONS) {
        const oldest = [...diskIndex.entries()].sort((left, right) => left[1] - right[1])[0]?.[0];
        if (!oldest) break;
        diskIndex.delete(oldest); removed.push(oldest);
      }
      await Promise.all([set(key, value, suggestionStore), set(INDEX_KEY, [...diskIndex].map(([indexKey, updatedAt]) => ({ key: indexKey, updatedAt })), suggestionStore), ...removed.map((removedKey) => del(removedKey, suggestionStore))]);
    }).catch(() => undefined);
    await writeQueue;
  } catch { /* Memory cache remains available. */ }
}

export function suggestionCacheDiagnostics() { return { memoryEntries: memoryCache.size, maxEntries: MAX_SUGGESTIONS }; }
