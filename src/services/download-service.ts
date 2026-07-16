import { createStore, get, set } from 'idb-keyval';
import { actionMessages } from '../i18n/en-actions';
import type { UnifiedPost } from '../types/post';
import { displayImageUrl } from './api/image-url';

export type DownloadSize = 'playback' | 'full' | 'sample' | 'preview';

export interface DownloadHistoryEntry {
  key: string;
  md5: string;
  source: string;
  postId: number;
  downloadedAt: string;
}

const historyStore = createStore('danbooru-viewer', 'download-history');
const memoryHistory = new Map<string, DownloadHistoryEntry>();

function historyKey(post: UnifiedPost) { return post.md5 || `${post.source}:${post.id}`; }

export function resolveDownloadUrl(post: UnifiedPost, size: DownloadSize) {
  if (size === 'playback') return post.playbackUrl || post.fileUrl || post.sampleUrl || post.previewUrl;
  if (size === 'preview') return post.previewUrl || post.sampleUrl || post.fileUrl;
  if (size === 'sample') return post.sampleUrl || post.fileUrl || post.previewUrl;
  return post.fileUrl || post.sampleUrl || post.previewUrl;
}

export function buildDownloadFilename(post: UnifiedPost, rule: string, size: DownloadSize = 'full') {
  const url = resolveDownloadUrl(post, size);
  const extension = (size === 'full' ? post.fileExt : url.split('.').at(-1)?.split(/[?#]/)[0]) || post.fileExt || 'jpg';
  const artist = post.tags.find((tag) => tag.category === 'artist')?.name ?? 'unknown-artist';
  const values: Record<string, string> = { id: String(post.id), tags: post.tagString, artist, rating: post.rating, source: post.source, size };
  const rendered = rule.replace(/\{(id|tags|artist|rating|source|size)\}/g, (_, key: string) => values[key]);
  const cleaned = rendered.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 180) || `${post.source}-${post.id}`;
  return `Danbooru Viewer/${cleaned}.${extension}`;
}

export async function getDownloadHistory(post: UnifiedPost): Promise<DownloadHistoryEntry | undefined> {
  const key = historyKey(post);
  if (typeof indexedDB === 'undefined') return memoryHistory.get(key);
  return get<DownloadHistoryEntry>(key, historyStore);
}

export async function hasDownloaded(post: UnifiedPost) { return Boolean(await getDownloadHistory(post)); }

async function recordDownload(post: UnifiedPost) {
  const key = historyKey(post);
  const entry = { key, md5: post.md5, source: post.source, postId: post.id, downloadedAt: new Date().toISOString() };
  if (typeof indexedDB === 'undefined') memoryHistory.set(key, entry);
  else await set(key, entry, historyStore);
  window.dispatchEvent(new CustomEvent('danbooru-download-recorded', { detail: key }));
}

export async function downloadPost(post: UnifiedPost, size: DownloadSize = 'full', rule = '{source}-{id}-{artist}'): Promise<void> {
  const url = resolveDownloadUrl(post, size);
  if (!url) throw new Error(actionMessages.download.unavailable);
  const filename = buildDownloadFilename(post, rule, size);
  if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.downloads) {
    await chrome.downloads.download({ url, filename, saveAs: false });
  } else {
    const response = await fetch(displayImageUrl(url));
    if (!response.ok) throw new Error(actionMessages.download.imageFailed(response.status));
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename.split('/').at(-1) ?? `${post.id}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  await recordDownload(post);
}

export async function downloadPosts(posts: UnifiedPost[], size: DownloadSize = 'full', rule = '{source}-{id}-{artist}'): Promise<void> {
  for (const post of posts) await downloadPost(post, size, rule);
}
