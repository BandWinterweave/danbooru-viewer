import type { ApiProxyCancelRequest, ApiProxyFailureReason, ApiProxyRequest, ApiProxyResponse, Credentials } from '../../types/api';
import ky from 'ky';
import { getMessages } from '../../i18n/runtime-core';

export function authHeaders(credentials?: Credentials): Record<string, string> {
  if (!credentials?.username || !credentials.apiKey) return {};
  return { Authorization: `Basic ${btoa(`${credentials.username}:${credentials.apiKey}`)}` };
}

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly reason?: ApiProxyFailureReason) { super(message); }
}

const developmentProxy: Record<string, string> = {
  'https://danbooru.donmai.us': 'danbooru',
  'https://gelbooru.com': 'gelbooru',
  'https://safebooru.org': 'safebooru',
  'https://yande.re': 'yandere',
  'https://api.rule34.xxx': 'rule34',
};

const pendingGetRequests = new Map<string, Promise<unknown>>();

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  credentials?: Credentials;
  body?: URLSearchParams | Record<string, unknown>;
  signal?: AbortSignal;
}

export async function apiRequest<T>(url: URL, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const body = options.body instanceof URLSearchParams ? options.body.toString() : options.body ? JSON.stringify(options.body) : undefined;
  const headers: Record<string, string> = { ...authHeaders(options.credentials), ...(options.body instanceof URLSearchParams ? { 'Content-Type': 'application/x-www-form-urlencoded' } : options.body ? { 'Content-Type': 'application/json' } : {}) };
  const sensitive = Boolean(headers.Authorization) || url.searchParams.has('api_key') || url.searchParams.has('user_id');
  const requestKey = sensitive ? '' : `${method}:${url.toString()}`;
  if (method === 'GET' && !sensitive && !options.signal) {
    const pending = pendingGetRequests.get(requestKey);
    if (pending) return pending as Promise<T>;
  }
  const request = performRequest<T>(url, method, headers, body, options.signal);
  if (method === 'GET' && !sensitive && !options.signal) {
    pendingGetRequests.set(requestKey, request);
    void request.finally(() => pendingGetRequests.delete(requestKey)).catch(() => undefined);
  }
  return request;
}

async function performRequest<T>(url: URL, method: 'GET' | 'POST' | 'DELETE', headers: Record<string, string>, body?: string, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const requestId = signal ? crypto.randomUUID() : undefined;
  const message: ApiProxyRequest = {
    type: 'API_REQUEST',
    payload: { requestId, url: url.toString(), method, headers, body },
  };

  let response: ApiProxyResponse<T>;
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    const responsePromise = chrome.runtime.sendMessage<ApiProxyRequest, ApiProxyResponse<T>>(message);
    if (!signal || !requestId) response = await responsePromise;
    else response = await new Promise<ApiProxyResponse<T>>((resolve, reject) => {
      const abort = () => {
        signal.removeEventListener('abort', abort);
        const cancel: ApiProxyCancelRequest = { type: 'API_CANCEL', payload: { requestId } };
        void chrome.runtime.sendMessage(cancel).catch(() => undefined);
        reject(new DOMException(getMessages().domainActions.network.searchCancelled, 'AbortError'));
      };
      signal.addEventListener('abort', abort, { once: true });
      void responsePromise.then(
        (value) => { signal.removeEventListener('abort', abort); resolve(value); },
        (error) => { signal.removeEventListener('abort', abort); reject(error); },
      );
    });
  } else {
    const source = developmentProxy[url.origin];
    const requestUrl = source && typeof window !== 'undefined'
      ? new URL(`/__api/${source}${url.pathname}${url.search}`, window.location.origin)
      : url;
    const randomQuery = url.searchParams.get('tags')?.includes('order:random')
      || url.searchParams.get('tags')?.includes('sort:random')
      || false;
    const direct = await ky(requestUrl, { method, headers, body, signal, cache: randomQuery ? 'no-store' : 'default', throwHttpErrors: false, retry: { limit: method === 'GET' ? 2 : 0 }, timeout: 15_000 });
    const responseText = direct.ok && direct.status !== 204 ? await direct.text() : '';
    try {
      response = {
        ok: direct.ok,
        status: direct.status,
        data: direct.ok ? (direct.status === 204 ? null as T : direct.headers.get('content-type')?.includes('json') ? (responseText.trim() ? JSON.parse(responseText) as T : [] as T) : responseText as T) : undefined,
        error: direct.ok ? undefined : getMessages().domainActions.network.requestFailed(direct.status, ''),
        reason: direct.ok ? undefined : 'http',
      };
    } catch {
      response = { ok: false, status: direct.status, reason: 'invalid', error: getMessages().domainActions.network.invalidResponse(url.hostname) };
    }
  }

  if (!response.ok || response.data === undefined) {
    const network = getMessages().domainActions.network;
    const message = response.error || network.booruRequestFailed(response.status);
    throw new ApiRequestError(message, response.status, response.reason ?? (response.status === 0 ? 'network' : 'http'));
  }
  return response.data;
}

export function apiGet<T>(url: URL, credentials?: Credentials, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(url, { credentials, signal });
}
