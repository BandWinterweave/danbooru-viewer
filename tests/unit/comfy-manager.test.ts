import { describe, expect, it, vi } from 'vitest';
import { ComfyManager } from '../../src/services/comfy/manager';
import { ComfyStorage } from '../../src/services/comfy/storage';
import type { ComfyHistoryRecord, ComfyWorkflowPreset } from '../../src/services/comfy/types';

function workflow(): ComfyWorkflowPreset {
  const now = Date.now();
  return { id: crypto.randomUUID(), name: 'Page image', active: true, order: 0, options: {}, workflow: { '1': { class_type: 'LoadImage', inputs: { image: '' }, _meta: { title: 'INPUT' } } }, createdAt: now, updatedAt: now };
}

function manager(storage: ComfyStorage) {
  const executor = { start: vi.fn().mockResolvedValue(undefined), wake: vi.fn() };
  return new ComfyManager({ storage, executor: executor as never });
}

describe('ComfyManager page and history media', () => {
  it('queues untagged blob inputs without replacing REVERSE', async () => {
    const storage = new ComfyStorage();
    await storage.initialize();
    await storage.saveWorkflow(workflow());
    const blob = await storage.putInputBlob(new Blob(['image'], { type: 'image/png' }), 'page.png', 'image/png');
    const comfy = manager(storage);

    const response = await comfy.handle({ type: 'COMFY_ENQUEUE_FILES', payload: { batchId: crypto.randomUUID(), inputs: [{ kind: 'blob', blobKey: blob.key, name: blob.name, mediaType: blob.mediaType }] } });

    expect(response.ok).toBe(true);
    expect((await storage.listTasks()).at(-1)?.reverseText).toBeUndefined();
  });

  it('falls back to the server URL when an output blob key is stale', async () => {
    const storage = new ComfyStorage();
    await storage.initialize();
    const preset = workflow();
    const now = Date.now();
    const task = { id: crypto.randomUUID(), batchId: 'batch', status: 'completed' as const, workflowId: preset.id, sourceLabel: 'image', serverUrl: 'http://127.0.0.1:8188/', workflow: preset.workflow, optionValues: {}, input: { kind: 'blob' as const, blobKey: crypto.randomUUID(), name: 'input.png', mediaType: 'image/png' }, clientId: crypto.randomUUID(), attempts: 1, createdAt: now, updatedAt: now, completedAt: now };
    const history: ComfyHistoryRecord = { id: crypto.randomUUID(), task, outputs: [{ nodeId: '2', kind: 'image', filename: 'result.png', type: 'output', blobKey: crypto.randomUUID() }], completedAt: now };
    await storage.saveHistory(history, 100);
    const comfy = manager(storage);

    const response = await comfy.handle({ type: 'COMFY_GET_OUTPUT', payload: { historyId: history.id, outputIndex: 0 } });

    expect(response).toMatchObject({ ok: true, data: { url: expect.stringContaining('/view?') } });
  });
});
