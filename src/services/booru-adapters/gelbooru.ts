import type { BooruAdapter, Credentials, PaginatedResult, SearchQuery, TagAutocompleteResult } from '../../types/api';
import type { BooruSource, Rating, TagCategory, UnifiedPost } from '../../types/post';
import { ApiRequestError, apiGet, apiRequest } from '../api/client';
import { buildSourceTags } from './query-tags';
import { isOnOrAfter } from './date-filter';
import { rememberTagCategory, tagCategoryFor, tagCategoryFromType } from './tag-categories';
import { safeHttpUrl } from '../safe-url';

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
  tag_string_general?: string;
  tag_string_artist?: string;
  tag_string_copyright?: string;
  tag_string_character?: string;
  tag_string_meta?: string;
}

const ratingMap: Record<string, Rating> = { general: 'g', safe: 's', sensitive: 's', questionable: 'q', explicit: 'e', g: 'g', s: 's', q: 'q', e: 'e' };
const sourceBases: Partial<Record<BooruSource, string>> = { gelbooru: 'https://gelbooru.com', safebooru: 'https://safebooru.org', rule34: 'https://api.rule34.xxx' };
const absoluteUrl = (value: string | undefined, source: BooruSource) => {
  const safe = safeHttpUrl(value, sourceBases[source]);
  if (!safe) return '';
  const url = new URL(safe);
  if (url.protocol === 'http:') url.protocol = 'https:';
  return url.toString();
};

function categorizedTags(raw: GelbooruRawPost, source: BooruSource) {
  const groups: Array<[string | undefined, TagCategory]> = [
    [raw.tag_string_artist, 'artist'],
    [raw.tag_string_character, 'character'],
    [raw.tag_string_copyright, 'copyright'],
    [raw.tag_string_general, 'general'],
    [raw.tag_string_meta, 'meta'],
  ];
  const fromGroups = groups.flatMap(([value, category]) => (value ?? '').split(/\s+/).filter(Boolean).map((name) => ({ name, category })));
  if (fromGroups.length) {
    const categorizedNames = new Set(fromGroups.map((tag) => tag.name));
    const remaining = (raw.tags ?? '').split(/\s+/).filter((name) => name && !categorizedNames.has(name)).map((name) => ({ name, category: tagCategoryFor(source, name) }));
    return [...fromGroups, ...remaining];
  }
  return (raw.tags ?? '').split(/\s+/).filter(Boolean).map((name) => ({ name, category: tagCategoryFor(source, name) }));
}

export function normalizeGelbooruPost(raw: GelbooruRawPost, source: BooruSource): UnifiedPost {
  const tagString = raw.tags ?? '';
  const timestamp = Number(raw.change ?? 0);
  const date = timestamp ? new Date(timestamp * 1000).toISOString() : new Date(0).toISOString();
  return {
    id: Number(raw.id), source, rating: ratingMap[raw.rating ?? ''] ?? 's',
    tags: categorizedTags(raw, source),
    tagString, score: Number(raw.score ?? 0), upScore: 0, downScore: 0, favCount: 0,
    uploader: raw.owner ?? 'unknown', sourceUrl: safeHttpUrl(raw.source), imageWidth: Number(raw.width ?? 0),
    imageHeight: Number(raw.height ?? 0), fileSize: 0, fileExt: raw.file_url?.split('.').at(-1)?.split('?')[0] ?? '',
    previewUrl: absoluteUrl(raw.preview_url ?? raw.sample_url ?? raw.file_url, source), sampleUrl: absoluteUrl(raw.sample_url ?? raw.file_url ?? raw.preview_url, source),
    fileUrl: absoluteUrl(raw.file_url ?? raw.sample_url ?? raw.preview_url, source), md5: raw.md5 ?? '', createdAt: date, updatedAt: date,
    playbackUrl: ['mp4', 'webm'].includes(raw.file_url?.split('.').at(-1)?.split('?')[0].toLowerCase() ?? '') ? absoluteUrl(raw.file_url, source) : undefined,
    parentId: null, hasChildren: false, status: 'active', poolIds: [], tagStringGeneral: tagString, tagStringArtist: '', tagStringCopyright: '', tagStringCharacter: '', tagStringMeta: '',
  };
}

interface GelbooruTagItem { name?: string; value?: string; label?: string; count?: number | string; post_count?: number | string; type?: number | string; category?: number | string }

export function normalizeGelbooruTagResponse(data: unknown): TagAutocompleteResult[] {
  let items: GelbooruTagItem[] = [];
  if (typeof data === 'string') {
    const document = new DOMParser().parseFromString(data, 'application/xml');
    items = Array.from(document.querySelectorAll('tag')).map((tag) => ({
      name: tag.getAttribute('name') ?? '',
      count: tag.getAttribute('count') ?? '0',
      type: tag.getAttribute('type') ?? '0',
    }));
  } else if (Array.isArray(data)) {
    items = data.map((item) => typeof item === 'string' ? { name: item } : item as GelbooruTagItem);
  } else if (data && typeof data === 'object') {
    const tags = (data as { tag?: GelbooruTagItem[] }).tag;
    items = Array.isArray(tags) ? tags : [];
  }
  const normalized = items.map((item) => {
    const name = item.name ?? item.value ?? item.label?.replace(/\s+\([\d,]+\)$/, '') ?? '';
    const labelCount = item.label?.match(/\(([\d,]+)\)$/)?.[1]?.replaceAll(',', '');
    return {
      name,
      label: item.label ?? name,
      postCount: Number(item.post_count ?? item.count ?? labelCount ?? 0),
      category: tagCategoryFromType(item.category ?? item.type),
    };
  }).filter((item) => item.name);
  return [...new Map(normalized.map((item) => [item.name, item])).values()];
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
      const term = query.trim().toLowerCase();
      if (term.length < 2) return [];
      const url = new URL('/index.php', options.baseUrl);
      if (options.id === 'gelbooru') {
        url.searchParams.set('page', 'autocomplete2'); url.searchParams.set('type', 'tag_query'); url.searchParams.set('term', term);
      } else {
        url.searchParams.set('page', 'dapi'); url.searchParams.set('s', 'tag'); url.searchParams.set('q', 'index'); url.searchParams.set('json', '1'); url.searchParams.set('name_pattern', `${term}%`);
      }
      url.searchParams.set('limit', '8');
      withGelbooruAuth(url, credentials);
      const items = normalizeGelbooruTagResponse(await apiGet<unknown>(url))
        .filter((item) => item.name.toLowerCase().startsWith(term))
        .slice(0, 8);
      items.forEach((item) => rememberTagCategory(options.id, item.name, item.category));
      return items;
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
