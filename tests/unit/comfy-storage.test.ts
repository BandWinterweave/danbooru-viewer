import { describe, expect, it } from 'vitest';
import { ComfyStorage, ComfyStorageError } from '../../src/services/comfy/storage';
import type { ComfyWorkflowPreset } from '../../src/services/comfy/types';

function preset(name: string, active: boolean, order: number): ComfyWorkflowPreset {
  const now = Date.now();
  return { id: crypto.randomUUID(), name, active, order, options: {}, workflow: { '1': { class_type: 'LoadImage', inputs: { image: '' }, _meta: { title: 'INPUT' } } }, createdAt: now, updatedAt: now };
}

describe('ComfyStorage', () => {
  it('stores, activates, reorders, and protects active workflow presets', async () => {
    const storage = new ComfyStorage();
    await storage.initialize();
    const first = preset('first', true, 0);
    const second = preset('second', false, 1);
    await storage.saveWorkflow(first);
    await storage.saveWorkflow(second);
    await expect(storage.deleteWorkflow(first.id)).rejects.toBeInstanceOf(ComfyStorageError);
    await storage.setActiveWorkflow(second.id);
    expect((await storage.listWorkflows()).find((item) => item.id === second.id)?.active).toBe(true);
    await storage.reorderWorkflow(second.id, 'up');
    expect((await storage.listWorkflows())[0].id).toBe(second.id);
    await storage.deleteWorkflow(first.id);
    expect(await storage.getWorkflow(first.id)).toBeUndefined();
  });

  it('does not evict a leased input when storage is full', async () => {
    const storage = new ComfyStorage();
    const record = await storage.putInputBlob(new Blob([new Uint8Array(8)]), 'input.png', 'image/png', 12);
    await storage.leaseBlob(record.key, 'task-1');
    await expect(storage.putInputBlob(new Blob([new Uint8Array(8)]), 'next.png', 'image/png', 12)).rejects.toThrow('protected');
    expect((await storage.getBlob(record.key, 'input'))?.size).toBe(8);
  });
});
