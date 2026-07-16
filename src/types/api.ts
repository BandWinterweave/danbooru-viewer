import type { BooruSource, PoolRecord, Rating, TagCategory, UnifiedPost } from './post';

export interface SearchQuery {
  tags?: string;
  page?: number;
  limit?: number;
  order?: string;
  scoreMin?: number;
  dateAfter?: string;
  minWidth?: number;
  minHeight?: number;
  ratings?: Rating[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface TagAutocompleteResult {
  name: string;
  label: string;
  category: TagCategory;
  postCount: number;
}

export interface RelatedTagRecord {
  name: string;
  category: number;
}

export interface Credentials {
  username: string;
  apiKey: string;
}

export interface ApiProxyRequest {
  type: 'API_REQUEST';
  payload: {
    requestId?: string;
    url: string;
    method?: 'GET' | 'POST' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
  };
}

export interface ApiProxyCancelRequest {
  type: 'API_CANCEL';
  payload: { requestId: string };
}

export interface ApiProxyResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export interface BooruAdapter {
  readonly id: BooruSource;
  readonly name: string;
  readonly baseUrl: string;
  readonly supportsAuth: boolean;
  readonly supportsWrites: boolean;
  searchPosts(query: SearchQuery, credentials?: Credentials, signal?: AbortSignal): Promise<PaginatedResult<UnifiedPost>>;
  getPost(id: number, credentials?: Credentials, signal?: AbortSignal): Promise<UnifiedPost>;
  autocomplete(query: string, credentials?: Credentials): Promise<TagAutocompleteResult[]>;
  addFavorite?(postId: number, credentials: Credentials): Promise<void>;
  removeFavorite?(postId: number, credentials: Credentials): Promise<void>;
  vote?(postId: number, score: 1 | -1, credentials: Credentials): Promise<void>;
  unvote?(postId: number, credentials: Credentials): Promise<void>;
  getComments?(postId: number, credentials?: Credentials, signal?: AbortSignal): Promise<CommentRecord[]>;
  createComment?(postId: number, body: string, credentials: Credentials): Promise<CommentRecord>;
  getRelatedTags?(tag: string, credentials?: Credentials, signal?: AbortSignal): Promise<RelatedTagRecord[]>;
  getPools?(ids: number[], credentials?: Credentials, signal?: AbortSignal): Promise<PoolRecord[]>;
  getChildren?(postId: number, credentials?: Credentials, signal?: AbortSignal): Promise<UnifiedPost[]>;
}

export interface CommentRecord {
  id: number;
  postId: number;
  creator: string;
  body: string;
  score: number;
  createdAt: string;
}
