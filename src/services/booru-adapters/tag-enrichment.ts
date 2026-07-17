import type { Credentials } from '../../types/api';
import type { UnifiedPost } from '../../types/post';
import { apiGet } from '../api/client';
import { getBooruAdapter } from '.';
import { hasCanonicalTagCategory, hasTagCategory, hydrateTagMetadata, rememberTagMetadata, tagCategoryFor, tagCategoryFromType } from './tag-categories';

interface DanbooruTagRecord {
  name: string;
  category: number;
  post_count: number;
}

const pendingPosts = new Map<string, Promise<UnifiedPost>>();

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export function applyKnownTagCategories(post: UnifiedPost): UnifiedPost {
  return { ...post, tags: post.tags.map((tag) => ({ ...tag, category: tagCategoryFor(post.source, tag.name, tag.category) })) };
}

async function fetchDanbooruMetadata(names: string[]) {
  for (const batch of chunks(names, 40)) {
    const url = new URL('/tags.json', 'https://danbooru.donmai.us');
    url.searchParams.set('search[name_comma]', batch.join(','));
    url.searchParams.set('limit', String(batch.length));
    const records = await apiGet<DanbooruTagRecord[]>(url);
    await rememberTagMetadata('danbooru', records.map((record) => ({ name: record.name, category: tagCategoryFromType(record.category), postCount: record.post_count })));
  }
}

export async function ensureCanonicalTagMetadata(source: UnifiedPost['source'], names: string[]) {
  const uniqueNames = [...new Set(names)];
  await hydrateTagMetadata(source, uniqueNames);
  const missingCanonical = uniqueNames.filter((name) => !hasCanonicalTagCategory(name));
  if (missingCanonical.length) await fetchDanbooruMetadata(missingCanonical);
}

export function applyKnownSuggestionCategories<T extends { name: string; category: UnifiedPost['tags'][number]['category'] }>(source: UnifiedPost['source'], items: T[]) {
  return items.map((item) => ({ ...item, category: tagCategoryFor(source, item.name, item.category) }));
}

async function enrich(post: UnifiedPost, credentials?: Credentials, onCached?: (cached: UnifiedPost) => void) {
  if (post.source === 'danbooru') return post;
  const names = [...new Set(post.tags.map((tag) => tag.name))];
  await hydrateTagMetadata(post.source, names);
  const cached = applyKnownTagCategories(post);
  onCached?.(cached);

  const missingCanonical = names.filter((name) => !hasCanonicalTagCategory(name));
  if (missingCanonical.length) {
    try { await fetchDanbooruMetadata(missingCanonical); } catch { /* Fall through to the source API. */ }
  }

  const sourceSpecific = names.filter((name) => !hasTagCategory(post.source, name)).slice(0, 24);
  if (sourceSpecific.length) {
    const adapter = getBooruAdapter(post.source);
    for (const batch of chunks(sourceSpecific, 6)) {
      await Promise.all(batch.map(async (name) => {
        try {
          const exact = (await adapter.autocomplete(name, credentials)).find((tag) => tag.name === name);
          if (exact) await rememberTagMetadata(post.source, [{ name: exact.name, category: exact.category, postCount: exact.postCount }]);
        } catch {
          // Category enrichment is optional and must not block browsing.
        }
      }));
    }
  }
  return applyKnownTagCategories(cached);
}

export function enrichPostTags(post: UnifiedPost, credentials?: Credentials, onCached?: (cached: UnifiedPost) => void) {
  const key = `${post.source}:${post.id}`;
  const pending = pendingPosts.get(key);
  if (pending) return pending;
  const request = enrich(post, credentials, onCached).finally(() => pendingPosts.delete(key));
  pendingPosts.set(key, request);
  return request;
}
