import type { ComfyErrorCode } from './types';

const DEFAULT_PORT = '8188';
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_ERROR_LENGTH = 4_096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ComfyClientError extends Error {
  constructor(
    message: string,
    readonly code: ComfyErrorCode,
    readonly status = 0,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ComfyClientError';
  }
}

export function parseComfyAddress(input: string): URL {
  const candidate = input.trim();
  if (!candidate) throw new ComfyClientError('ComfyUI address is required', 'address');
  const withScheme = /^https?:\/\//i.test(candidate) ? candidate : `http://${candidate}`;
  const authority = withScheme.slice(withScheme.indexOf('//') + 2).split(/[/?#]/, 1)[0] ?? '';
  const explicitPort = /:(\d+)$/.exec(authority)?.[1];
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ComfyClientError('Invalid ComfyUI address', 'address');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ComfyClientError('ComfyUI address must use HTTP or HTTPS', 'address');
  }
  if (url.hostname !== '127.0.0.1') {
    throw new ComfyClientError('ComfyUI must use 127.0.0.1', 'address');
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new ComfyClientError('ComfyUI address cannot contain credentials, a path, query, or fragment', 'address');
  }
  if (!explicitPort) url.port = DEFAULT_PORT;
  const port = Number(explicitPort ?? url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ComfyClientError('ComfyUI port must be between 1 and 65535', 'address');
  }
  return url;
}

export interface ComfyUploadedImage {
  name: string;
  subfolder: string;
  type: string;
}

export type ComfyQueueItem = [unknown, string, ...unknown[]];

export interface ComfyQueueState {
  queueRunning: ComfyQueueItem[];
  queuePending: ComfyQueueItem[];
}

export interface ComfyHistoryEntry extends Record<string, unknown> {
  status: { status_str: string; completed: boolean; messages: unknown[]; [key: string]: unknown };
  outputs: Record<string, unknown>;
}

interface ComfyClientOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

function extractErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) return fallback;
  const error = value.error;
  if (typeof error === 'string') return error.slice(0, MAX_ERROR_LENGTH);
  if (isRecord(error)) {
    const parts = [error.type, error.message, error.details].filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (parts.length > 0) return parts.join(': ').slice(0, MAX_ERROR_LENGTH);
  }
  if (typeof value.message === 'string') return value.message.slice(0, MAX_ERROR_LENGTH);
  if (typeof value.exception_message === 'string') return value.exception_message.slice(0, MAX_ERROR_LENGTH);
  return fallback;
}

function getHistoryExecutionError(entry: ComfyHistoryEntry): string | null {
  if (isRecord(entry.status) && entry.status.status_str === 'error') {
    if (Array.isArray(entry.status.messages)) {
      for (const message of entry.status.messages) {
        if (!Array.isArray(message) || (message[0] !== 'execution_error' && message[0] !== 'execution_interrupted')) continue;
        return extractErrorMessage(message[1], 'ComfyUI execution failed');
      }
    }
    return 'ComfyUI execution failed';
  }
  return null;
}

export class ComfyClient {
  private readonly baseAddress: string;
  private readonly requestFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(address: string | URL, options: ComfyClientOptions = {}) {
    this.baseAddress = parseComfyAddress(address.toString()).toString();
    this.requestFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  get baseUrl(): URL {
    return new URL(this.baseAddress);
  }

  private endpoint(path: string): URL {
    return new URL(path.replace(/^\//, ''), this.baseAddress);
  }

  private async request(path: string, init: RequestInit = {}, externalSignal?: AbortSignal): Promise<unknown> {
    if (externalSignal?.aborted) throw new ComfyClientError('ComfyUI request cancelled', 'cancelled');
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      const response = await this.requestFetch(this.endpoint(path), { ...init, signal: controller.signal });
      const text = await response.text();
      let data: unknown = null;
      if (text.trim()) {
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          if (response.ok) throw new ComfyClientError('ComfyUI returned invalid JSON', 'protocol', response.status);
          data = { message: text.slice(0, MAX_ERROR_LENGTH) };
        }
      }
      if (!response.ok) {
        throw new ComfyClientError(extractErrorMessage(data, `ComfyUI request failed (${response.status})`), 'http', response.status);
      }
      return data;
    } catch (error) {
      if (error instanceof ComfyClientError) throw error;
      if (timedOut) throw new ComfyClientError('ComfyUI request timed out', 'timeout');
      if (externalSignal?.aborted) throw new ComfyClientError('ComfyUI request cancelled', 'cancelled');
      throw new ComfyClientError(error instanceof Error ? error.message : 'Unable to reach ComfyUI', 'network');
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abort);
    }
  }

  async uploadImage(blob: Blob, filename: string, signal?: AbortSignal): Promise<ComfyUploadedImage> {
    const body = new FormData();
    body.set('image', blob, filename);
    body.set('type', 'input');
    body.set('overwrite', 'false');
    const data = await this.request('/upload/image', { method: 'POST', body }, signal);
    if (!isRecord(data) || typeof data.name !== 'string' || !data.name || typeof data.subfolder !== 'string' || data.type !== 'input') {
      throw new ComfyClientError('ComfyUI upload response is invalid', 'protocol');
    }
    return {
      name: data.name,
      subfolder: data.subfolder,
      type: data.type,
    };
  }

  async queuePrompt(workflow: Record<string, unknown>, clientId: string, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new ComfyClientError('ComfyUI request cancelled', 'cancelled');
    try {
      const data = await this.request('/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      }, signal);
      if (!isRecord(data) || typeof data.prompt_id !== 'string' || !data.prompt_id) {
        const message = extractErrorMessage(data, 'ComfyUI prompt response has no prompt_id');
        throw new ComfyClientError(message, isRecord(data) && data.error ? 'server' : 'protocol');
      }
      return data.prompt_id;
    } catch (error) {
      if (error instanceof ComfyClientError && (error.code === 'network' || error.code === 'timeout' || error.code === 'cancelled')) {
        throw new ComfyClientError('Prompt submission could not be confirmed', 'submission-unknown', error.status, error);
      }
      throw error;
    }
  }

  async getHistory(promptId: string, signal?: AbortSignal): Promise<ComfyHistoryEntry | null> {
    const data = await this.request(`/history/${encodeURIComponent(promptId)}`, {}, signal);
    if (!isRecord(data)) throw new ComfyClientError('ComfyUI history response is invalid', 'protocol');
    const entry = data[promptId];
    if (entry === undefined) return null;
    if (!isRecord(entry) || !isRecord(entry.status) || typeof entry.status.status_str !== 'string'
      || typeof entry.status.completed !== 'boolean' || !Array.isArray(entry.status.messages) || !isRecord(entry.outputs)) {
      throw new ComfyClientError('ComfyUI history entry is invalid', 'protocol');
    }
    return entry as ComfyHistoryEntry;
  }

  async getQueue(signal?: AbortSignal): Promise<ComfyQueueState> {
    const data = await this.request('/queue', {}, signal);
    if (!isRecord(data) || !isQueueItems(data.queue_running) || !isQueueItems(data.queue_pending)) {
      throw new ComfyClientError('ComfyUI queue response is invalid', 'protocol');
    }
    return { queueRunning: data.queue_running, queuePending: data.queue_pending };
  }

  async deletePendingPrompt(promptId: string, signal?: AbortSignal): Promise<void> {
    await this.request('/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete: [promptId] }),
    }, signal);
  }

  async interrupt(signal?: AbortSignal): Promise<void> {
    await this.request('/interrupt', { method: 'POST' }, signal);
  }

  getViewUrl(image: { filename: string; type?: string; subfolder?: string }): URL {
    const url = this.endpoint('/view');
    url.searchParams.set('filename', image.filename);
    url.searchParams.set('type', image.type ?? 'output');
    if (image.subfolder) url.searchParams.set('subfolder', image.subfolder);
    return url;
  }
}

function isQueueItems(value: unknown): value is ComfyQueueItem[] {
  return Array.isArray(value) && value.every((item) => Array.isArray(item) && item.length >= 2 && typeof item[1] === 'string');
}

export type ComfySocketEvent =
  | { type: 'progress'; promptId?: string; value: number; max: number; nodeId?: string }
  | { type: 'executing'; promptId?: string; nodeId: string | null }
  | { type: 'executed'; promptId?: string; nodeId?: string; output?: Record<string, unknown> }
  | { type: 'execution_success'; promptId?: string }
  | { type: 'execution_error'; promptId?: string; message: string }
  | { type: 'execution_interrupted'; promptId?: string; message: string };

export function parseComfySocketMessage(message: unknown, promptFilter?: string): ComfySocketEvent | null {
  if (typeof message !== 'string') return null;
  let raw: unknown;
  try {
    raw = JSON.parse(message) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(raw) || typeof raw.type !== 'string' || !isRecord(raw.data)) return null;
  const data = raw.data;
  const promptId = typeof data.prompt_id === 'string' ? data.prompt_id : undefined;
  if (promptFilter && promptId !== promptFilter) return null;
  const nodeId = typeof data.node === 'string' ? data.node : data.node === null ? null : undefined;
  switch (raw.type) {
    case 'progress':
      if (typeof data.value !== 'number' || typeof data.max !== 'number' || data.max <= 0) return null;
      return { type: 'progress', promptId, value: data.value, max: data.max, ...(typeof nodeId === 'string' ? { nodeId } : {}) };
    case 'progress_state': {
      if (!isRecord(data.nodes)) return null;
      for (const [progressNodeId, state] of Object.entries(data.nodes)) {
        if (isRecord(state) && typeof state.value === 'number' && typeof state.max === 'number' && state.max > 0) {
          return { type: 'progress', promptId, value: state.value, max: state.max, nodeId: progressNodeId };
        }
      }
      return null;
    }
    case 'executing':
      if (nodeId === undefined) return null;
      return { type: 'executing', promptId, nodeId };
    case 'executed':
      return { type: 'executed', promptId, ...(typeof nodeId === 'string' ? { nodeId } : {}), ...(isRecord(data.output) ? { output: data.output } : {}) };
    case 'execution_success':
      return { type: 'execution_success', promptId };
    case 'execution_error':
      return { type: 'execution_error', promptId, message: extractErrorMessage(data, 'ComfyUI execution failed') };
    case 'execution_interrupted':
      return { type: 'execution_interrupted', promptId, message: extractErrorMessage(data, 'ComfyUI execution was interrupted') };
    default:
      return null;
  }
}

type SocketListener = (event: ComfySocketEvent) => void;

export interface ComfyWebSocketMonitorOptions {
  createSocket?: (url: string) => WebSocket;
  reconnectDelayMs?: number;
}

export class ComfyWebSocketMonitor {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private promptFilter?: string;
  private readonly listeners = new Set<SocketListener>();
  private readonly createSocket: (url: string) => WebSocket;
  private readonly reconnectDelayMs: number;
  private readonly baseAddress: string;

  constructor(address: string | URL, readonly clientId: string, options: ComfyWebSocketMonitorOptions = {}) {
    this.baseAddress = parseComfyAddress(address.toString()).toString();
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url));
    this.reconnectDelayMs = options.reconnectDelayMs ?? 5_000;
  }

  setPromptFilter(promptId?: string): void {
    this.promptFilter = promptId;
  }

  subscribe(listener: SocketListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private connect(): void {
    if (this.stopped) return;
    const url = new URL('/ws', this.baseAddress);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('clientId', this.clientId);
    const socket = this.createSocket(url.toString());
    this.socket = socket;
    socket.onmessage = (message) => {
      const event = parseComfySocketMessage(message.data, this.promptFilter);
      if (event) for (const listener of this.listeners) listener(event);
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      const wasCurrent = this.socket === socket;
      if (wasCurrent) this.socket = null;
      if (wasCurrent && !this.stopped && !this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, this.reconnectDelayMs);
      }
    };
  }
}

export interface WaitForPromptOptions {
  signal?: AbortSignal;
  intervalMs?: number;
  timeoutMs?: number;
  monitor?: ComfyWebSocketMonitor;
  onEvent?: SocketListener;
}

function waitForWake(delayMs: number, signal: AbortSignal | undefined, registerWake: (wake: () => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(finish, delayMs);
    function abort() {
      clearTimeout(timer);
      reject(new ComfyClientError('History polling cancelled', 'cancelled'));
    }
    function finish() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve();
    }
    registerWake(finish);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function waitForPromptCompletion(
  client: ComfyClient,
  promptId: string,
  options: WaitForPromptOptions = {},
): Promise<ComfyHistoryEntry> {
  const intervalMs = options.intervalMs ?? 2_000;
  const deadline = Date.now() + (options.timeoutMs ?? 30 * 60_000);
  let wake: (() => void) | undefined;
  const unsubscribe = options.monitor?.subscribe((event) => {
    if (event.promptId !== promptId) return;
    options.onEvent?.(event);
    if (event.type === 'execution_success' || event.type === 'execution_error' || event.type === 'execution_interrupted' || (event.type === 'executing' && event.nodeId === null)) wake?.();
  });
  try {
    while (Date.now() < deadline) {
      options.signal?.throwIfAborted();
      try {
        const entry = await client.getHistory(promptId, options.signal);
        if (entry) {
          const historyError = getHistoryExecutionError(entry);
          if (historyError) throw new ComfyClientError(historyError, 'execution');
          if (entry.status.completed) return entry;
        }
      } catch (error) {
        if (!(error instanceof ComfyClientError) || (error.code !== 'network' && error.code !== 'timeout')) throw error;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await waitForWake(Math.min(intervalMs, remaining), options.signal, (nextWake) => { wake = nextWake; });
      wake = undefined;
    }
    throw new ComfyClientError('Timed out waiting for ComfyUI history', 'timeout');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ComfyClientError('History polling cancelled', 'cancelled');
    }
    throw error;
  } finally {
    unsubscribe?.();
  }
}
