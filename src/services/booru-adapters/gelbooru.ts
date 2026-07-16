import type { BooruAdapter, Credentials, PaginatedResult, SearchQuery, TagAutocompleteResult } from '../../types/api';
import type { BooruSource, Rating, UnifiedPost } from '../../types/post';
import { ApiRequestError, apiGet, apiRequest } from '../api/client';
import { buildSourceTags } from './query-tags';
import { isOnOrAfter } from './date-filter';

interface GelbooruRawPost {
  id: number | string;
  tags?: string;
  rating?: string;
  score?: number | string;
  owner?: string;
  source?: string;
  file_url?: string;
  preview_url?: string;
  sample_url?: string;
  width?: number | string;
  height?: number | string;
  md5?: string;
  change?: number | string;
}

const ratingMap: Record<string, Rating> = { general: 'g', safe: 's', sensitive: 's', questionable: 'q', explicit: 'e', g: 'g', s: 's', q: 'q', e: 'e' };
const sourceBases: Partial<Record<BooruSource, string>> = { gelbooru: 'https://gelbooru.com', safebooru: 'https://safebooru.org', rule34: 'https://api.rule34.xxx' };
const absoluteUrl = (value: string | undefined, source: BooruSource) => {
  if (!value) return '';
  const url = new URL(value, sourceBases[source]);
  if (url.protocol === 'http:') url.protocol = 'https:';
  return url.toString();
};

export function normalizeGelbooruPost(raw: GelbooruRawPost, source: BooruSource): UnifiedPost {
  const tagString = raw.tags ?? '';
  const timestamp = Number(raw.change ?? 0);
  const date = timestamp ? new Date(timestamp * 1000).toISOString() : new Date(0).toISOString();
  return {
    id: Number(raw.id), source, rating: ratingMap[raw.rating ?? ''] ?? 's',
    tags: tagString.split(/\s+/).filter(Boolean).map((name) => ({ name, category: 'general' })),
    tagString, score: Number(raw.score ?? 0), upScore: 0, downScore: 0, favCount: 0,
    uploader: raw.owner ?? 'unknown', sourceUrl: raw.source ?? '', imageWidth: Number(raw.width ?? 0),
    imageHeight: Number(raw.height ?? 0), fileSize: 0, fileExt: raw.file_url?.split('.').at(-1)?.split('?')[0] ?? '',
    previewUrl: absoluteUrl(raw.preview_url ?? raw.sample_url ?? raw.file_url, source), sampleUrl: absoluteUrl(raw.sample_url ?? raw.file_url ?? raw.preview_url, source),
    fileUrl: absoluteUrl(raw.file_url ?? raw.sample_url ?? raw.preview_url, source), md5: raw.md5 ?? '', createdAt: date, updatedAt: date,
    playbackUrl: ['mp4', 'webm'].includes(raw.file_url?.split('.').at(-1)?.split('?')[0].toLowerCase() ?? '') ? absoluteUrl(raw.file_url, source) : undefined,
    parentId: null, hasChildren: false, status: 'active', poolIds: [], tagStringGeneral: tagString, tagStringArtist: '', tagStringCopyright: '', tagStringCharacter: '', tagStringMeta: '',
  };
}

function withGelbooruAuth(url: URL, credentials?: Credentials) {
  if (credentials?.username && credentials.apiKey) {
    url.searchParams.set('user_id', credentials.username);
    url.searchParams.set('api_key', credentials.apiKey);
  }
}

export function createGelbooruAdapter(options: { id: BooruSource; name: string; baseUrl: string; supportsAuth?: boolean; requiresAuth?: boolean }): BooruAdapter {
  const adapter: BooruAdapter = {
    id: options.id, name: options.name, baseUrl: options.baseUrl, supportsAuth: options.supportsAuth ?? false,
    supportsWrites: options.id === 'gelbooru',
    async searchPosts(query: SearchQuery, credentials?: Credentials): Promise<PaginatedResult<UnifiedPost>> {
      if (options.requiresAuth && (!credentials?.username || !credentials.apiKey)) throw new Error(`${options.name} requires a user ID and API key for API access. Configure them in Settings.`);
      const limit = Math.min(Math.max(query.limit ?? 40, 1), 100);
      const page = Math.max(query.page ?? 1, 1);
      const url = new URL('/index.php', options.baseUrl);
      url.searchParams.set('page', 'dapi'); url.searchParams.set('s', 'post'); url.searchParams.set('q', 'index');
      url.searchParams.set('json', '1'); url.searchParams.set('limit', String(limit)); url.searchParams.set('pid', String(page - 1));
      const terms = buildSourceTags(options.id, query);
      if (terms) url.searchParams.set('tags', terms);
      withGelbooruAuth(url, credentials);
      let response: GelbooruRawPost[] | { post?: GelbooruRawPost[] } | string | null;
      try { response = await apiGet<GelbooruRawPost[] | { post?: GelbooruRawPost[] } | string>(url); }
      catch (error) { if (error instanceof ApiRequestError && error.status === 401) throw new Error(`${options.name} rejected the credentials. Check the user ID and API key in Settings.`); throw error; }
      if (typeof response === 'string') throw new Error(response.includes('Missing authentication') ? `${options.name} requires a user ID and API key for API access. Configure them in Settings.` : `${options.name} returned an invalid API response.`);
      const posts = Array.isArray(response) ? response : response?.post ?? [];
      return { items: posts.map((post) => normalizeGelbooruPost(post, options.id)).filter((post) => isOnOrAfter(post.createdAt, query.dateAfter)), page, limit, hasMore: posts.length === limit };
    },
    async getPost(id: number, credentials?: Credentials) {
      const result = await adapter.searchPosts({ tags: `id:${id}`, limit: 1 }, credentials);
      if (!result.items[0]) throw new Error(`${options.name} post ${id} was not found`);
      return result.items[0];
    },
    async autocomplete(query: string, credentials?: Credentials): Promise<TagAutocompleteResult[]> {
      if (query.trim().length < 2) return [];
      const url = new URL('/index.php', options.baseUrl);
      url.searchParams.set('page', 'autocomplete2'); url.searchParams.set('type', 'tag_query'); url.searchParams.set('limit', '8'); url.searchParams.set('term', query.trim());
      withGelbooruAuth(url, credentials);
      const items = await apiGet<Array<{ value?: string; label?: string; post_count?: number; category?: number }> | string[]>(url);
      return items.map((item) => typeof item === 'string' ? { name: item, label: item, postCount: 0, category: 0 } : { name: item.value ?? item.label ?? '', label: item.label ?? item.value ?? '', postCount: Number(item.post_count ?? 0), category: Number(item.category ?? 0) || 0 }).filter((item) => item.name);
    },
  };
  if (options.id === 'gelbooru') {
    adapter.addFavorite = async (postId, credentials) => {
      const url = new URL('/index.php', options.baseUrl);
      url.searchParams.set('page', 'favorites'); url.searchParams.set('s', 'add'); url.searchParams.set('id', String(postId)); withGelbooruAuth(url, credentials);
      await apiRequest<unknown>(url, { method: 'POST' });
    };
  }
  return adapter;
}

export const gelbooruAdapter = createGelbooruAdapter({ id: 'gelbooru', name: 'Gelbooru', baseUrl: 'https://gelbooru.com', supportsAuth: true, requiresAuth: true });
export const safebooruAdapter = createGelbooruAdapter({ id: 'safebooru', name: 'Safebooru', baseUrl: 'https://safebooru.org' });
export const rule34Adapter = createGelbooruAdapter({ id: 'rule34', name: 'Rule34', baseUrl: 'https://api.rule34.xxx', supportsAuth: true, requiresAuth: true });
