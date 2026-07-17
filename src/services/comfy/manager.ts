import type { TagCopyOptions } from '../tag-copy';
import { ComfyClient, parseComfyAddress } from './client';
import { ComfyExecutor } from './executor';
import { ComfyStorage, ComfyStorageError } from './storage';
import type {
  ComfyBlobInput,
  ComfyRequestMessage,
  ComfyResponse,
  ComfyStateSnapshot,
  ComfyTaskSnapshot,
  ComfyTaskSummary,
  ComfyWorkflowPreset,
} from './types';
import { formatPostTagsForReverse, parseApiWorkflowJson, validateApiWorkflow } from './workflow';
import type { UnifiedPost } from '../../types/post';

export interface ComfyManagerOptions {
  storage?: ComfyStorage;
  executor?: ComfyExecutor;
  getTagOptions?: () => Promise<TagCopyOptions>;
  onStateChange?: (snapshot: ComfyStateSnapshot) => void;
}

function errorResponse(error: unknown): ComfyResponse<never> {
  const code = error instanceof ComfyStorageError ? 'storage' : error && typeof error === 'object' && 'code' in error ? String(error.code) : 'validation';
  return { ok: false, error: { code: code as ComfyResponse<never> extends { ok: false; error: { code: infer C } } ? C : never, message: error instanceof Error ? error.message : 'ComfyUI operation failed' } };
}

function summary(preset: ComfyWorkflowPreset) {
  return { id: preset.id, name: preset.name, active: preset.active, order: preset.order, options: preset.options, updatedAt: preset.updatedAt };
}

function taskSummary(task: ComfyTaskSnapshot): ComfyTaskSummary {
  const thumbnail = task.input.kind === 'post'
    ? {
        kind: 'url' as const,
        url: task.input.post.previewUrl || task.input.post.sampleUrl || task.input.post.fileUrl,
        viewUrl: task.input.post.fileUrl || task.input.post.sampleUrl || task.input.post.previewUrl,
      }
    : { kind: 'blob' as const, blobKey: task.input.blobKey };
  return {
    id: task.id, batchId: task.batchId, status: task.status, workflowId: task.workflowId, sourceLabel: task.sourceLabel,
    serverUrl: task.serverUrl, thumbnail,
    promptId: task.promptId, progress: task.progress, error: task.error, createdAt: task.createdAt, updatedAt: task.updatedAt,
    startedAt: task.startedAt, completedAt: task.completedAt, outputs: task.outputs,
  };
}

export class ComfyManager {
  readonly storage: ComfyStorage;
  readonly executor: ComfyExecutor;
  private readonly getTagOptions: () => Promise<TagCopyOptions>;
  private readonly onStateChange?: (snapshot: ComfyStateSnapshot) => void;
  private unreadCount = 0;
  private initialized = false;

  constructor(options: ComfyManagerOptions = {}) {
    this.storage = options.storage ?? new ComfyStorage();
    this.onStateChange = options.onStateChange;
    this.executor = options.executor ?? new ComfyExecutor({ storage: this.storage, onStateChange: () => void this.emitState() });
    this.getTagOptions = options.getTagOptions ?? (async () => ({ categories: ['artist', 'character', 'copyright', 'general', 'meta'], useUnderscores: true, escapeParentheses: false }));
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.storage.initialize();
    await this.executor.start();
  }

  async getState(): Promise<ComfyStateSnapshot> {
    await this.initialize();
    const [settings, workflows, tasks] = await Promise.all([this.storage.getSettings(), this.storage.listWorkflows(), this.storage.listTasks()]);
    return { settings, workflows: workflows.map(summary), tasks: tasks.map(taskSummary), unreadCount: this.unreadCount };
  }

  async handle(message: ComfyRequestMessage): Promise<ComfyResponse> {
    try {
      await this.initialize();
      let data: unknown;
      switch (message.type) {
        case 'COMFY_LOAD_STATE': data = await this.getState(); break;
        case 'COMFY_SAVE_SETTINGS':
          parseComfyAddress(message.payload.baseUrl);
          await this.storage.saveSettings(message.payload);
          data = await this.getState();
          break;
        case 'COMFY_IMPORT_WORKFLOW': data = await this.importWorkflow(message.payload.name, message.payload.apiJson); break;
        case 'COMFY_EXPORT_WORKFLOW': data = await this.exportWorkflow(message.payload.workflowId); break;
        case 'COMFY_ACTIVATE_WORKFLOW': await this.storage.setActiveWorkflow(message.payload.workflowId); data = await this.getState(); break;
        case 'COMFY_SAVE_WORKFLOW_OPTIONS': data = await this.saveWorkflowOptions(message.payload.workflowId, message.payload.options); break;
        case 'COMFY_RENAME_WORKFLOW': data = await this.renameWorkflow(message.payload.workflowId, message.payload.name); break;
        case 'COMFY_REPLACE_WORKFLOW': data = await this.replaceWorkflow(message.payload.workflowId, message.payload.apiJson); break;
        case 'COMFY_DUPLICATE_WORKFLOW': data = await this.duplicateWorkflow(message.payload.workflowId, message.payload.name); break;
        case 'COMFY_DELETE_WORKFLOW': await this.storage.deleteWorkflow(message.payload.workflowId); data = await this.getState(); break;
        case 'COMFY_MOVE_WORKFLOW': await this.storage.reorderWorkflow(message.payload.workflowId, message.payload.direction); data = await this.getState(); break;
        case 'COMFY_TEST_ON_LOAD': await new ComfyClient((await this.storage.getSettings()).baseUrl).getQueue(); data = { reachable: true }; break;
        case 'COMFY_ENQUEUE_POSTS': data = await this.enqueuePosts(message.payload.posts, message.payload.batchId); break;
        case 'COMFY_ENQUEUE_COLLECTION': data = await this.enqueuePosts(message.payload.posts, message.payload.batchId); break;
        case 'COMFY_ENQUEUE_FILES': data = await this.enqueueFiles(message.payload.inputs, message.payload.batchId); break;
        case 'COMFY_MOVE_TASK': await this.moveTask(message.payload.taskId, message.payload.direction); data = await this.getState(); break;
        case 'COMFY_REMOVE_TASK': await this.removeTask(message.payload.taskId); data = await this.getState(); break;
        case 'COMFY_CANCEL_TASK': await this.executor.cancel(message.payload.taskId, message.payload.allowGlobalInterrupt); data = await this.getState(); break;
        case 'COMFY_RETRY_TASK': data = await this.retryTask(message.payload.taskId); break;
        case 'COMFY_GET_HISTORY': data = await this.getHistory(message.payload.cursor, message.payload.limit); break;
        case 'COMFY_GET_OUTPUT': data = await this.getOutput(message.payload.historyId, message.payload.outputIndex); break;
        case 'COMFY_DELETE_HISTORY': await this.storage.deleteHistory(message.payload.historyId); data = true; break;
        case 'COMFY_CLEAR_HISTORY': await this.storage.clearHistory(); data = true; break;
        case 'COMFY_MARK_READ': this.unreadCount = 0; data = true; break;
        case 'COMFY_STAGE_FILES': throw new Error('Files must be staged in extension IndexedDB before enqueueing');
      }
      await this.emitState();
      return { ok: true, data };
    } catch (error) {
      return errorResponse(error);
    }
  }

  private async importWorkflow(name: string, apiJson: string) {
    const parsed = parseApiWorkflowJson(apiJson, name.trim());
    const workflows = await this.storage.listWorkflows();
    const now = Date.now();
    const preset: ComfyWorkflowPreset = { id: crypto.randomUUID(), name: parsed.name, workflow: parsed.workflow, active: !workflows.length, order: workflows.length, options: Object.fromEntries(parsed.options.map((option) => [option.nodeId, option.value])), createdAt: now, updatedAt: now };
    await this.storage.saveWorkflow(preset);
    return this.getState();
  }

  private async exportWorkflow(id: string) {
    const preset = await this.requiredWorkflow(id);
    return { name: `${preset.name}.json`, apiJson: JSON.stringify(preset.workflow, null, 2) };
  }

  private async saveWorkflowOptions(id: string, options: Record<string, string | number>) {
    const preset = await this.requiredWorkflow(id);
    const parsed = validateApiWorkflow(preset.workflow, preset.name);
    const validated: Record<string, string | number> = {};
    for (const option of parsed.options) {
      const value = options[option.nodeId] ?? option.value;
      if (option.kind === 'integer' && !Number.isSafeInteger(value)) throw new Error(`${option.title} requires an integer`);
      if (option.kind === 'text' && typeof value !== 'string') throw new Error(`${option.title} requires text`);
      validated[option.nodeId] = value;
    }
    await this.storage.saveWorkflow({ ...preset, options: validated, updatedAt: Date.now() });
    return this.getState();
  }

  private async renameWorkflow(id: string, name: string) {
    const preset = await this.requiredWorkflow(id);
    if (!name.trim()) throw new Error('Workflow name is required');
    await this.storage.saveWorkflow({ ...preset, name: name.trim(), updatedAt: Date.now() });
    return this.getState();
  }

  private async replaceWorkflow(id: string, apiJson: string) {
    const preset = await this.requiredWorkflow(id);
    const parsed = parseApiWorkflowJson(apiJson, preset.name);
    const defaults = Object.fromEntries(parsed.options.map((option) => [option.nodeId, option.value]));
    await this.storage.saveWorkflow({ ...preset, workflow: parsed.workflow, options: { ...defaults, ...Object.fromEntries(Object.entries(preset.options).filter(([key]) => key in defaults)) }, updatedAt: Date.now() });
    return this.getState();
  }

  private async duplicateWorkflow(id: string, name: string) {
    const preset = await this.requiredWorkflow(id);
    const workflows = await this.storage.listWorkflows();
    const now = Date.now();
    await this.storage.saveWorkflow({ ...structuredClone(preset), id: crypto.randomUUID(), name: name.trim() || `${preset.name} copy`, active: false, order: workflows.length, createdAt: now, updatedAt: now });
    return this.getState();
  }

  private async enqueuePosts(posts: UnifiedPost[], batchId: string) {
    const options = await this.getTagOptions();
    return this.enqueue(posts.map((post) => ({ input: { kind: 'post' as const, post }, sourceLabel: `${post.source} #${post.id}`, reverseText: formatPostTagsForReverse(post, options) })), batchId);
  }

  private async enqueueFiles(inputs: ComfyBlobInput[], batchId: string) {
    for (const input of inputs) if (!await this.storage.getBlob(input.blobKey, 'input')) throw new Error(`Input file ${input.name} is unavailable`);
    const options = await this.getTagOptions();
    return this.enqueue(inputs.map((input) => ({ input, sourceLabel: input.sourceLabel ?? input.name, reverseText: input.post ? formatPostTagsForReverse(input.post, options) : '' })), batchId);
  }

  private async enqueue(items: Array<{ input: ComfyTaskSnapshot['input']; sourceLabel: string; reverseText: string }>, batchId: string) {
    const preset = (await this.storage.listWorkflows()).find((workflow) => workflow.active);
    if (!preset) throw new Error('Import and activate a valid workflow before sending');
    const settings = await this.storage.getSettings();
    const now = Date.now();
    const tasks = items.map((item, index): ComfyTaskSnapshot => ({ id: crypto.randomUUID(), batchId, status: 'queued', workflowId: preset.id, sourceLabel: item.sourceLabel, createdAt: now + index, updatedAt: now + index, serverUrl: settings.baseUrl, workflow: structuredClone(preset.workflow), optionValues: structuredClone(preset.options), reverseText: settings.replaceReverseWithTags ? item.reverseText : undefined, input: structuredClone(item.input), clientId: crypto.randomUUID(), attempts: 0 }));
    for (const task of tasks) {
      await this.storage.saveTask(task);
      if (task.input.kind === 'blob') await this.storage.leaseBlob(task.input.blobKey, task.id);
    }
    this.executor.wake();
    return { taskIds: tasks.map((task) => task.id), batchId };
  }

  private async moveTask(id: string, direction: 'up' | 'down') {
    const tasks = (await this.storage.listTasks()).filter((task) => task.status === 'queued' || task.status === 'waiting-for-service');
    const index = tasks.findIndex((task) => task.id === id);
    const target = index + (direction === 'up' ? -1 : 1);
    if (index < 0 || target < 0 || target >= tasks.length) return;
    const leftTime = tasks[index].createdAt;
    tasks[index].createdAt = tasks[target].createdAt;
    tasks[target].createdAt = leftTime;
    await Promise.all([this.storage.saveTask(tasks[index]), this.storage.saveTask(tasks[target])]);
  }

  private async removeTask(id: string) {
    await this.executor.removeWaiting(id);
  }

  private async retryTask(id: string) {
    const task = await this.storage.getTask(id) ?? (await this.storage.listHistory()).find((record) => record.task.id === id)?.task;
    if (!task || !['completed', 'failed', 'needs-confirmation', 'cancelled'].includes(task.status)) throw new Error('This task cannot be retried');
    const retry: ComfyTaskSnapshot = { ...structuredClone(task), id: crypto.randomUUID(), promptId: undefined, status: 'queued', error: undefined, progress: undefined, outputs: undefined, resolvedInput: undefined, startedAt: undefined, completedAt: undefined, createdAt: Date.now(), updatedAt: Date.now(), clientId: crypto.randomUUID(), attempts: 0 };
    await this.storage.saveTask(retry);
    if (retry.input.kind === 'blob') await this.storage.leaseBlob(retry.input.blobKey, retry.id);
    this.executor.wake();
    return { taskId: retry.id };
  }

  private async getHistory(cursor: string | undefined, limit: number) {
    const records = await this.storage.listHistory();
    const start = cursor ? Math.max(0, records.findIndex((record) => record.id === cursor) + 1) : 0;
    const items = records.slice(start, start + limit);
    return { items, nextCursor: start + limit < records.length ? items.at(-1)?.id : undefined };
  }

  private async getOutput(historyId: string, outputIndex: number) {
    const history = (await this.storage.listHistory()).find((record) => record.id === historyId);
    const output = history?.outputs[outputIndex];
    if (!history || !output) throw new Error('Output not found');
    if (output.blobKey) return { output, blob: (await this.storage.getBlob(output.blobKey, 'output'))?.blob };
    if (output.kind === 'image' && output.filename) return { output, url: new ComfyClient(history.task.serverUrl).getViewUrl({ filename: output.filename, type: output.type, subfolder: output.subfolder }).toString() };
    return { output };
  }

  private async requiredWorkflow(id: string) {
    const preset = await this.storage.getWorkflow(id);
    if (!preset) throw new Error('Workflow not found');
    return preset;
  }

  private async emitState() {
    if (this.onStateChange) this.onStateChange(await this.getState());
  }
}
