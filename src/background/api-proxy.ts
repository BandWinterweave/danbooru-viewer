import type { ApiProxyRequest, ApiProxyResponse } from '../types/api';
import { actionMessages } from '../i18n/en-actions';

const ALLOWED_ORIGINS = new Set([
  'https://danbooru.donmai.us',
  'https://gelbooru.com',
  'https://safebooru.org',
  'https://yande.re',
  'https://api.rule34.xxx',
]);
const CACHE_TTL = 120_000;
const cache = new Map<string, { expiresAt: number; value: unknown }>();
const pending = new Map<string, Promise<ApiProxyResponse>>();

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
  const pendingRequest = cacheable ? pending.get(cacheKey) : undefined;
  if (pendingRequest) return pendingRequest;

  const request = performFetch(url, method, headers, body, cacheable, cacheKey);
  if (cacheable) {
    pending.set(cacheKey, request);
    void request.finally(() => pending.delete(cacheKey));
  }
  return request;
}

async function performFetch(url: URL, method: string, headers: Record<string, string>, body: string | undefined, cacheable: boolean, cacheKey: string): Promise<ApiProxyResponse> {
  try {
    const response = await fetch(url, { method, headers, body, credentials: url.origin === 'https://danbooru.donmai.us' ? 'include' : 'omit' });
    const contentType = response.headers.get('content-type') ?? '';
    const responseText = response.status === 204 ? '' : await response.text();
    const htmlResponse = contentType.includes('text/html') || /^\s*<!doctype html/i.test(responseText);
    if (htmlResponse) {
      const cloudflare = url.origin === 'https://danbooru.donmai.us' && /Just a moment|challenges\.cloudflare\.com|cf-chl-/i.test(responseText);
      if (cloudflare) {
        const tabResponse = await fetchFromDanbooruTab(url, method, headers, body);
        if (tabResponse) {
          const result = finalizeResponse(url, method, cacheable, cacheKey, tabResponse.status, tabResponse.statusText, tabResponse.contentType, tabResponse.text);
          if (result.ok) return result;
        }
        const navigationResponse = await navigateDanbooruApi(url, method, headers);
        if (navigationResponse) return finalizeResponse(url, method, cacheable, cacheKey, navigationResponse.status, navigationResponse.statusText, navigationResponse.contentType, navigationResponse.text);
      }
      return { ok: false, status: response.status, error: cloudflare ? actionMessages.network.danbooruChallenge : actionMessages.network.unexpectedHtml(url.hostname) };
    }
    return finalizeResponse(url, method, cacheable, cacheKey, response.status, response.statusText, contentType, responseText);
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : 'Network request failed' };
  }
}

interface TabFetchResponse { status: number; statusText: string; contentType: string; text: string }

function finalizeResponse(url: URL, method: string, cacheable: boolean, cacheKey: string, status: number, statusText: string, contentType: string, responseText: string): ApiProxyResponse {
  const htmlResponse = contentType.includes('text/html') || /^\s*<!doctype html/i.test(responseText);
  if (htmlResponse) {
    const cloudflare = url.origin === 'https://danbooru.donmai.us' && /Just a moment|challenges\.cloudflare\.com|cf-chl-/i.test(responseText);
    return { ok: false, status, error: cloudflare ? actionMessages.network.danbooruChallenge : actionMessages.network.unexpectedHtml(url.hostname) };
  }
  if (status < 200 || status >= 300) return { ok: false, status, error: responseText.slice(0, 500) || actionMessages.network.requestFailed(status, statusText) };
  try {
    const data: unknown = status === 204 ? null : contentType.includes('json') ? (responseText.trim() ? JSON.parse(responseText) : []) : responseText;
    if (cacheable) cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL, value: data });
    if (method !== 'GET') cache.clear();
    return { ok: true, status, data };
  } catch {
    return { ok: false, status, error: actionMessages.network.unexpectedHtml(url.hostname) };
  }
}

async function waitForTab(tabId: number) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === 'complete') return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Danbooru tab did not finish loading')); }, 15_000);
    const listener = (updatedId: number, changeInfo: chrome.tabs.TabChangeInfo) => { if (updatedId === tabId && changeInfo.status === 'complete') { cleanup(); resolve(); } };
    const cleanup = () => { clearTimeout(timeout); chrome.tabs.onUpdated.removeListener(listener); };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function fetchFromDanbooruTab(url: URL, method: string, headers: Record<string, string>, body?: string): Promise<TabFetchResponse | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) return null;
  if (headers.Authorization) return null;
  let createdTabId: number | undefined;
  try {
    const existing = await chrome.tabs.query({ url: ['https://danbooru.donmai.us/*'] });
    let tabId = existing.find((tab) => typeof tab.id === 'number')?.id;
    if (tabId === undefined) {
      const tab = await chrome.tabs.create({ url: 'https://danbooru.donmai.us/', active: false });
      tabId = tab.id;
      createdTabId = tabId;
    }
    if (tabId === undefined) return null;
    await waitForTab(tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [url.toString(), method, Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'authorization')), body],
      func: async (requestUrl: string, requestMethod: string, requestHeaders: Record<string, string>, requestBody?: string) => {
        const response = await fetch(requestUrl, { method: requestMethod, headers: requestHeaders, body: requestBody, credentials: 'include' });
        return { status: response.status, statusText: response.statusText, contentType: response.headers.get('content-type') ?? '', text: response.status === 204 ? '' : await response.text() };
      },
    });
    return result[0]?.result ?? null;
  } catch {
    return null;
  } finally {
    if (createdTabId !== undefined) void chrome.tabs.remove(createdTabId).catch(() => undefined);
  }
}

async function navigateDanbooruApi(url: URL, method: string, headers: Record<string, string>): Promise<TabFetchResponse | null> {
  if (method !== 'GET' || headers.Authorization || typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) return null;
  let tabId: number | undefined;
  try {
    const tab = await chrome.tabs.create({ url: url.toString(), active: false });
    tabId = tab.id;
    if (tabId === undefined) return null;
    await waitForTab(tabId);
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: () => document.body?.innerText ?? document.documentElement?.textContent ?? '',
    });
    const text = result[0]?.result?.trim() ?? '';
    const json = text.startsWith('[') || text.startsWith('{');
    return { status: json ? 200 : 403, statusText: json ? 'OK' : 'Forbidden', contentType: json ? 'application/json' : 'text/html', text };
  } catch {
    return null;
  } finally {
    if (tabId !== undefined) void chrome.tabs.remove(tabId).catch(() => undefined);
  }
}
