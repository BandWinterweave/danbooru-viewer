import { describe, expect, it } from 'vitest';
import { ComfyExecutor, extractComfyOutputs } from '../../src/services/comfy/executor';
import type { ComfyHistoryEntry } from '../../src/services/comfy/client';
import type { ComfyOutputReference, ComfyTaskSnapshot } from '../../src/services/comfy/types';
import type { ComfyStorage } from '../../src/services/comfy/storage';

describe('extractComfyOutputs', () => {
  it('collects only declared OUTPUT image and text values', () => {
    const entry: ComfyHistoryEntry = {
      status: { status_str: 'success', completed: true, messages: [] },
      outputs: {
        '2': { images: [{ filename: 'out.png', subfolder: 'run', type: 'output' }], text: ['caption'] },
        '3': { images: [{ filename: 'ignored.png', type: 'output' }] },
      },
    };
    expect(extractComfyOutputs(entry, ['2'])).toEqual([
      { nodeId: '2', kind: 'image', filename: 'out.png', subfolder: 'run', type: 'output' },
      { nodeId: '2', kind: 'text', text: 'caption' },
    ]);
  });

  it('serializes text-then-image task updates without losing the text output', async () => {
    const task = {
      id: 'task', batchId: 'batch', status: 'running', workflowId: 'workflow', sourceLabel: 'post', serverUrl: 'http://127.0.0.1:8188/',
      createdAt: 1, updatedAt: 1, workflow: {}, optionValues: {}, input: { kind: 'blob', blobKey: 'blob', name: 'input.png', mediaType: 'image/png' }, clientId: 'client', attempts: 1,
    } as ComfyTaskSnapshot;
    let stored = task;
    const storage = {
      getTask: async () => structuredClone(stored),
      saveTask: async (value: ComfyTaskSnapshot) => { await Promise.resolve(); stored = structuredClone(value); },
    } as unknown as ComfyStorage;
    const executor = new ComfyExecutor({ storage });
    const update = (executor as unknown as {
      update: (value: ComfyTaskSnapshot, patch: (current: ComfyTaskSnapshot) => Partial<ComfyTaskSnapshot>) => Promise<ComfyTaskSnapshot>;
    }).update.bind(executor);
    const append = (output: ComfyOutputReference) => (current: ComfyTaskSnapshot) => ({ outputs: [...(current.outputs ?? []), output] });

    await Promise.all([
      update(task, append({ nodeId: 'text', kind: 'text', text: 'tags' })),
      update(task, append({ nodeId: 'image', kind: 'image', filename: 'result.png' })),
    ]);

    expect(stored.outputs).toEqual([
      { nodeId: 'text', kind: 'text', text: 'tags' },
      { nodeId: 'image', kind: 'image', filename: 'result.png' },
    ]);
  });
});
