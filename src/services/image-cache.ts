import { createStore, del, entries, get, set } from 'idb-keyval';
import { safeHttpUrl } from './safe-url';
import { useSettingsStore } from '../stores/settings-store';

export const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000;
export const IMAGE_CACHE_MAX_BYTES = 512 * 1024 * 1024;
export const IMAGE_CACHE_MAX_ITEM_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const imageStore = createStore('danbooru-viewer-media', 'thumbnails');

interface CachedImage { blob: Blob; size: number; expiresAt: number; accessedAt: number }
interface ObjectUrlRecord { src: string; references: number; expiresAt: number; pendingRevocation: boolean }

const index = new Map<string, Omit<CachedImage, 'blob'>>();
const objectUrls = new Map<string, ObjectUrlRecord>();
const pendingImages = new Map<string, Promise<string>>();
let indexPromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();

function normalizeImageUrl(rawUrl: string) {
  const remote = safeHttpUrl(rawUrl);
  if (remote) return remote;
  if (typeof window === 'undefined' || !rawUrl.startsWith('/__image?')) return '';
  try {
    const proxy = new URL(rawUrl, window.location.origin);
    return proxy.pathname === '/__image' && safeHttpUrl(proxy.searchParams.get('url') ?? undefined) ? proxy.toString() : '';
  } catch { return ''; }
}

function revoke(url: string, force = false) {
  const record = objectUrls.get(url);
  if (!record) return;
  if (record.references > 0 && !force) { record.pendingRevocation = true; return; }
  URL.revokeObjectURL(record.src);
  objectUrls.delete(url);
}

async function initializeIndex() {
  if (!indexPromise) indexPromise = (async () => {
    const items = await entries<string, CachedImage>(imageStore);
    for (const [key, value] of items) index.set(key, { size: value.size ?? value.blob.size, expiresAt: value.expiresAt, accessedAt: value.accessedAt });
    await pruneIndex();
  })().catch(() => undefined);
  await indexPromise;
}

async function pruneIndex() {
  const now = Date.now();
  const maxBytes = useSettingsStore.getState().imageCacheLimitBytes ?? IMAGE_CACHE_MAX_BYTES;
  const ordered = [...index.entries()].sort((left, right) => right[1].accessedAt - left[1].accessedAt);
  let bytes = 0;
  let kept = 0;
  const removals: string[] = [];
  for (const [key, metadata] of ordered) {
    if (metadata.expiresAt <= now || kept >= MAX_ENTRIES || bytes + metadata.size > maxBytes) removals.push(key);
    else { bytes += metadata.size; kept += 1; }
  }
  await Promise.all(removals.map(async (key) => { index.delete(key); revoke(key); await del(key, imageStore); }));
}

function objectUrl(url: string, blob: Blob, expiresAt: number) {
  const current = objectUrls.get(url);
  if (current?.references) return current.src;
  revoke(url);
  const src = URL.createObjectURL(blob);
  objectUrls.set(url, { src, references: 0, expiresAt, pendingRevocation: false });
  return src;
}

async function resolveImageUrl(rawUrl: string): Promise<string> {
  const url = normalizeImageUrl(rawUrl);
  if (!url || typeof indexedDB === 'undefined') return url;
  await initializeIndex();
  const live = objectUrls.get(url);
  if (live && (live.expiresAt > Date.now() || live.references > 0)) return live.src;
  if (live) revoke(url);
  try {
    const cached = await get<CachedImage>(url, imageStore);
    if (cached && cached.expiresAt > Date.now()) {
      const accessedAt = Date.now();
      index.set(url, { size: cached.size ?? cached.blob.size, expiresAt: cached.expiresAt, accessedAt });
      void set(url, { ...cached, accessedAt }, imageStore).catch(() => undefined);
      return objectUrl(url, cached.blob, cached.expiresAt);
    }
    if (cached) { index.delete(url); await del(url, imageStore); }
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    if (blob.size > IMAGE_CACHE_MAX_ITEM_BYTES) return url;
    const value: CachedImage = { blob, size: blob.size, expiresAt: Date.now() + IMAGE_CACHE_TTL, accessedAt: Date.now() };
    writeQueue = writeQueue.then(async () => {
      await set(url, value, imageStore);
      index.set(url, { size: value.size, expiresAt: value.expiresAt, accessedAt: value.accessedAt });
      await pruneIndex();
    }).catch(() => undefined);
    await writeQueue;
    return objectUrl(url, blob, value.expiresAt);
  } catch {
    return url;
  }
}

export async function acquireCachedImage(url: string) {
  let request = pendingImages.get(url);
  if (!request) {
    request = resolveImageUrl(url);
    pendingImages.set(url, request);
    void request.finally(() => pendingImages.delete(url)).catch(() => undefined);
  }
  const src = await request;
  const normalizedUrl = normalizeImageUrl(url);
  const record = objectUrls.get(normalizedUrl);
  if (record && record.src === src) record.references += 1;
  let released = false;
  return { src, release: () => {
    if (released || !record) return;
    released = true;
    record.references -= 1;
    if (record.references <= 0) revoke(normalizedUrl, true);
  } };
}

export function imageCacheDiagnostics() {
  return {
    entries: index.size,
    bytes: [...index.values()].reduce((total, item) => total + item.size, 0),
    objectUrls: objectUrls.size,
    maxBytes: useSettingsStore.getState().imageCacheLimitBytes ?? IMAGE_CACHE_MAX_BYTES,
  };
}

useSettingsStore.subscribe((state, previousState) => {
  if (state.imageCacheLimitBytes === previousState.imageCacheLimitBytes || !indexPromise) return;
  writeQueue = writeQueue.then(pruneIndex).catch(() => undefined);
});

if (import.meta.env.MODE === 'e2e' && typeof window !== 'undefined') {
  (window as Window & { __danbooruImageCacheDiagnostics?: typeof imageCacheDiagnostics }).__danbooruImageCacheDiagnostics = imageCacheDiagnostics;
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => [...objectUrls.keys()].forEach((url) => revoke(url, true)));
