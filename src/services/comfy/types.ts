import type { UnifiedPost } from '../../types/post';

export type ComfyPrimitive = string | number | boolean | null;
export type ComfyValue = ComfyPrimitive | ComfyValue[] | { [key: string]: ComfyValue };

export interface ComfyWorkflowNode {
  class_type: string;
  inputs: Record<string, ComfyValue>;
  _meta?: { title?: string; [key: string]: ComfyValue | undefined };
  [key: string]: unknown;
}

export type ComfyWorkflow = Record<string, ComfyWorkflowNode>;

export type ComfyOption =
  | { nodeId: string; title: string; kind: 'text'; inputKey: 'text'; value: string }
  | { nodeId: string; title: string; kind: 'integer'; inputKey: 'value' | 'integer' | 'number' | 'input'; value: number };

export interface ParsedComfyWorkflow {
  name: string;
  workflow: ComfyWorkflow;
  inputNodeIds: string[];
  outputNodeIds: string[];
  reverseNodeIds: string[];
  options: ComfyOption[];
}

export type WorkflowIssueCode =
  | 'invalid-json'
  | 'invalid-root'
  | 'empty-workflow'
  | 'invalid-node'
  | 'missing-class-type'
  | 'missing-inputs'
  | 'invalid-meta'
  | 'invalid-input-image'
  | 'invalid-reverse-text'
  | 'invalid-option'
  | 'invalid-option-link'
  | 'missing-input';

export interface WorkflowIssue {
  code: WorkflowIssueCode;
  workflowName: string;
  message: string;
  nodeId?: string;
  nodeTitle?: string;
  field?: string;
}

export type ComfyTaskStatus =
  | 'queued'
  | 'preparing'
  | 'uploading'
  | 'submitting'
  | 'waiting-for-service'
  | 'awaiting-history'
  | 'running'
  | 'needs-confirmation'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ComfyErrorCode =
  | 'validation'
  | 'address'
  | 'network'
  | 'timeout'
  | 'http'
  | 'protocol'
  | 'server'
  | 'cancelled'
  | 'submission-unknown'
  | 'execution'
  | 'storage'
  | 'media';

export interface ComfyTaskSummary {
  id: string;
  batchId: string;
  status: ComfyTaskStatus;
  workflowId: string;
  sourceLabel: string;
  serverUrl: string;
  promptId?: string;
  progress?: { value: number; max: number; nodeId?: string; nodeLabel?: string };
  thumbnail?: { kind: 'url'; url: string; viewUrl?: string } | { kind: 'blob'; blobKey: string };
  outputs?: ComfyOutputReference[];
  error?: { code: ComfyErrorCode; message: string };
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface ComfyTaskSnapshot extends ComfyTaskSummary {
  workflow: ComfyWorkflow;
  optionValues: Record<string, string | number>;
  reverseText?: string;
  input: ComfyQueueInput;
  clientId: string;
  attempts: number;
  resolvedInput?: { filename: string; mediaType: string; sourceUrl?: string; sourceQuality?: 'original' | 'sample' | 'preview' | 'local' };
}

export interface ComfyOutputReference {
  nodeId: string;
  nodeTitle?: string;
  kind: 'image' | 'text';
  filename?: string;
  subfolder?: string;
  type?: string;
  text?: string;
  blobKey?: string;
}

export interface ComfyHistoryRecord {
  id: string;
  task: ComfyTaskSnapshot;
  outputs: ComfyOutputReference[];
  completedAt: number;
}

export interface ComfyWorkflowPreset extends ComfyWorkflowPresetSummary {
  workflow: ComfyWorkflow;
  createdAt: number;
}

export interface ComfyBlobRecord {
  key: string;
  blob: Blob;
  name: string;
  mediaType: string;
  size: number;
  createdAt: number;
  lastAccessedAt: number;
  leaseTaskIds: string[];
  category: 'input' | 'output';
  taskStatus?: ComfyTaskStatus;
}

export interface ComfyWorkflowPresetSummary {
  id: string;
  name: string;
  active: boolean;
  order: number;
  options: Record<string, string | number>;
  updatedAt: number;
}

export interface ComfySettingsSnapshot {
  baseUrl: string;
  historyLimit: number;
  storageLimitBytes: number;
  replaceReverseWithTags: boolean;
  cacheOutputs: boolean;
}

export interface ComfyStateSnapshot {
  settings: ComfySettingsSnapshot;
  workflows: ComfyWorkflowPresetSummary[];
  tasks: ComfyTaskSummary[];
  unreadCount: number;
}

export interface ComfyPostInput {
  kind: 'post';
  post: UnifiedPost;
}

export interface ComfyBlobInput {
  kind: 'blob';
  blobKey: string;
  name: string;
  mediaType: string;
  sourceLabel?: string;
  post?: UnifiedPost;
}

export type ComfyQueueInput = ComfyPostInput | ComfyBlobInput;

export type ComfyRequestMessage =
  | { type: 'COMFY_LOAD_STATE' }
  | { type: 'COMFY_SAVE_SETTINGS'; payload: ComfySettingsSnapshot }
  | { type: 'COMFY_IMPORT_WORKFLOW'; payload: { name: string; apiJson: string } }
  | { type: 'COMFY_EXPORT_WORKFLOW'; payload: { workflowId: string } }
  | { type: 'COMFY_ACTIVATE_WORKFLOW'; payload: { workflowId: string } }
  | { type: 'COMFY_SAVE_WORKFLOW_OPTIONS'; payload: { workflowId: string; options: Record<string, string | number> } }
  | { type: 'COMFY_RENAME_WORKFLOW'; payload: { workflowId: string; name: string } }
  | { type: 'COMFY_REPLACE_WORKFLOW'; payload: { workflowId: string; apiJson: string } }
  | { type: 'COMFY_DUPLICATE_WORKFLOW'; payload: { workflowId: string; name: string } }
  | { type: 'COMFY_DELETE_WORKFLOW'; payload: { workflowId: string } }
  | { type: 'COMFY_MOVE_WORKFLOW'; payload: { workflowId: string; direction: 'up' | 'down' } }
  | { type: 'COMFY_TEST_ON_LOAD' }
  | { type: 'COMFY_ENQUEUE_POSTS'; payload: { posts: UnifiedPost[]; batchId: string } }
  | { type: 'COMFY_ENQUEUE_FILES'; payload: { inputs: ComfyBlobInput[]; batchId: string } }
  | { type: 'COMFY_ENQUEUE_COLLECTION'; payload: { collectionId: string; posts: UnifiedPost[]; batchId: string } }
  | { type: 'COMFY_MOVE_TASK'; payload: { taskId: string; direction: 'up' | 'down' } }
  | { type: 'COMFY_REMOVE_TASK'; payload: { taskId: string } }
  | { type: 'COMFY_CANCEL_TASK'; payload: { taskId: string; allowGlobalInterrupt: boolean } }
  | { type: 'COMFY_RETRY_TASK'; payload: { taskId: string } }
  | { type: 'COMFY_GET_HISTORY'; payload: { cursor?: string; limit: number } }
  | { type: 'COMFY_GET_OUTPUT'; payload: { historyId: string; outputIndex: number } }
  | { type: 'COMFY_STAGE_FILES'; payload: { files: Array<{ name: string; mediaType: string; blob: Blob }> } }
  | { type: 'COMFY_MARK_READ' }
  | { type: 'COMFY_DELETE_HISTORY'; payload: { historyId: string } }
  | { type: 'COMFY_CLEAR_HISTORY' };

export interface ComfyStateUpdateMessage {
  type: 'COMFY_STATE_UPDATE';
  payload: { tasks: ComfyTaskSummary[]; unreadCount: number };
}

export type ComfyResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ComfyErrorCode; message: string } };

export const COMFY_STORAGE_SCHEMA_VERSION = 1;
export const COMFY_STORAGE = {
  database: 'danbooru-viewer-comfy',
  stores: {
    metadata: 'metadata',
    workflows: 'workflows',
    tasks: 'tasks',
    history: 'history',
    inputBlobs: 'input-blobs',
    outputBlobs: 'output-blobs',
  },
  keys: {
    schema: '__schema_version__',
    activeWorkflow: '__active_workflow__',
    workflow: (id: string) => `workflow:${id}`,
    task: (id: string) => `task:${id}`,
    history: (id: string) => `history:${id}`,
    inputBlob: (id: string) => `input:${id}`,
    outputBlob: (id: string) => `output:${id}`,
    settings: '__settings__',
  },
} as const;

export const DEFAULT_COMFY_SETTINGS: ComfySettingsSnapshot = {
  baseUrl: 'http://127.0.0.1:8188/',
  historyLimit: 100,
  storageLimitBytes: 1024 * 1024 * 1024,
  replaceReverseWithTags: true,
  cacheOutputs: true,
};
