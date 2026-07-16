import { createStore, get, set } from 'idb-keyval';
import type { TagAutocompleteResult } from '../../types/api';
import type { BooruSource } from '../../types/post';
import { TAG_COUNT_TTL } from './tag-categories';

interface CachedSuggestions {
  items: TagAutocompleteResult[];
  updatedAt: number;
}

const suggestionStore = createStore('danbooru-viewer-tag-suggestions', 'queries');
const memoryCache = new Map<string, CachedSuggestions>();
const cacheKey = (source: BooruSource, query: string) => `${source}:${query.trim().toLowerCase()}`;

export async function getCachedSuggestions(source: BooruSource, query: string) {
  const key = cacheKey(source, query);
  const memory = memoryCache.get(key);
  if (memory) return { ...memory, stale: Date.now() - memory.updatedAt >= TAG_COUNT_TTL };
  if (typeof indexedDB === 'undefined') return undefined;
  try {
    const cached = await get<CachedSuggestions>(key, suggestionStore);
    if (!cached) return undefined;
    memoryCache.set(key, cached);
    return { ...cached, stale: Date.now() - cached.updatedAt >= TAG_COUNT_TTL };
  } catch { return undefined; }
}

export async function cacheSuggestions(source: BooruSource, query: string, items: TagAutocompleteResult[]) {
  const key = cacheKey(source, query);
  const value = { items, updatedAt: Date.now() };
  memoryCache.set(key, value);
  if (typeof indexedDB === 'undefined') return;
  try { await set(key, value, suggestionStore); } catch { /* Memory cache remains available. */ }
}
