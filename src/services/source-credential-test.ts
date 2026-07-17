import type { Credentials } from '../types/api';
import type { BooruSource } from '../types/post';
import { ApiRequestError, apiRequest } from './api/client';

export type SourceTestCode =
  | 'credentials_missing'
  | 'authentication_failed'
  | 'permission_denied'
  | 'source_unavailable'
  | 'rate_limited'
  | 'timeout'
  | 'invalid_response'
  | 'source_reachable'
  | 'source_reachable_public'
  | 'source_reachable_unverified';

export interface SourceTestResult { code: SourceTestCode }
type SourceTestRequester = <T>(url: URL, options?: { credentials?: Credentials }) => Promise<T>;

function complete(credentials: Credentials): boolean {
  return Boolean(credentials.username.trim() && credentials.apiKey.trim());
}

function gelbooruUrl(origin: string, credentials?: Credentials) {
  const url = new URL('/index.php', origin);
  url.searchParams.set('page', 'dapi');
  url.searchParams.set('s', 'post');
  url.searchParams.set('q', 'index');
  url.searchParams.set('json', '1');
  url.searchParams.set('limit', '1');
  url.searchParams.set('pid', '0');
  if (credentials) {
    url.searchParams.set('user_id', credentials.username.trim());
    url.searchParams.set('api_key', credentials.apiKey.trim());
  }
  return url;
}

function postCollection(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && Array.isArray((value as { post?: unknown }).post)) return (value as { post: unknown[] }).post;
  return null;
}

function hasPost(value: unknown): boolean {
  const posts = postCollection(value);
  return Boolean(posts?.length && posts.some((post) => post && typeof post === 'object' && !Array.isArray(post)));
}

function classifyFailure(error: unknown): SourceTestResult {
  if (error instanceof ApiRequestError) {
    if (error.reason === 'timeout' || error.status === 408) return { code: 'timeout' };
    if (error.status === 401) return { code: 'authentication_failed' };
    if (error.status === 403) return { code: 'permission_denied' };
    if (error.status === 429) return { code: 'rate_limited' };
    if (error.status >= 500 || error.status === 0) return { code: 'source_unavailable' };
    return { code: 'invalid_response' };
  }
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) return { code: 'timeout' };
  if (error instanceof SyntaxError) return { code: 'invalid_response' };
  return { code: 'source_unavailable' };
}

export async function testSourceAccess(source: BooruSource, credentials: Credentials, request: SourceTestRequester = apiRequest): Promise<SourceTestResult> {
  if ((source === 'danbooru' || source === 'gelbooru' || source === 'rule34') && !complete(credentials)) return { code: 'credentials_missing' };

  try {
    if (source === 'danbooru') {
      const profile = await request<unknown>(new URL('/profile.json', 'https://danbooru.donmai.us'), { credentials });
      if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return { code: 'invalid_response' };
      const record = profile as { name?: unknown; user?: { name?: unknown } };
      const name = record.name ?? record.user?.name;
      if (name !== undefined && (typeof name !== 'string' || name.trim() !== credentials.username.trim())) return { code: 'authentication_failed' };
      return { code: 'source_reachable' };
    }
    if (source === 'gelbooru' || source === 'rule34') {
      const origin = source === 'gelbooru' ? 'https://gelbooru.com' : 'https://api.rule34.xxx';
      const response = await request<unknown>(gelbooruUrl(origin, credentials));
      if (typeof response === 'string' && /authentication|api[_ ]?key|user[_ ]?id/i.test(response)) return { code: 'authentication_failed' };
      return hasPost(response) ? { code: 'source_reachable' } : { code: 'invalid_response' };
    }
    if (source === 'safebooru') {
      const response = await request<unknown>(gelbooruUrl('https://safebooru.org'));
      return postCollection(response) ? { code: 'source_reachable_public' } : { code: 'invalid_response' };
    }
    const response = await request<unknown>(new URL('/post.json?limit=1&page=1', 'https://yande.re'));
    return Array.isArray(response) ? { code: 'source_reachable_unverified' } : { code: 'invalid_response' };
  } catch (error) {
    return classifyFailure(error);
  }
}
