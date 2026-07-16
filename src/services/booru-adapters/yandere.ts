import type { BooruAdapter, PaginatedResult, SearchQuery, TagAutocompleteResult } from '../../types/api';
import type { Rating, UnifiedPost } from '../../types/post';
import { apiGet } from '../api/client';
import { buildSourceTags } from './query-tags';
import { isOnOrAfter } from './date-filter';
import { rememberTagCategory, tagCategoryFor, tagCategoryFromType } from './tag-categories';
import { safeHttpUrl } from '../safe-url';

interface YanderePost { id: number; tags: string; rating: string; score: number; author?: string; source?: string; file_url?: string; preview_url?: string; sample_url?: string; width?: number; height?: number; file_size?: number; md5?: string; created_at?: number; parent_id?: number | null; has_children?: boolean; }
export const normalizeYanderePost = (raw: YanderePost): UnifiedPost => {
  const createdAt = new Date((raw.created_at ?? 0) * 1000).toISOString();
  const fileExt = raw.file_url?.split('.').at(-1)?.split('?')[0].toLowerCase() ?? '';
  return { id: raw.id, source: 'yandere', rating: (['s', 'q', 'e'].includes(raw.rating) ? raw.rating : 's') as Rating, tags: raw.tags.split(/\s+/).filter(Boolean).map((name) => ({ name, category: tagCategoryFor('yandere', name) })), tagString: raw.tags, score: raw.score ?? 0, upScore: 0, downScore: 0, favCount: 0, uploader: raw.author ?? 'unknown', sourceUrl: safeHttpUrl(raw.source), imageWidth: raw.width ?? 0, imageHeight: raw.height ?? 0, fileSize: raw.file_size ?? 0, fileExt, previewUrl: safeHttpUrl(raw.preview_url), sampleUrl: safeHttpUrl(raw.sample_url ?? raw.file_url), fileUrl: safeHttpUrl(raw.file_url), playbackUrl: ['mp4', 'webm'].includes(fileExt) ? safeHttpUrl(raw.file_url) || undefined : undefined, md5: raw.md5 ?? '', createdAt, updatedAt: createdAt, parentId: raw.parent_id ?? null, hasChildren: raw.has_children ?? false, status: 'active', poolIds: [], tagStringGeneral: raw.tags, tagStringArtist: '', tagStringCopyright: '', tagStringCharacter: '', tagStringMeta: '' };
};
export const yandereAdapter: BooruAdapter = {
  id: 'yandere', name: 'Yande.re', baseUrl: 'https://yande.re', supportsAuth: true, supportsWrites: false,
  async searchPosts(query: SearchQuery, credentials): Promise<PaginatedResult<UnifiedPost>> { const limit = Math.min(query.limit ?? 40, 100); const page = Math.max(query.page ?? 1, 1); const url = new URL('/post.json', this.baseUrl); url.searchParams.set('limit', String(limit)); url.searchParams.set('page', String(page)); const terms = buildSourceTags('yandere', query); if (terms) url.searchParams.set('tags', terms); const posts = await apiGet<YanderePost[]>(url, credentials); const items = posts.map(normalizeYanderePost).filter((post) => isOnOrAfter(post.createdAt, query.dateAfter)); return { items, page, limit, hasMore: posts.length === limit }; },
  async getPost(id: number) { const result = await this.searchPosts({ tags: `id:${id}`, limit: 1 }); if (!result.items[0]) throw new Error(`Yande.re post ${id} was not found`); return result.items[0]; },
  async autocomplete(query: string): Promise<TagAutocompleteResult[]> { if (query.trim().length < 2) return []; const url = new URL('/tag.json', this.baseUrl); url.searchParams.set('name', `${query.trim()}*`); url.searchParams.set('limit', '8'); const tags = await apiGet<Array<{ name: string; count: number; type: number }>>(url); return tags.map((tag) => ({ name: tag.name, label: tag.name, postCount: tag.count, category: tagCategoryFromType(tag.type) })).map((item) => { rememberTagCategory('yandere', item.name, item.category); return item; }); },
};
