import type {
  BooruAdapter,
  Credentials,
  PaginatedResult,
  SearchQuery,
  TagAutocompleteResult,
} from '../../types/api';
import type { Rating, TagCategory, UnifiedPost } from '../../types/post';
import { apiGet, apiRequest } from '../api/client';
import { buildSourceTags } from './query-tags';
import { rememberTagCategory, rememberTagMetadata, tagCategoryFromType } from './tag-categories';
import { safeHttpUrl } from '../safe-url';

const BASE_URL = 'https://danbooru.donmai.us';

interface DanbooruRawPost {
  id: number;
  rating: string;
  tag_string: string;
  tag_string_general: string;
  tag_string_artist: string;
  tag_string_copyright: string;
  tag_string_character: string;
  tag_string_meta: string;
  score: number;
  up_score: number;
  down_score: number;
  fav_count: number;
  is_favorited?: boolean;
  uploader_name?: string;
  uploader_id?: number;
  source: string;
  image_width: number;
  image_height: number;
  file_size: number;
  file_ext: string;
  preview_file_url?: string;
  large_file_url?: string;
  file_url?: string;
  md5: string;
  created_at: string;
  updated_at: string;
  parent_id: number | null;
  has_children: boolean;
  pool_ids?: number[];
  is_pending?: boolean;
  is_flagged?: boolean;
  is_deleted?: boolean;
  media_asset?: {
    duration?: number;
    variants?: Array<{ type?: string; url?: string; file_ext?: string; width?: number; height?: number }>;
  };
}

interface DanbooruAutocompleteItem {
  value?: string;
  label?: string;
  category?: number;
  post_count?: number;
}

function splitTags(value: string | undefined, category: TagCategory) {
  return (value ?? '').split(/\s+/).filter(Boolean).map((name) => ({ name, category }));
}

export function normalizePost(raw: DanbooruRawPost): UnifiedPost {
  const playableVariant = raw.media_asset?.variants
    ?.filter((variant) => ['mp4', 'webm'].includes(variant.file_ext?.toLowerCase() ?? '') && variant.url)
    .sort((left, right) => (right.width ?? 0) * (right.height ?? 0) - (left.width ?? 0) * (left.height ?? 0))[0];
  return {
    id: raw.id,
    source: 'danbooru',
    rating: (['g', 's', 'q', 'e'].includes(raw.rating) ? raw.rating : 's') as Rating,
    tags: [
      ...splitTags(raw.tag_string_artist, 'artist'),
      ...splitTags(raw.tag_string_character, 'character'),
      ...splitTags(raw.tag_string_copyright, 'copyright'),
      ...splitTags(raw.tag_string_general, 'general'),
      ...splitTags(raw.tag_string_meta, 'meta'),
    ],
    tagString: raw.tag_string ?? '',
    score: raw.score ?? 0,
    upScore: raw.up_score ?? 0,
    downScore: raw.down_score ?? 0,
    favCount: raw.fav_count ?? 0,
    isFavorited: raw.is_favorited ?? false,
    uploader: raw.uploader_name ?? 'unknown',
    uploaderId: raw.uploader_id,
    sourceUrl: safeHttpUrl(raw.source),
    imageWidth: raw.image_width ?? 0,
    imageHeight: raw.image_height ?? 0,
    fileSize: raw.file_size ?? 0,
    fileExt: raw.file_ext ?? '',
    previewUrl: safeHttpUrl(raw.preview_file_url ?? raw.large_file_url ?? raw.file_url),
    sampleUrl: safeHttpUrl(raw.large_file_url ?? raw.file_url ?? raw.preview_file_url),
    fileUrl: safeHttpUrl(raw.file_url ?? raw.large_file_url ?? raw.preview_file_url),
    playbackUrl: safeHttpUrl(playableVariant?.url ?? (['mp4', 'webm'].includes(raw.file_ext?.toLowerCase()) ? raw.file_url : undefined)) || undefined,
    duration: typeof raw.media_asset?.duration === 'number' ? raw.media_asset.duration : undefined,
    md5: raw.md5 ?? '',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    parentId: raw.parent_id,
    hasChildren: raw.has_children ?? false,
    status: raw.is_deleted ? 'deleted' : raw.is_flagged ? 'flagged' : raw.is_pending ? 'pending' : 'active',
    poolIds: raw.pool_ids ?? [],
    tagStringGeneral: raw.tag_string_general ?? '',
    tagStringArtist: raw.tag_string_artist ?? '',
    tagStringCopyright: raw.tag_string_copyright ?? '',
    tagStringCharacter: raw.tag_string_character ?? '',
    tagStringMeta: raw.tag_string_meta ?? '',
  };
}

async function rememberPostTagCategories(posts: UnifiedPost[]) {
  const categories = new Map(posts.flatMap((post) => post.tags).map((tag) => [tag.name, tag.category]));
  await rememberTagMetadata('danbooru', [...categories].map(([name, category]) => ({ name, category })));
}

export const danbooruAdapter: BooruAdapter = {
  id: 'danbooru',
  name: 'Danbooru',
  baseUrl: BASE_URL,
  supportsAuth: true,
  supportsWrites: true,
  async searchPosts(query: SearchQuery, credentials?: Credentials, signal?: AbortSignal): Promise<PaginatedResult<UnifiedPost>> {
    const limit = Math.min(Math.max(query.limit ?? 40, 1), 200);
    const page = Math.max(query.page ?? 1, 1);
    const url = new URL('/posts.json', BASE_URL);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('page', String(page));
    const terms = buildSourceTags('danbooru', query);
    if (terms) url.searchParams.set('tags', terms);

    const posts = await apiGet<DanbooruRawPost[]>(url, credentials, signal);
    const items = posts.map(normalizePost);
    void rememberPostTagCategories(items).catch(() => undefined);
    return { items, page, limit, hasMore: posts.length === limit };
  },

  async getPost(id: number, credentials?: Credentials, signal?: AbortSignal) {
    const url = new URL(`/posts/${id}.json`, BASE_URL);
    const post = normalizePost(await apiGet<DanbooruRawPost>(url, credentials, signal));
    void rememberPostTagCategories([post]).catch(() => undefined);
    return post;
  },

  async autocomplete(query: string, credentials?: Credentials, signal?: AbortSignal): Promise<TagAutocompleteResult[]> {
    if (query.trim().length < 2) return [];
    const url = new URL('/autocomplete.json', BASE_URL);
    url.searchParams.set('search[query]', query.trim());
    url.searchParams.set('search[type]', 'tag_query');
    url.searchParams.set('limit', '8');
    const items = await apiGet<DanbooruAutocompleteItem[]>(url, credentials, signal);
    return items.map((item) => ({
      name: item.value ?? item.label?.replace(/<[^>]+>/g, '') ?? '',
      label: item.label ?? item.value ?? '',
      category: tagCategoryFromType(item.category),
      postCount: item.post_count ?? 0,
    })).filter((item) => item.name).map((item) => { rememberTagCategory('danbooru', item.name, item.category); return item; });
  },
  async addFavorite(postId, credentials) { await apiRequest(new URL(`/favorites.json?post_id=${postId}`, BASE_URL), { method: 'POST', credentials }); },
  async removeFavorite(postId, credentials) { await apiRequest(new URL(`/favorites/${postId}.json`, BASE_URL), { method: 'DELETE', credentials }); },
  async vote(postId, score, credentials) { await apiRequest(new URL(`/posts/${postId}/votes.json`, BASE_URL), { method: 'POST', credentials, body: { score } }); },
  async unvote(postId, credentials) { await apiRequest(new URL(`/posts/${postId}/votes.json`, BASE_URL), { method: 'DELETE', credentials }); },
  async getComments(postId, credentials, signal) {
    const url = new URL('/comments.json', BASE_URL); url.searchParams.set('search[post_id]', String(postId));
    const comments = await apiGet<Array<{ id: number; post_id: number; creator_name?: string; body: string; score: number; created_at: string }>>(url, credentials, signal);
    return comments.map((comment) => ({ id: comment.id, postId: comment.post_id, creator: comment.creator_name ?? 'unknown', body: comment.body, score: comment.score, createdAt: comment.created_at }));
  },
  async createComment(postId, body, credentials) {
    const comment = await apiRequest<{ id: number; post_id: number; creator_name?: string; body: string; score: number; created_at: string }>(new URL('/comments.json', BASE_URL), { method: 'POST', credentials, body: { comment: { post_id: postId, body } } });
    return { id: comment.id, postId: comment.post_id, creator: comment.creator_name ?? credentials.username, body: comment.body, score: comment.score, createdAt: comment.created_at };
  },
  async getRelatedTags(tag, credentials, signal) {
    const url = new URL('/related_tag.json', BASE_URL);
    url.searchParams.set('query', tag);
    url.searchParams.set('category', 'all');
    const data = await apiGet<unknown>(url, credentials, signal);
    return normalizeRelatedTags(data);
  },
  async getPools(ids, credentials, signal) {
    if (!ids.length) return [];
    const url = new URL('/pools.json', BASE_URL);
    url.searchParams.set('search[id]', ids.join(','));
    url.searchParams.set('limit', String(ids.length));
    const pools = await apiGet<Array<{ id: number; name: string; post_count: number }>>(url, credentials, signal);
    return pools.map((pool) => ({ id: pool.id, name: pool.name, postCount: pool.post_count }));
  },
  async getChildren(postId, credentials, signal) {
    const url = new URL('/posts.json', BASE_URL);
    url.searchParams.set('tags', `parent:${postId}`);
    url.searchParams.set('limit', '12');
    const posts = await apiGet<DanbooruRawPost[]>(url, credentials, signal);
    return posts.map(normalizePost);
  },
};

export function normalizeRelatedTags(data: unknown) {
  const records = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? (Array.isArray((data as { related_tags?: unknown }).related_tags)
          ? (data as { related_tags: unknown[] }).related_tags
          : Array.isArray((data as { tags?: unknown }).tags) ? (data as { tags: unknown[] }).tags : [])
      : [];
  return records.flatMap((record) => {
    const name = Array.isArray(record) ? record[0] : record && typeof record === 'object' ? (record as { name?: unknown }).name : undefined;
    const category = Array.isArray(record) ? record[1] : record && typeof record === 'object' ? (record as { category?: unknown }).category : undefined;
    return typeof name === 'string' && name.trim() && typeof category === 'number' && Number.isFinite(category)
      ? [{ name, category }]
      : [];
  }).slice(0, 12);
}
