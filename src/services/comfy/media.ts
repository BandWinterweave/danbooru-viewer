import { unzipSync } from 'fflate';
import type { UnifiedPost } from '../../types/post';
import { ComfyClientError } from './client';

const DECODE_TIMEOUT_MS = 30_000;
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif']);

export interface NormalizedComfyMedia {
  blob: Blob;
  filename: string;
  mediaType: string;
  sourceUrl?: string;
  sourceQuality?: 'original' | 'sample' | 'preview' | 'local';
}

function cleanFilename(value: string, fallback = 'image.png') {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 180);
  return cleaned || fallback;
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ComfyClientError(message, 'media')), timeoutMs);
    void operation.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

function extension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function looksLikeZip(bytes: Uint8Array) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

function blobBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new ComfyClientError('Media could not be read', 'media'));
    reader.onerror = () => reject(reader.error ?? new ComfyClientError('Media could not be read', 'media'));
    reader.readAsArrayBuffer(blob);
  });
}

async function canvasToBlob(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type: 'image/png' });
  const element = canvas as HTMLCanvasElement;
  return new Promise((resolve, reject) => element.toBlob((blob: Blob | null) => blob ? resolve(blob) : reject(new ComfyClientError('Canvas could not encode the first frame', 'media')), 'image/png'));
}

async function bitmapFirstFrame(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') throw new ComfyClientError('This browser cannot decode the image first frame', 'media');
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!context) throw new ComfyClientError('Canvas is unavailable', 'media');
    context.drawImage(bitmap, 0, 0);
    return await canvasToBlob(canvas);
  } finally {
    bitmap.close();
  }
}

async function videoFirstFrame(blob: Blob): Promise<Blob> {
  if (typeof document === 'undefined') throw new ComfyClientError('Video first-frame decoding requires an open Viewer page', 'media');
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new ComfyClientError('Video could not be decoded', 'media'));
      video.load();
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context || !canvas.width || !canvas.height) throw new ComfyClientError('Video has no decodable frame', 'media');
    context.drawImage(video, 0, 0);
    return await canvasToBlob(canvas);
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function ugoiraFirstFrame(blob: Blob): Promise<Blob> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await blobBuffer(blob)));
  } catch {
    throw new ComfyClientError('Ugoira ZIP could not be decoded', 'media');
  }
  const first = Object.entries(files)
    .filter(([name, bytes]) => bytes.length > 0 && IMAGE_EXTENSIONS.has(extension(name)))
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))[0];
  if (!first) throw new ComfyClientError('Ugoira ZIP contains no supported image frames', 'media');
  return bitmapFirstFrame(new Blob([first[1]], { type: `image/${extension(first[0]).replace('jpg', 'jpeg')}` }));
}

export async function normalizeComfyMedia(blob: Blob, filename: string, timeoutMs = DECODE_TIMEOUT_MS): Promise<NormalizedComfyMedia> {
  const name = cleanFilename(filename);
  const ext = extension(name);
  const header = new Uint8Array(await blobBuffer(blob.slice(0, 8)));
  const zip = ext === 'zip' || blob.type.includes('zip') || looksLikeZip(header);
  const video = blob.type.startsWith('video/') || ['webm', 'mp4', 'mov', 'mkv'].includes(ext);
  const animated = ext === 'gif' || blob.type === 'image/gif';
  if (zip) return { blob: await withTimeout(ugoiraFirstFrame(blob), timeoutMs, 'Ugoira first-frame decoding timed out'), filename: `${name.replace(/\.zip$/i, '')}.png`, mediaType: 'image/png', sourceQuality: 'local' };
  if (video) return { blob: await withTimeout(videoFirstFrame(blob), timeoutMs, 'Video first-frame decoding timed out'), filename: `${name.replace(/\.[^.]+$/, '')}.png`, mediaType: 'image/png', sourceQuality: 'local' };
  if (animated) return { blob: await withTimeout(bitmapFirstFrame(blob), timeoutMs, 'GIF first-frame decoding timed out'), filename: `${name.replace(/\.gif$/i, '')}.png`, mediaType: 'image/png', sourceQuality: 'local' };
  if (!blob.type.startsWith('image/') && !IMAGE_EXTENSIONS.has(ext)) throw new ComfyClientError('Unsupported media type', 'media');
  return { blob, filename: name, mediaType: blob.type || `image/${ext.replace('jpg', 'jpeg')}`, sourceQuality: 'local' };
}

async function fetchBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new ComfyClientError(`Media request failed (${response.status})`, 'network', response.status);
  return response.blob();
}

export async function normalizePostMedia(post: UnifiedPost, signal?: AbortSignal): Promise<NormalizedComfyMedia> {
  const sources = [
    ['original', post.fileUrl],
    ['sample', post.sampleUrl],
    ['preview', post.previewUrl],
  ] as const;
  let lastError: unknown;
  for (const [quality, url] of sources) {
    if (!url) continue;
    try {
      const blob = await fetchBlob(url, signal);
      const normalized = await normalizeComfyMedia(blob, `${post.source}-${post.id}.${post.fileExt || extension(url) || 'png'}`);
      return { ...normalized, sourceUrl: url, sourceQuality: quality };
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new ComfyClientError('No post media is available', 'media');
}
