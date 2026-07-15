import type { ApiProxyRequest, ApiProxyResponse, Credentials } from '../../types/api';
import ky from 'ky';

export function authHeaders(credentials?: Credentials): Record<string, string> {
  if (!credentials?.username || !credentials.apiKey) return {};
  return { Authorization: `Basic ${btoa(`${credentials.username}:${credentials.apiKey}`)}` };
}

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

const developmentProxy: Record<string, string> = {
  'https://danbooru.donmai.us': 'danbooru',
  'https://gelbooru.com': 'gelbooru',
  'https://safebooru.org': 'safebooru',
  'https://yande.re': 'yandere',
  'https://api.rule34.xxx': 'rule34',
};

export async function apiRequest<T>(url: URL, options: { method?: 'GET' | 'POST' | 'DELETE'; credentials?: Credentials; body?: URLSearchParams | Record<string, unknown> } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const body = options.body instanceof URLSearchParams ? options.body.toString() : options.body ? JSON.stringify(options.body) : undefined;
  const headers = { ...authHeaders(options.credentials), ...(options.body instanceof URLSearchParams ? { 'Content-Type': 'application/x-www-form-urlencoded' } : options.body ? { 'Content-Type': 'application/json' } : {}) };
  const message: ApiProxyRequest = {
    type: 'API_REQUEST',
    payload: { url: url.toString(), method, headers, body },
  };

  let response: ApiProxyResponse<T>;
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    response = await chrome.runtime.sendMessage<ApiProxyRequest, ApiProxyResponse<T>>(message);
  } else {
    const source = developmentProxy[url.origin];
    const requestUrl = source && typeof window !== 'undefined'
      ? new URL(`/__api/${source}${url.pathname}${url.search}`, window.location.origin)
      : url;
    const direct = await ky(requestUrl, { method, headers, body, throwHttpErrors: false, retry: { limit: method === 'GET' ? 2 : 0 }, timeout: 15_000 });
    response = {
      ok: direct.ok,
      status: direct.status,
      data: direct.ok ? (direct.status === 204 ? null as T : direct.headers.get('content-type')?.includes('json') ? await direct.json() as T : await direct.text() as T) : undefined,
      error: direct.ok ? undefined : await direct.text(),
    };
  }

  if (!response.ok || response.data === undefined) {
    throw new ApiRequestError(response.error || `Booru request failed (${response.status})`, response.status);
  }
  return response.data;
}

export function apiGet<T>(url: URL, credentials?: Credentials): Promise<T> {
  return apiRequest<T>(url, { credentials });
}
