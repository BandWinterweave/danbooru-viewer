import { createStore, del, entries, get, set } from 'idb-keyval';

const TTL = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 240;
const imageStore = createStore('danbooru-viewer-media', 'thumbnails');
const objectUrls = new Map<string, string>();
const pendingImages = new Map<string, Promise<string>>();

interface CachedImage { blob: Blob; expiresAt: number; accessedAt: number }

async function prune() {
  const items = await entries<string, CachedImage>(imageStore);
  const now = Date.now();
  const expired = items.filter(([, value]) => value.expiresAt <= now);
  await Promise.all(expired.map(([key]) => del(key, imageStore)));
  const current = items.filter(([, value]) => value.expiresAt > now).sort((left, right) => right[1].accessedAt - left[1].accessedAt);
  await Promise.all(current.slice(MAX_ENTRIES).map(([key]) => del(key, imageStore)));
}

async function resolveImageUrl(url: string): Promise<string> {
  if (!url || typeof indexedDB === 'undefined') return url;
  const existingObjectUrl = objectUrls.get(url);
  if (existingObjectUrl) return existingObjectUrl;
  try {
    const cached = await get<CachedImage>(url, imageStore);
    if (cached && cached.expiresAt > Date.now()) {
      cached.accessedAt = Date.now();
      void set(url, cached, imageStore);
      const objectUrl = URL.createObjectURL(cached.blob);
      objectUrls.set(url, objectUrl);
      return objectUrl;
    }
    if (cached) await del(url, imageStore);
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    await set(url, { blob, expiresAt: Date.now() + TTL, accessedAt: Date.now() } satisfies CachedImage, imageStore);
    await prune();
    const objectUrl = URL.createObjectURL(blob);
    objectUrls.set(url, objectUrl);
    return objectUrl;
  } catch {
    return url;
  }
}

export function cachedImageUrl(url: string): Promise<string> {
  const existing = pendingImages.get(url);
  if (existing) return existing;
  const request = resolveImageUrl(url);
  pendingImages.set(url, request);
  void request.finally(() => pendingImages.delete(url)).catch(() => undefined);
  return request;
}

export function cachedObjectUrl(url: string) { return objectUrls.get(url); }
