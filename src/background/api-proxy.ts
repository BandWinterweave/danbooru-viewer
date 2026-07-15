import type { ApiProxyRequest, ApiProxyResponse } from '../types/api';

const ALLOWED_ORIGINS = new Set([
  'https://danbooru.donmai.us',
  'https://gelbooru.com',
  'https://safebooru.org',
  'https://yande.re',
  'https://api.rule34.xxx',
]);
const CACHE_TTL = 120_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();

export async function proxyRequest(message: ApiProxyRequest): Promise<ApiProxyResponse> {
  const { url: rawUrl, method = 'GET', headers = {}, body } = message.payload;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, status: 400, error: 'Invalid request URL' };
  }

  if (!ALLOWED_ORIGINS.has(url.origin) || url.protocol !== 'https:') {
    return { ok: false, status: 403, error: 'Host is not allowed' };
  }
  if (!['GET', 'POST', 'DELETE'].includes(method)) return { ok: false, status: 405, error: 'Method is not allowed' };

  const cacheKey = `${method}:${url.toString()}:${headers.Authorization ? 'authenticated' : 'public'}`;
  const cacheable = method === 'GET' && !headers.Authorization;
  const cached = cacheable ? cache.get(cacheKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) return { ok: true, status: 200, data: cached.value };

  try {
    const response = await fetch(url, { method, headers, body, credentials: 'omit' });
    if (!response.ok) {
      return { ok: false, status: response.status, error: (await response.text()).slice(0, 500) || response.statusText };
    }
    const contentType = response.headers.get('content-type') ?? '';
    const responseText = response.status === 204 ? '' : await response.text();
    const data: unknown = response.status === 204 ? null : contentType.includes('json') ? (responseText.trim() ? JSON.parse(responseText) : []) : responseText;
    if (cacheable) cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL, value: data });
    if (method !== 'GET') cache.clear();
    return { ok: true, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : 'Network request failed' };
  }
}
