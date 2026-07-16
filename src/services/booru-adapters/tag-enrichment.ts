import type { Credentials } from '../../types/api';
import type { UnifiedPost } from '../../types/post';
import { apiGet } from '../api/client';
import { getBooruAdapter } from '.';
import { hasTagCategory, hydrateTagMetadata, rememberTagMetadata, tagCategoryFor, tagCategoryFromType, tagMetadataNeedsRefresh } from './tag-categories';

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
  return { ...post, tags: post.tags.map((tag) => ({ ...tag, category: tagCategoryFor(post.source, tag.name) })) };
}

async function fetchDanbooruMetadata(source: UnifiedPost['source'], names: string[]) {
  for (const batch of chunks(names, 40)) {
    const url = new URL('/tags.json', 'https://danbooru.donmai.us');
    url.searchParams.set('search[name_comma]', batch.join(','));
    url.searchParams.set('limit', String(batch.length));
    const records = await apiGet<DanbooruTagRecord[]>(url);
    await rememberTagMetadata(source, records.map((record) => ({ name: record.name, category: tagCategoryFromType(record.category), postCount: record.post_count })));
  }
}

async function enrich(post: UnifiedPost, credentials?: Credentials) {
  if (post.source === 'danbooru') return post;
  const names = [...new Set(post.tags.map((tag) => tag.name))];
  await hydrateTagMetadata(post.source, names);
  if (names.every((name) => hasTagCategory(post.source, name))) {
    if (tagMetadataNeedsRefresh(post.source, names)) void fetchDanbooruMetadata(post.source, names).catch(() => undefined);
    return applyKnownTagCategories(post);
  }
  const unresolved = names.filter((name) => !hasTagCategory(post.source, name));

  try { await fetchDanbooruMetadata(post.source, unresolved); } catch { /* Fall through to the source API. */ }

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
  return applyKnownTagCategories(post);
}

export function enrichPostTags(post: UnifiedPost, credentials?: Credentials) {
  const key = `${post.source}:${post.id}`;
  const pending = pendingPosts.get(key);
  if (pending) return pending;
  const request = enrich(post, credentials).finally(() => pendingPosts.delete(key));
  pendingPosts.set(key, request);
  return request;
}
