import { ComfyClient, ComfyClientError, ComfyWebSocketMonitor, type ComfyHistoryEntry } from './client';
import { normalizeComfyMedia, normalizePostMedia } from './media';
import { ComfyStorage } from './storage';
import type { ComfyHistoryRecord, ComfyOutputReference, ComfyTaskSnapshot, ComfyTaskStatus } from './types';
import { prepareWorkflow, validateApiWorkflow } from './workflow';

const RETRY_DELAY_MS = 5_000;
const TERMINAL_STATUSES = new Set<ComfyTaskStatus>(['completed', 'failed', 'cancelled', 'needs-confirmation']);

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new ComfyClientError('Task cancelled', 'cancelled')); }, { once: true });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, item]) => ['text', 'string', 'value'].includes(key) ? textValues(item) : []);
}

export function extractComfyOutputs(entry: ComfyHistoryEntry, outputNodeIds: string[], nodeTitles: Record<string, string> = {}): ComfyOutputReference[] {
  const references: ComfyOutputReference[] = [];
  for (const nodeId of outputNodeIds) {
    const output = entry.outputs[nodeId];
    references.push(...extractComfyNodeOutputs(nodeId, output, nodeTitles[nodeId]));
  }
  return references;
}

export function extractComfyNodeOutputs(nodeId: string, output: unknown, nodeTitle?: string): ComfyOutputReference[] {
  if (!isRecord(output)) return [];
  const references: ComfyOutputReference[] = [];
  if (Array.isArray(output.images)) for (const image of output.images) {
    if (!isRecord(image) || typeof image.filename !== 'string') continue;
    references.push({ nodeId, ...(nodeTitle ? { nodeTitle } : {}), kind: 'image', filename: image.filename, subfolder: typeof image.subfolder === 'string' ? image.subfolder : '', type: typeof image.type === 'string' ? image.type : 'output' });
  }
  for (const text of textValues(output)) if (text.trim()) references.push({ nodeId, ...(nodeTitle ? { nodeTitle } : {}), kind: 'text', text });
  return references;
}

function nodeLabel(task: ComfyTaskSnapshot, nodeId?: string) {
  if (!nodeId) return undefined;
  const node = task.workflow[nodeId];
  return node?._meta?.title || node?.class_type || nodeId;
}

function outputNodeTitle(task: ComfyTaskSnapshot, nodeId: string) {
  const node = task.workflow[nodeId];
  return node?._meta?.title || node?.class_type || nodeId;
}

function mergeOutputs(current: ComfyOutputReference[] = [], additions: ComfyOutputReference[]) {
  const key = (output: ComfyOutputReference) => output.kind === 'image'
    ? `${output.nodeId}:image:${output.type}:${output.subfolder}:${output.filename}`
    : `${output.nodeId}:text:${output.text}`;
  return [...new Map([...current, ...additions].map((output) => [key(output), output])).values()];
}

export interface ComfyExecutorOptions {
  storage?: ComfyStorage;
  retryDelayMs?: number;
  onStateChange?: () => void;
}

export class ComfyExecutor {
  readonly storage: ComfyStorage;
  private readonly retryDelayMs: number;
  private readonly onStateChange?: () => void;
  private running = false;
  private wakeRequested = false;
  private activeTaskId?: string;
  private activeController?: AbortController;
  private readonly removedTaskIds = new Set<string>();
  private readonly archivedTaskIds = new Set<string>();
  private readonly updateChains = new Map<string, Promise<void>>();

  constructor(options: ComfyExecutorOptions = {}) {
    this.storage = options.storage ?? new ComfyStorage();
    this.retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
    this.onStateChange = options.onStateChange;
  }

  async start(): Promise<void> {
    await this.storage.initialize();
    await this.recoverInterruptedTasks();
    this.wake();
  }

  wake(): void {
    this.wakeRequested = true;
    if (!this.running) void this.run();
  }

  async cancel(taskId: string, allowGlobalInterrupt: boolean): Promise<void> {
    const task = await this.storage.getTask(taskId);
    if (!task || TERMINAL_STATUSES.has(task.status)) return;
    if (this.activeTaskId === taskId) {
      if (task.promptId && allowGlobalInterrupt) await new ComfyClient(task.serverUrl).interrupt().catch(() => undefined);
      this.activeController?.abort();
      return;
    }
    await this.archive(await this.update(task, { status: 'cancelled', completedAt: Date.now(), error: { code: 'cancelled', message: 'Task cancelled' } }));
    this.wake();
  }

  async removeWaiting(taskId: string): Promise<void> {
    const task = await this.storage.getTask(taskId);
    if (!task || !['queued', 'waiting-for-service'].includes(task.status)) throw new Error('Only waiting tasks can be removed');
    this.removedTaskIds.add(taskId);
    if (this.activeTaskId === taskId) this.activeController?.abort();
    else this.removedTaskIds.delete(taskId);
    await this.storage.deleteTask(taskId);
    this.wake();
  }

  private async recoverInterruptedTasks(): Promise<void> {
    for (const task of await this.storage.listTasks()) {
      if (TERMINAL_STATUSES.has(task.status) || task.status === 'queued' || task.status === 'waiting-for-service') continue;
      if (task.promptId) await this.update(task, { status: 'awaiting-history' });
      else if (task.status === 'submitting') await this.archive(await this.update(task, { status: 'needs-confirmation', completedAt: Date.now(), error: { code: 'submission-unknown', message: 'Prompt submission was interrupted and cannot be confirmed' } }));
      else await this.update(task, { status: 'queued' });
    }
  }

  private async run(): Promise<void> {
    this.running = true;
    try {
      while (this.wakeRequested) {
        this.wakeRequested = false;
        const task = (await this.storage.listTasks()).find((item) => !TERMINAL_STATUSES.has(item.status));
        if (!task) continue;
        await this.execute(task);
        this.wakeRequested = true;
      }
    } finally {
      this.running = false;
      this.activeTaskId = undefined;
      this.activeController = undefined;
    }
  }

  private async execute(initialTask: ComfyTaskSnapshot): Promise<void> {
    let task = initialTask;
    const controller = new AbortController();
    this.activeTaskId = task.id;
    this.activeController = controller;
    try {
      if (!task.promptId) {
        while (!controller.signal.aborted) {
          try {
            task = await this.update(task, { status: 'preparing', startedAt: task.startedAt ?? Date.now(), attempts: task.attempts + 1, error: undefined });
            const media = task.input.kind === 'post'
              ? await normalizePostMedia(task.input.post, controller.signal)
              : await this.normalizeStoredInput(task.input.blobKey);
            task = await this.update(task, { status: 'uploading', resolvedInput: { filename: media.filename, mediaType: media.mediaType, sourceUrl: media.sourceUrl, sourceQuality: media.sourceQuality } });
            const client = new ComfyClient(task.serverUrl);
            const uploaded = await client.uploadImage(media.blob, media.filename, controller.signal);
            const parsed = validateApiWorkflow(task.workflow, task.sourceLabel);
            const workflow = prepareWorkflow(parsed, { imagePath: uploaded.subfolder ? `${uploaded.subfolder}/${uploaded.name}` : uploaded.name, optionValues: task.optionValues, reverseText: task.reverseText });
            task = await this.update(task, { status: 'submitting' });
            const promptId = await client.queuePrompt(workflow, task.clientId, controller.signal);
            task = await this.update(task, { status: 'awaiting-history', promptId });
            break;
          } catch (error) {
            if (error instanceof ComfyClientError && error.code === 'submission-unknown') {
              await this.archive(await this.update(task, { status: 'needs-confirmation', completedAt: Date.now(), error: { code: error.code, message: error.message } }));
              return;
            }
            if (error instanceof ComfyClientError && (error.code === 'network' || error.code === 'timeout')) {
              task = await this.update(task, { status: 'waiting-for-service', error: { code: error.code, message: error.message } });
              await delay(this.retryDelayMs, controller.signal);
              continue;
            }
            throw error;
          }
        }
      }
      if (!task.promptId) return;
      await this.awaitHistory(task, controller.signal);
    } catch (error) {
      if (this.removedTaskIds.delete(task.id)) return;
      const cancelled = controller.signal.aborted || (error instanceof ComfyClientError && error.code === 'cancelled');
      const terminal = await this.update(task, cancelled
        ? { status: 'cancelled', completedAt: Date.now(), error: { code: 'cancelled', message: 'Task cancelled' } }
        : { status: 'failed', completedAt: Date.now(), error: { code: error instanceof ComfyClientError ? error.code : 'execution', message: error instanceof Error ? error.message : 'Task failed' } });
      await this.archive(terminal);
    } finally {
      const latest = await this.storage.getTask(task.id);
      if (latest && TERMINAL_STATUSES.has(latest.status) && latest.input.kind === 'blob') await this.storage.releaseBlobLease(latest.input.blobKey, latest.id);
    }
  }

  private async awaitHistory(initialTask: ComfyTaskSnapshot, signal: AbortSignal): Promise<void> {
    let task = initialTask;
    const client = new ComfyClient(task.serverUrl);
    const outputNodeIds = new Set(validateApiWorkflow(task.workflow, task.sourceLabel).outputNodeIds);
    const monitor = new ComfyWebSocketMonitor(task.serverUrl, task.clientId);
    monitor.setPromptFilter(task.promptId);
    monitor.subscribe((event) => {
      if (event.type === 'progress') void this.update(task, { status: 'running', progress: { value: event.value, max: event.max, nodeId: event.nodeId, nodeLabel: nodeLabel(task, event.nodeId) } }).then((updated) => { task = updated; });
      if (event.type === 'executing' && event.nodeId) void this.update(task, { status: 'running', progress: { value: task.progress?.value ?? 0, max: task.progress?.max ?? 1, nodeId: event.nodeId, nodeLabel: nodeLabel(task, event.nodeId) } }).then((updated) => { task = updated; });
      if (event.type === 'executed' && event.nodeId && event.output && outputNodeIds.has(event.nodeId)) {
        const additions = extractComfyNodeOutputs(event.nodeId, event.output, outputNodeTitle(task, event.nodeId));
        if (additions.length) void this.update(task, (current) => ({ outputs: mergeOutputs(current.outputs, additions) })).then((updated) => { task = updated; });
      }
    });
    monitor.start();
    try {
      while (!signal.aborted) {
        try {
          const entry = await client.getHistory(task.promptId!, signal);
          if (!entry) {
            task = await this.update(task, { status: 'running' });
          } else if (entry.status.status_str === 'error') {
            throw new ComfyClientError('ComfyUI execution failed', 'execution');
          } else if (entry.status.completed) {
            await this.complete(task, entry, client);
            return;
          }
        } catch (error) {
          if (!(error instanceof ComfyClientError) || !['network', 'timeout'].includes(error.code)) throw error;
          task = await this.update(task, { status: 'waiting-for-service', error: { code: error.code, message: error.message } });
        }
        await delay(this.retryDelayMs, signal);
      }
    } finally {
      monitor.stop();
    }
  }

  private async complete(task: ComfyTaskSnapshot, entry: ComfyHistoryEntry, client: ComfyClient): Promise<void> {
    const parsed = validateApiWorkflow(task.workflow, task.sourceLabel);
    const outputs = extractComfyOutputs(entry, parsed.outputNodeIds, Object.fromEntries(parsed.outputNodeIds.map((nodeId) => [nodeId, outputNodeTitle(task, nodeId)])));
    const settings = await this.storage.getSettings();
    if (settings.cacheOutputs) for (const output of outputs) {
      if (output.kind !== 'image' || !output.filename) continue;
      try {
        const response = await fetch(client.getViewUrl({ filename: output.filename, type: output.type, subfolder: output.subfolder }));
        if (!response.ok) continue;
        const record = await this.storage.putOutputBlob(await response.blob(), output.filename, response.headers.get('content-type') ?? 'image/png', 'completed', settings.storageLimitBytes);
        output.blobKey = record.key;
      } catch {
        // Server output references remain usable even when local caching is unavailable.
      }
    }
    const completedAt = Date.now();
    const completed = await this.update(task, { status: 'completed', completedAt, progress: undefined, error: undefined });
    await this.archive(completed, outputs, settings.historyLimit);
  }

  private async archive(task: ComfyTaskSnapshot, outputs: ComfyOutputReference[] = [], historyLimit?: number): Promise<void> {
    this.archivedTaskIds.add(task.id);
    await this.updateChains.get(task.id);
    const latest = await this.storage.getTask(task.id) ?? task;
    const completedAt = latest.completedAt ?? Date.now();
    const finalOutputs = outputs.length ? outputs : latest.outputs ?? [];
    const history: ComfyHistoryRecord = { id: crypto.randomUUID(), task: { ...latest, outputs: finalOutputs, completedAt }, outputs: finalOutputs, completedAt };
    await this.storage.saveHistory(history, historyLimit ?? (await this.storage.getSettings()).historyLimit);
    await this.storage.deleteTask(task.id);
    this.onStateChange?.();
    setTimeout(() => this.archivedTaskIds.delete(task.id), 1_000);
  }

  private async normalizeStoredInput(blobKey: string) {
    const record = await this.storage.getBlob(blobKey, 'input');
    if (!record) throw new ComfyClientError('Input file is no longer available', 'storage');
    return normalizeComfyMedia(record.blob, record.name);
  }

  private async update(task: ComfyTaskSnapshot, patch: Partial<ComfyTaskSnapshot> | ((current: ComfyTaskSnapshot) => Partial<ComfyTaskSnapshot>)): Promise<ComfyTaskSnapshot> {
    if (this.archivedTaskIds.has(task.id)) return await this.storage.getTask(task.id) ?? task;
    const previous = this.updateChains.get(task.id) ?? Promise.resolve();
    let updated = task;
    const operation = previous.catch(() => undefined).then(async () => {
      if (this.archivedTaskIds.has(task.id)) {
        updated = await this.storage.getTask(task.id) ?? task;
        return;
      }
      const current = await this.storage.getTask(task.id) ?? task;
      const values = typeof patch === 'function' ? patch(current) : patch;
      updated = { ...current, ...values, updatedAt: Date.now() };
      await this.storage.saveTask(updated);
      this.onStateChange?.();
    });
    const chain = operation.then(() => undefined, () => undefined);
    this.updateChains.set(task.id, chain);
    try {
      await operation;
      return updated;
    } finally {
      if (this.updateChains.get(task.id) === chain) this.updateChains.delete(task.id);
    }
  }
}
