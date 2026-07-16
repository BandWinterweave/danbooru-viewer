import type { ApiProxyResponse } from '../types/api';
import { actionMessages } from '../i18n/en-actions';

const ALLOWED_ORIGINS = new Set([
  'https://danbooru.donmai.us',
  'https://gelbooru.com',
  'https://safebooru.org',
  'https://yande.re',
  'https://api.rule34.xxx',
]);
const CACHE_TTL = 120_000;
const CACHE_MAX_ENTRIES = 200;
const CACHE_MAX_BYTES = 16 * 1024 * 1024;
const REQUEST_TIMEOUT = 15_000;
const MAX_BODY_LENGTH = 1_000_000;
const ALLOWED_HEADERS = new Set(['accept', 'authorization', 'content-type']);
const cache = new Map<string, { expiresAt: number; value: unknown; bytes: number }>();
const pending = new Map<string, Promise<ApiProxyResponse>>();
const activeRequests = new Map<string, AbortController>();
let cacheBytes = 0;
let cacheOperations = 0;

function maintainCache() {
  cacheOperations += 1;
  if (cacheOperations % 64 !== 0) return;
  const now = Date.now();
  for (const [key, value] of cache) {
    if (value.expiresAt > now) continue;
    cache.delete(key);
    cacheBytes -= value.bytes;
  }
}

function cacheGet(key: string) {
  const cached = cache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    cacheBytes -= cached.bytes;
    return undefined;
  }
  cache.delete(key);
  cache.set(key, cached);
  return cached.value;
}

function cacheSet(key: string, value: unknown, bytes: number) {
  const previous = cache.get(key);
  if (previous) cacheBytes -= previous.bytes;
  cache.delete(key);
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL, value, bytes });
  cacheBytes += bytes;
  while (cache.size > CACHE_MAX_ENTRIES || cacheBytes > CACHE_MAX_BYTES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const oldest = cache.get(oldestKey)!;
    cache.delete(oldestKey);
    cacheBytes -= oldest.bytes;
  }
}

function clearCache() { cache.clear(); cacheBytes = 0; }

export function apiCacheDiagnostics() { return { entries: cache.size, bytes: cacheBytes, maxEntries: CACHE_MAX_ENTRIES, maxBytes: CACHE_MAX_BYTES }; }

function invalid(status: number, error: string): ApiProxyResponse { return { ok: false, status, error }; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateMessage(message: unknown) {
  if (!isRecord(message) || message.type !== 'API_REQUEST' || !isRecord(message.payload)) return invalid(400, 'Invalid API request payload');
  const { requestId, url: rawUrl, method: rawMethod = 'GET', headers: rawHeaders = {}, body } = message.payload;
  if (requestId !== undefined && (typeof requestId !== 'string' || requestId.length > 128)) return invalid(400, 'Invalid request ID');
  if (typeof rawUrl !== 'string' || rawUrl.length > 8192) return invalid(400, 'Invalid request URL');
  if (rawMethod !== 'GET' && rawMethod !== 'POST' && rawMethod !== 'DELETE') return invalid(405, 'Method is not allowed');
  if (!isRecord(rawHeaders)) return invalid(400, 'Invalid request headers');
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return invalid(400, 'Invalid request URL');
  }
  if (!ALLOWED_ORIGINS.has(url.origin) || url.protocol !== 'https:' || url.username || url.password) return invalid(403, 'Host is not allowed');
  const methods = url.origin === 'https://danbooru.donmai.us' ? ['GET', 'POST', 'DELETE'] : url.origin === 'https://gelbooru.com' ? ['GET', 'POST'] : ['GET'];
  if (!methods.includes(rawMethod)) return invalid(405, 'Method is not allowed');
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(rawHeaders)) {
    const normalized = name.toLowerCase();
    if (!ALLOWED_HEADERS.has(normalized) || typeof value !== 'string' || value.length > 4096 || /[\r\n]/.test(value)) return invalid(400, 'Invalid request headers');
    headers[normalized === 'authorization' ? 'Authorization' : normalized === 'content-type' ? 'Content-Type' : 'Accept'] = value;
  }
  if (headers.Authorization && (url.origin !== 'https://danbooru.donmai.us' || !/^Basic [A-Za-z0-9+/]+=*$/.test(headers.Authorization))) return invalid(400, 'Invalid authorization header');
  if (body !== undefined && (typeof body !== 'string' || body.length > MAX_BODY_LENGTH || rawMethod !== 'POST')) return invalid(400, 'Invalid request body');
  if (body && !['application/json', 'application/x-www-form-urlencoded'].some((type) => headers['Content-Type']?.toLowerCase().startsWith(type))) return invalid(400, 'Invalid request content type');
  return { requestId: requestId as string | undefined, url, method: rawMethod, headers, body: body as string | undefined };
}

export function cancelProxyRequest(requestId: string) {
  const controller = activeRequests.get(requestId);
  if (!controller) return false;
  controller.abort('cancelled');
  return true;
}

export async function proxyRequest(message: unknown): Promise<ApiProxyResponse> {
  maintainCache();
  const validated = validateMessage(message);
  if ('ok' in validated) return validated;
  const { requestId, url, method, headers, body } = validated;

  const randomQuery = url.searchParams.get('tags')?.includes('order:random')
    || url.searchParams.get('tags')?.includes('sort:random')
    || false;
  const sensitiveQuery = url.searchParams.has('api_key') || url.searchParams.has('user_id');
  const cacheable = method === 'GET' && !headers.Authorization && !sensitiveQuery && !randomQuery;
  const cacheKey = cacheable ? `${method}:${url.toString()}` : '';
  const cached = cacheable ? cacheGet(cacheKey) : undefined;
  if (cached !== undefined) return { ok: true, status: 200, data: cached };
  const pendingRequest = cacheable && !requestId ? pending.get(cacheKey) : undefined;
  if (pendingRequest) return pendingRequest;

  const controller = new AbortController();
  if (requestId) activeRequests.set(requestId, controller);
  const timeout = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT);
  const request = performFetch(url, method, headers, body, cacheable, cacheKey, controller.signal).finally(() => {
    clearTimeout(timeout);
    if (requestId) activeRequests.delete(requestId);
  });
  if (cacheable && !requestId) {
    pending.set(cacheKey, request);
    void request.finally(() => pending.delete(cacheKey)).catch(() => undefined);
  }
  return request;
}

async function performFetch(url: URL, method: string, headers: Record<string, string>, body: string | undefined, cacheable: boolean, cacheKey: string, signal: AbortSignal): Promise<ApiProxyResponse> {
  try {
    const response = await fetch(url, { method, headers, body, signal, cache: cacheable ? 'default' : 'no-store', credentials: url.origin === 'https://danbooru.donmai.us' && method === 'GET' && !headers.Authorization ? 'include' : 'omit' });
    if (response.redirected && response.url && new URL(response.url).origin !== url.origin) return invalid(403, 'Redirect host is not allowed');
    const contentType = response.headers.get('content-type') ?? '';
    const responseText = response.status === 204 ? '' : await response.text();
    const htmlResponse = contentType.includes('text/html') || /^\s*<!doctype html/i.test(responseText);
    if (htmlResponse) {
      const cloudflare = url.origin === 'https://danbooru.donmai.us' && /Just a moment|challenges\.cloudflare\.com|cf-chl-/i.test(responseText);
      if (cloudflare) {
        const tabResponse = await fetchFromDanbooruTab(url, method, headers, body, signal);
        if (tabResponse) {
          const result = finalizeResponse(url, method, cacheable, cacheKey, tabResponse.status, tabResponse.statusText, tabResponse.contentType, tabResponse.text);
          if (result.ok) return result;
        }
        const navigationResponse = await navigateDanbooruApi(url, method, headers, signal);
        if (navigationResponse) return finalizeResponse(url, method, cacheable, cacheKey, navigationResponse.status, navigationResponse.statusText, navigationResponse.contentType, navigationResponse.text);
      }
      return { ok: false, status: response.status, error: cloudflare ? actionMessages.network.danbooruChallenge : actionMessages.network.unexpectedHtml(url.hostname) };
    }
    return finalizeResponse(url, method, cacheable, cacheKey, response.status, response.statusText, contentType, responseText);
  } catch (error) {
    const aborted = signal.aborted || (error instanceof DOMException && error.name === 'AbortError');
    return invalid(0, aborted ? signal.reason === 'cancelled' ? 'Request cancelled' : 'Request timed out' : 'Network request failed');
  }
}

interface TabFetchResponse { status: number; statusText: string; contentType: string; text: string }

function finalizeResponse(url: URL, method: string, cacheable: boolean, cacheKey: string, status: number, statusText: string, contentType: string, responseText: string): ApiProxyResponse {
  const htmlResponse = contentType.includes('text/html') || /^\s*<!doctype html/i.test(responseText);
  if (htmlResponse) {
    const cloudflare = url.origin === 'https://danbooru.donmai.us' && /Just a moment|challenges\.cloudflare\.com|cf-chl-/i.test(responseText);
    return { ok: false, status, error: cloudflare ? actionMessages.network.danbooruChallenge : actionMessages.network.unexpectedHtml(url.hostname) };
  }
  if (status < 200 || status >= 300) return { ok: false, status, error: actionMessages.network.requestFailed(status, statusText) };
  try {
    const data: unknown = status === 204 ? null : contentType.includes('json') ? (responseText.trim() ? JSON.parse(responseText) : []) : responseText;
    if (cacheable) cacheSet(cacheKey, data, new TextEncoder().encode(responseText).byteLength);
    if (method !== 'GET') clearCache();
    return { ok: true, status, data };
  } catch {
    return { ok: false, status, error: actionMessages.network.unexpectedHtml(url.hostname) };
  }
}

function abortError() { return new DOMException('Request timed out', 'AbortError'); }

async function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw abortError();
  return new Promise<T>((resolve, reject) => {
    const abort = () => { cleanup(); reject(abortError()); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    void promise.then((value) => { cleanup(); resolve(value); }, (error) => { cleanup(); reject(error); });
  });
}

async function waitForTab(tabId: number, signal: AbortSignal) {
  const tab = await withAbort(chrome.tabs.get(tabId), signal);
  if (tab.status === 'complete') return;
  await new Promise<void>((resolve, reject) => {
    const abort = () => { cleanup(); reject(abortError()); };
    const listener = (updatedId: number, changeInfo: chrome.tabs.TabChangeInfo) => { if (updatedId === tabId && changeInfo.status === 'complete') { cleanup(); resolve(); } };
    const cleanup = () => { signal.removeEventListener('abort', abort); chrome.tabs.onUpdated.removeListener(listener); };
    signal.addEventListener('abort', abort, { once: true });
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function fetchFromDanbooruTab(url: URL, method: string, headers: Record<string, string>, body: string | undefined, signal: AbortSignal): Promise<TabFetchResponse | null> {
  if (method !== 'GET' || typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) return null;
  if (headers.Authorization) return null;
  let createdTabId: number | undefined;
  try {
    const existing = await withAbort(chrome.tabs.query({ url: ['https://danbooru.donmai.us/*'] }), signal);
    let tabId = existing.find((tab) => typeof tab.id === 'number')?.id;
    if (tabId === undefined) {
      const tab = await withAbort(chrome.tabs.create({ url: 'https://danbooru.donmai.us/', active: false }), signal);
      tabId = tab.id;
      createdTabId = tabId;
    }
    if (tabId === undefined) return null;
    await waitForTab(tabId, signal);
    const result = await withAbort(chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [url.toString(), method, Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'authorization')), body],
      func: async (requestUrl: string, requestMethod: string, requestHeaders: Record<string, string>, requestBody?: string) => {
        const response = await fetch(requestUrl, { method: requestMethod, headers: requestHeaders, body: requestBody, credentials: 'include' });
        return { status: response.status, statusText: response.statusText, contentType: response.headers.get('content-type') ?? '', text: response.status === 204 ? '' : await response.text() };
      },
    }), signal);
    return result[0]?.result ?? null;
  } catch {
    if (signal.aborted) throw abortError();
    return null;
  } finally {
    if (createdTabId !== undefined) void chrome.tabs.remove(createdTabId).catch(() => undefined);
  }
}

async function navigateDanbooruApi(url: URL, method: string, headers: Record<string, string>, signal: AbortSignal): Promise<TabFetchResponse | null> {
  if (method !== 'GET' || headers.Authorization || typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) return null;
  let tabId: number | undefined;
  try {
    const tab = await withAbort(chrome.tabs.create({ url: url.toString(), active: false }), signal);
    tabId = tab.id;
    if (tabId === undefined) return null;
    await waitForTab(tabId, signal);
    const result = await withAbort(chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: () => document.body?.innerText ?? document.documentElement?.textContent ?? '',
    }), signal);
    const text = result[0]?.result?.trim() ?? '';
    const json = text.startsWith('[') || text.startsWith('{');
    return { status: json ? 200 : 403, statusText: json ? 'OK' : 'Forbidden', contentType: json ? 'application/json' : 'text/html', text };
  } catch {
    if (signal.aborted) throw abortError();
    return null;
  } finally {
    if (tabId !== undefined) void chrome.tabs.remove(tabId).catch(() => undefined);
  }
}
