import { parseComfyAddress } from '../services/comfy/client';
import { ComfyManager } from '../services/comfy/manager';
import type { ComfyRequestMessage, ComfyResponse, ComfySettingsSnapshot, ComfyStateSnapshot } from '../services/comfy/types';
import type { TagCategory, UnifiedPost } from '../types/post';
import { normalizeComfyMedia } from '../services/comfy/media';
import { isAuthorizedOverlaySender } from './page-integration';

const MAX_WORKFLOW_BYTES = 5 * 1024 * 1024;
const MAX_BATCH_ITEMS = 2_000;
const MAX_TEXT = 256;
const MAX_PAGE_IMAGE_BYTES = 100 * 1024 ** 2;
const PAGE_IMAGE_TIMEOUT_MS = 30_000;
const requestTypes = new Set<ComfyRequestMessage['type']>([
  'COMFY_LOAD_STATE', 'COMFY_SAVE_SETTINGS', 'COMFY_IMPORT_WORKFLOW', 'COMFY_EXPORT_WORKFLOW', 'COMFY_ACTIVATE_WORKFLOW',
  'COMFY_SAVE_WORKFLOW_OPTIONS', 'COMFY_RENAME_WORKFLOW', 'COMFY_REPLACE_WORKFLOW', 'COMFY_DUPLICATE_WORKFLOW',
  'COMFY_DELETE_WORKFLOW', 'COMFY_MOVE_WORKFLOW', 'COMFY_TEST_ON_LOAD', 'COMFY_ENQUEUE_POSTS', 'COMFY_ENQUEUE_FILES',
  'COMFY_ENQUEUE_COLLECTION', 'COMFY_MOVE_TASK', 'COMFY_REMOVE_TASK', 'COMFY_CANCEL_TASK', 'COMFY_RETRY_TASK',
  'COMFY_GET_HISTORY', 'COMFY_GET_OUTPUT', 'COMFY_DELETE_HISTORY', 'COMFY_CLEAR_HISTORY', 'COMFY_MARK_READ',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): ComfyResponse<never> {
  return { ok: false, error: { code: 'validation', message } };
}

function validId(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\u0000-\u001f]/.test(value);
}

function validName(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_TEXT;
}

function validPost(value: unknown): value is UnifiedPost {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || (value.id as number) <= 0 || typeof value.source !== 'string') return false;
  if (!Array.isArray(value.tags) || value.tags.length > 20_000 || typeof value.tagString !== 'string') return false;
  if (typeof value.fileUrl !== 'string' || typeof value.sampleUrl !== 'string' || typeof value.previewUrl !== 'string') return false;
  if ([value.fileUrl, value.sampleUrl, value.previewUrl].some((url) => typeof url === 'string' && url.length > 16_384)) return false;
  return value.tags.every((tag) => isRecord(tag) && typeof tag.name === 'string' && tag.name.length <= 512 && ['artist', 'character', 'copyright', 'general', 'meta'].includes(String(tag.category)));
}

function validSettings(value: unknown): value is ComfySettingsSnapshot {
  if (!isRecord(value) || typeof value.baseUrl !== 'string' || typeof value.replaceReverseWithTags !== 'boolean' || typeof value.cacheOutputs !== 'boolean') return false;
  if (!Number.isInteger(value.historyLimit) || (value.historyLimit as number) < 10 || (value.historyLimit as number) > 1000) return false;
  if (!Number.isSafeInteger(value.storageLimitBytes) || (value.storageLimitBytes as number) < 64 * 1024 ** 2 || (value.storageLimitBytes as number) > 10 * 1024 ** 3) return false;
  try { parseComfyAddress(value.baseUrl); } catch { return false; }
  return true;
}

function validOptions(value: unknown) {
  return isRecord(value) && Object.keys(value).length <= 500 && Object.entries(value).every(([key, item]) => validId(key) && (typeof item === 'string' && item.length <= 100_000 || Number.isSafeInteger(item)));
}

function privateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  return first === 0 || first === 10 || first === 127 || first >= 224
    || first === 100 && second >= 64 && second <= 127
    || first === 169 && second === 254
    || first === 172 && second >= 16 && second <= 31
    || first === 192 && (second === 0 || second === 168)
    || first === 198 && (second === 18 || second === 19);
}

export function isAllowedPageImageUrl(value: string) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if ((!hostname.includes('.') && !hostname.includes(':')) || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.home.arpa')) return false;
    if (privateIpv4(hostname)) return false;
    if (hostname.includes(':')) {
      if (hostname === '::' || hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || /^fe[89ab]/.test(hostname)) return false;
      const mapped = hostname.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
      if (mapped && privateIpv4(mapped)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchPageImage(value: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGE_IMAGE_TIMEOUT_MS);
  try {
    let url = new URL(value);
    for (let redirect = 0; redirect <= 5; redirect += 1) {
      if (!isAllowedPageImageUrl(url.toString())) throw new Error('Private and local image addresses are not allowed');
      const response = await fetch(url, { credentials: 'omit', redirect: 'manual', referrerPolicy: 'no-referrer', headers: { Accept: 'image/*' }, signal: controller.signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirect === 5) throw new Error('Image redirected too many times');
        url = new URL(location, url);
        continue;
      }
      if (!response.ok) throw new Error(`Image request failed (${response.status})`);
      const declaredSize = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredSize) && declaredSize > MAX_PAGE_IMAGE_BYTES) throw new Error('Image exceeds the 100 MB webpage limit');
      const mediaType = response.headers.get('content-type')?.split(';', 1)[0].trim() || '';
      if (!mediaType.startsWith('image/')) throw new Error('The selected resource is not an image');
      if (!response.body) throw new Error('Image response has no body');
      const reader = response.body.getReader();
      const chunks: ArrayBuffer[] = [];
      let size = 0;
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        size += chunk.byteLength;
        if (size > MAX_PAGE_IMAGE_BYTES) { await reader.cancel(); throw new Error('Image exceeds the 100 MB webpage limit'); }
        chunks.push(chunk.slice().buffer as ArrayBuffer);
      }
      return { blob: new Blob(chunks, { type: mediaType }), url };
    }
    throw new Error('Image redirected too many times');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Image request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function validateComfyMessage(message: unknown): ComfyRequestMessage | ComfyResponse<never> {
  if (!isRecord(message) || typeof message.type !== 'string' || !requestTypes.has(message.type as ComfyRequestMessage['type'])) return invalid('Unknown ComfyUI message');
  const payload = message.payload;
  switch (message.type as ComfyRequestMessage['type']) {
    case 'COMFY_LOAD_STATE': case 'COMFY_TEST_ON_LOAD': case 'COMFY_CLEAR_HISTORY': case 'COMFY_MARK_READ':
      return message as unknown as ComfyRequestMessage;
    case 'COMFY_SAVE_SETTINGS':
      return validSettings(payload) ? message as unknown as ComfyRequestMessage : invalid('Invalid ComfyUI settings');
    case 'COMFY_IMPORT_WORKFLOW':
      return isRecord(payload) && validName(payload.name) && typeof payload.apiJson === 'string' && payload.apiJson.length <= MAX_WORKFLOW_BYTES ? message as unknown as ComfyRequestMessage : invalid('Invalid workflow import');
    case 'COMFY_REPLACE_WORKFLOW':
      return isRecord(payload) && validId(payload.workflowId) && typeof payload.apiJson === 'string' && payload.apiJson.length <= MAX_WORKFLOW_BYTES ? message as unknown as ComfyRequestMessage : invalid('Invalid workflow replacement');
    case 'COMFY_RENAME_WORKFLOW': case 'COMFY_DUPLICATE_WORKFLOW':
      return isRecord(payload) && validId(payload.workflowId) && validName(payload.name) ? message as unknown as ComfyRequestMessage : invalid('Invalid workflow name');
    case 'COMFY_SAVE_WORKFLOW_OPTIONS':
      return isRecord(payload) && validId(payload.workflowId) && validOptions(payload.options) ? message as unknown as ComfyRequestMessage : invalid('Invalid workflow options');
    case 'COMFY_EXPORT_WORKFLOW': case 'COMFY_ACTIVATE_WORKFLOW': case 'COMFY_DELETE_WORKFLOW':
      return isRecord(payload) && validId(payload.workflowId) ? message as unknown as ComfyRequestMessage : invalid('Invalid workflow reference');
    case 'COMFY_MOVE_WORKFLOW':
      return isRecord(payload) && validId(payload.workflowId) && (payload.direction === 'up' || payload.direction === 'down') ? message as unknown as ComfyRequestMessage : invalid('Invalid workflow move');
    case 'COMFY_ENQUEUE_POSTS':
      return isRecord(payload) && validId(payload.batchId) && Array.isArray(payload.posts) && payload.posts.length <= MAX_BATCH_ITEMS && payload.posts.every(validPost) ? message as unknown as ComfyRequestMessage : invalid('Invalid post batch');
    case 'COMFY_ENQUEUE_COLLECTION':
      return isRecord(payload) && validId(payload.batchId) && validId(payload.collectionId) && Array.isArray(payload.posts) && payload.posts.length <= MAX_BATCH_ITEMS && payload.posts.every(validPost) ? message as unknown as ComfyRequestMessage : invalid('Invalid collection batch');
    case 'COMFY_ENQUEUE_FILES':
      return isRecord(payload) && validId(payload.batchId) && Array.isArray(payload.inputs) && payload.inputs.length <= MAX_BATCH_ITEMS && payload.inputs.every((input) => isRecord(input) && input.kind === 'blob' && validId(input.blobKey) && validName(input.name) && typeof input.mediaType === 'string' && input.mediaType.length <= 128 && (input.post === undefined || validPost(input.post))) ? message as unknown as ComfyRequestMessage : invalid('Invalid file references');
    case 'COMFY_MOVE_TASK':
      return isRecord(payload) && validId(payload.taskId) && (payload.direction === 'up' || payload.direction === 'down') ? message as unknown as ComfyRequestMessage : invalid('Invalid task move');
    case 'COMFY_CANCEL_TASK':
      return isRecord(payload) && validId(payload.taskId) && typeof payload.allowGlobalInterrupt === 'boolean' ? message as unknown as ComfyRequestMessage : invalid('Invalid task cancellation');
    case 'COMFY_REMOVE_TASK': case 'COMFY_RETRY_TASK':
      return isRecord(payload) && validId(payload.taskId) ? message as unknown as ComfyRequestMessage : invalid('Invalid task reference');
    case 'COMFY_GET_HISTORY':
      return isRecord(payload) && (payload.cursor === undefined || validId(payload.cursor)) && Number.isInteger(payload.limit) && (payload.limit as number) >= 1 && (payload.limit as number) <= 100 ? message as unknown as ComfyRequestMessage : invalid('Invalid history request');
    case 'COMFY_GET_OUTPUT':
      return isRecord(payload) && validId(payload.historyId) && Number.isInteger(payload.outputIndex) && (payload.outputIndex as number) >= 0 && (payload.outputIndex as number) < 10_000 ? message as unknown as ComfyRequestMessage : invalid('Invalid output request');
    case 'COMFY_DELETE_HISTORY':
      return isRecord(payload) && validId(payload.historyId) ? message as unknown as ComfyRequestMessage : invalid('Invalid history reference');
    case 'COMFY_STAGE_FILES':
      return invalid('File blobs cannot be sent through extension messages');
    default:
      return invalid('Unsupported ComfyUI message');
  }
}

export function isTrustedComfySender(sender: chrome.runtime.MessageSender): boolean {
  const sourceUrl = sender.url ?? (sender as chrome.runtime.MessageSender & { origin?: string }).origin;
  if (sender.id !== chrome.runtime.id || !sourceUrl) return false;
  if (sourceUrl.startsWith(chrome.runtime.getURL('src/overlay/index.html'))) return isAuthorizedOverlaySender(sender);
  return sourceUrl.startsWith(chrome.runtime.getURL(''));
}

export function isTrustedPageSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || typeof sender.tab?.id !== 'number' || !sender.url) return false;
  try { return ['http:', 'https:'].includes(new URL(sender.url).protocol); } catch { return false; }
}

async function loadTagOptions() {
  const categories: TagCategory[] = ['artist', 'character', 'copyright', 'general', 'meta'];
  try {
    const stored = await chrome.storage.local.get('danbooru-settings');
    const parsed = typeof stored['danbooru-settings'] === 'string' ? JSON.parse(stored['danbooru-settings']) as { state?: Record<string, unknown> } : null;
    const state = parsed?.state;
    return {
      categories: Array.isArray(state?.copyTagCategories) ? state.copyTagCategories.filter((item): item is TagCategory => categories.includes(item as TagCategory)) : categories,
      useUnderscores: state?.copyTagsUseUnderscores !== false,
      escapeParentheses: state?.copyTagsEscapeParentheses === true,
    };
  } catch {
    return { categories, useUnderscores: true, escapeParentheses: false };
  }
}

const workbenchPorts = new Set<chrome.runtime.Port>();
const manager = new ComfyManager({
  getTagOptions: loadTagOptions,
  onStateChange: (snapshot: ComfyStateSnapshot) => {
    const update = { type: 'COMFY_STATE_UPDATE', payload: { tasks: snapshot.tasks, unreadCount: snapshot.unreadCount } };
    for (const port of workbenchPorts) try { port.postMessage(update); } catch { workbenchPorts.delete(port); }
  },
});

export function connectComfyWorkbench(port: chrome.runtime.Port): void {
  if (port.name !== 'comfy-workbench' || !port.sender || !isTrustedComfySender(port.sender)) return;
  workbenchPorts.add(port);
  port.onDisconnect.addListener(() => workbenchPorts.delete(port));
}

export async function routeComfyMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<ComfyResponse> {
  if (!isTrustedComfySender(sender)) return { ok: false, error: { code: 'validation', message: 'ComfyUI requests are restricted to extension pages' } };
  const validated = validateComfyMessage(message);
  if ('ok' in validated) return validated;
  return manager.handle(validated);
}

export async function enqueuePageImage(message: unknown, sender: chrome.runtime.MessageSender): Promise<ComfyResponse> {
  if (!isTrustedPageSender(sender) || !isRecord(message)) return invalid('Page image requests are restricted to enabled website integrations');
  const payload = message.payload;
  if (!isRecord(payload) || !Array.isArray(payload.urls) || payload.urls.length < 1 || payload.urls.length > 16 || !payload.urls.every((url) => typeof url === 'string' && url.length <= 16_384)) return invalid('Invalid page image request');
  if (!Number.isSafeInteger(payload.naturalWidth) || !Number.isSafeInteger(payload.naturalHeight) || (payload.naturalWidth as number) < 1 || (payload.naturalHeight as number) < 1) return invalid('Invalid page image dimensions');
  try {
    const state = await manager.getState();
    if (!state.workflows.some((workflow) => workflow.active)) throw new Error('Import and activate a valid workflow before sending');
    let lastError: unknown;
    for (const value of payload.urls as string[]) {
      try {
        const { blob, url } = await fetchPageImage(value);
        let filename = 'web-image';
        try { filename = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || filename); } catch { /* Keep the safe fallback name. */ }
        const normalized = await normalizeComfyMedia(blob, filename);
        const record = await manager.storage.putInputBlob(normalized.blob, normalized.filename, normalized.mediaType);
        const sourceLabel = `${new URL(sender.url!).hostname} / ${normalized.filename}`.slice(0, MAX_TEXT);
        return manager.handle({ type: 'COMFY_ENQUEUE_FILES', payload: { batchId: crypto.randomUUID(), inputs: [{ kind: 'blob', blobKey: record.key, name: normalized.filename, mediaType: normalized.mediaType, sourceLabel }] } });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('No usable page image URL was found');
  } catch (error) {
    return { ok: false, error: { code: 'media', message: error instanceof Error ? error.message : 'Page image could not be queued' } };
  }
}

export function initializeComfyBackground(): Promise<void> {
  return manager.initialize();
}
