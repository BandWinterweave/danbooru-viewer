import { createStore, getMany, setMany } from 'idb-keyval';
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
const cacheKey = (source: BooruSource, name: string) => `${source}:${name}`;

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
    const records = await getMany<CachedTagMetadata>(missing.map((name) => cacheKey(source, name)), metadataStore);
    records.forEach((record, index) => {
      if (!record) return;
      let sourceCache = categoryCache.get(source);
      if (!sourceCache) { sourceCache = new Map(); categoryCache.set(source, sourceCache); }
      sourceCache.set(missing[index], record);
    });
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
  if (typeof indexedDB === 'undefined') return;
  try { await setMany(entries, metadataStore); } catch { /* Memory cache remains available. */ }
}
