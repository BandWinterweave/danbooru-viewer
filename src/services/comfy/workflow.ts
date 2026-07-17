import type { TagCopyOptions } from '../tag-copy';
import { formatTagsForCopy } from '../tag-copy';
import type { UnifiedPost } from '../../types/post';
import type {
  ComfyOption,
  ComfyValue,
  ComfyWorkflow,
  ComfyWorkflowNode,
  ParsedComfyWorkflow,
  WorkflowIssue,
} from './types';

const INTEGER_OPTION_KEYS = ['value', 'integer', 'number', 'input'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneWorkflow(workflow: ComfyWorkflow): ComfyWorkflow {
  return structuredClone(workflow);
}

function isDirectLink(value: unknown): value is [string, number] {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && value[0].length > 0 && typeof value[1] === 'number' && Number.isSafeInteger(value[1]) && value[1] >= 0;
}

function isLinkTo(value: unknown, nodeId: string): boolean {
  return isDirectLink(value) && value[0] === nodeId;
}

function containsLinkTo(value: unknown, nodeId: string): boolean {
  if (isLinkTo(value, nodeId)) return true;
  if (Array.isArray(value)) return value.some((item) => containsLinkTo(item, nodeId));
  if (isRecord(value)) return Object.values(value).some((item) => containsLinkTo(item, nodeId));
  return false;
}

export class ComfyWorkflowError extends Error {
  constructor(readonly issues: WorkflowIssue[]) {
    super(issues.map((issue) => issue.message).join('; '));
    this.name = 'ComfyWorkflowError';
  }
}

function issue(
  code: WorkflowIssue['code'],
  workflowName: string,
  message: string,
  nodeId?: string,
  nodeTitle?: string,
  field?: string,
): WorkflowIssue {
  return { code, workflowName, message, nodeId, nodeTitle, field };
}

export function parseApiWorkflowJson(apiJson: string, name = 'Workflow'): ParsedComfyWorkflow {
  let value: unknown;
  try {
    value = JSON.parse(apiJson) as unknown;
  } catch {
    throw new ComfyWorkflowError([issue('invalid-json', name, `${name}: invalid JSON`)]);
  }
  return validateApiWorkflow(value, name);
}

export function validateApiWorkflow(value: unknown, name = 'Workflow'): ParsedComfyWorkflow {
  if (!isRecord(value)) {
    throw new ComfyWorkflowError([issue('invalid-root', name, `${name}: API workflow must be an object`)]);
  }
  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new ComfyWorkflowError([issue('empty-workflow', name, `${name}: API workflow has no nodes`)]);
  }

  const issues: WorkflowIssue[] = [];
  const inputNodeIds: string[] = [];
  const outputNodeIds: string[] = [];
  const reverseNodeIds: string[] = [];
  const options: ComfyOption[] = [];

  for (const [nodeId, rawNode] of entries) {
    if (!isRecord(rawNode)) {
      issues.push(issue('invalid-node', name, `${name}, node ${nodeId}: node must be an object`, nodeId));
      continue;
    }
    const rawMeta = rawNode._meta;
    const title = isRecord(rawMeta) && typeof rawMeta.title === 'string' ? rawMeta.title : undefined;
    if (typeof rawNode.class_type !== 'string' || rawNode.class_type.trim() === '') {
      issues.push(issue('missing-class-type', name, `${name}, node ${nodeId}: class_type must be a non-empty string`, nodeId, title, 'class_type'));
    }
    if (!isRecord(rawNode.inputs)) {
      issues.push(issue('missing-inputs', name, `${name}, node ${nodeId}: inputs must be an object`, nodeId, title, 'inputs'));
      continue;
    }
    const rawInputs = rawNode.inputs;
    if (rawMeta !== undefined && (!isRecord(rawMeta) || (rawMeta.title !== undefined && typeof rawMeta.title !== 'string'))) {
      issues.push(issue('invalid-meta', name, `${name}, node ${nodeId}: _meta.title must be a string`, nodeId, undefined, '_meta.title'));
      continue;
    }
    if (!title) continue;

    if (title === 'INPUT') {
      inputNodeIds.push(nodeId);
      if (typeof rawInputs.image !== 'string') {
        issues.push(issue('invalid-input-image', name, `${name}, node ${nodeId} (INPUT): inputs.image must be a string`, nodeId, title, 'inputs.image'));
      }
      continue;
    }
    if (title.startsWith('OUTPUT')) {
      outputNodeIds.push(nodeId);
      continue;
    }
    if (title === 'REVERSE') {
      reverseNodeIds.push(nodeId);
      if (typeof rawInputs.text !== 'string' && !isDirectLink(rawInputs.text)) {
        issues.push(issue('invalid-reverse-text', name, `${name}, node ${nodeId} (REVERSE): inputs.text must be a string or direct output connection`, nodeId, title, 'inputs.text'));
      }
      continue;
    }
    if (!/^OPTION.+/.test(title)) continue;

    if (typeof rawInputs.text === 'string') {
      options.push({ nodeId, title, kind: 'text', inputKey: 'text', value: rawInputs.text });
      continue;
    }
    const integerKey = INTEGER_OPTION_KEYS.find((key) => Number.isSafeInteger(rawInputs[key]));
    if (integerKey) {
      options.push({ nodeId, title, kind: 'integer', inputKey: integerKey, value: rawInputs[integerKey] as number });
    } else {
      issues.push(issue('invalid-option', name, `${name}, node ${nodeId} (${title}): OPTION requires inputs.text or a safe integer input`, nodeId, title, 'inputs'));
    }
  }

  if (inputNodeIds.length === 0) {
    issues.push(issue('missing-input', name, `${name}: at least one node titled INPUT is required`));
  }
  for (const option of options) {
    if (option.kind !== 'integer') continue;
    for (const [nodeId, rawNode] of entries) {
      if (nodeId === option.nodeId || !isRecord(rawNode) || !isRecord(rawNode.inputs)) continue;
      for (const [inputKey, input] of Object.entries(rawNode.inputs)) {
        if (!isLinkTo(input, option.nodeId) && containsLinkTo(input, option.nodeId)) {
          issues.push(issue(
            'invalid-option-link',
            name,
            `${name}, node ${nodeId}: integer OPTION ${option.nodeId} is referenced inside nested input ${inputKey}`,
            nodeId,
            isRecord(rawNode._meta) && typeof rawNode._meta.title === 'string' ? rawNode._meta.title : undefined,
            `inputs.${inputKey}`,
          ));
        }
      }
    }
  }
  if (issues.length > 0) throw new ComfyWorkflowError(issues);

  return {
    name,
    workflow: cloneWorkflow(value as unknown as ComfyWorkflow),
    inputNodeIds,
    outputNodeIds,
    reverseNodeIds,
    options,
  };
}

export interface PrepareWorkflowOptions {
  imagePath: string;
  reverseText?: string;
  optionValues?: Record<string, string | number>;
}

function setNodeInput(node: ComfyWorkflowNode, key: string, value: ComfyValue): void {
  node.inputs[key] = value;
}

export function prepareWorkflow(parsed: ParsedComfyWorkflow, values: PrepareWorkflowOptions): ComfyWorkflow {
  const workflow = cloneWorkflow(parsed.workflow);
  for (const nodeId of parsed.inputNodeIds) setNodeInput(workflow[nodeId], 'image', values.imagePath);
  if (values.reverseText !== undefined) {
    for (const nodeId of parsed.reverseNodeIds) setNodeInput(workflow[nodeId], 'text', values.reverseText);
  }

  for (const option of parsed.options) {
    const value = values.optionValues?.[option.nodeId] ?? option.value;
    if (option.kind === 'text') {
      if (typeof value !== 'string') throw new TypeError(`${option.title} requires a text value`);
      setNodeInput(workflow[option.nodeId], option.inputKey, value);
      continue;
    }
    if (!Number.isSafeInteger(value)) throw new TypeError(`${option.title} requires a safe integer value`);
    for (const [nodeId, node] of Object.entries(workflow)) {
      if (nodeId === option.nodeId) continue;
      for (const [key, input] of Object.entries(node.inputs)) {
        if (isLinkTo(input, option.nodeId)) {
          setNodeInput(node, key, value);
        }
      }
    }
    delete workflow[option.nodeId];
  }
  return workflow;
}

export function formatPostTagsForReverse(post: UnifiedPost | null, options: TagCopyOptions): string {
  return post ? formatTagsForCopy(post, options) : '';
}
