import { describe, expect, it } from 'vitest';
import { validateComfyMessage } from '../../src/background/comfy-router';

describe('ComfyUI background message validation', () => {
  it('accepts bounded localhost settings', () => {
    const value = validateComfyMessage({ type: 'COMFY_SAVE_SETTINGS', payload: { baseUrl: 'http://127.0.0.1:8188', historyLimit: 100, storageLimitBytes: 1024 ** 3, replaceReverseWithTags: true, cacheOutputs: true } });
    expect('ok' in value).toBe(false);
  });

  it('rejects remote servers and direct Blob messages', () => {
    const remote = validateComfyMessage({ type: 'COMFY_SAVE_SETTINGS', payload: { baseUrl: 'http://192.168.1.2:8188', historyLimit: 100, storageLimitBytes: 1024 ** 3, replaceReverseWithTags: true, cacheOutputs: true } });
    expect(remote).toMatchObject({ ok: false });
    expect(validateComfyMessage({ type: 'COMFY_STAGE_FILES', payload: { files: [{ name: 'x.png', mediaType: 'image/png', blob: new Blob() }] } })).toMatchObject({ ok: false });
  });

  it('rejects malformed file references and unknown messages', () => {
    expect(validateComfyMessage({ type: 'COMFY_ENQUEUE_FILES', payload: { batchId: 'b', inputs: [{ kind: 'blob', blobKey: '', name: 'x.png', mediaType: 'image/png' }] } })).toMatchObject({ ok: false });
    expect(validateComfyMessage({ type: 'COMFY_FETCH_ANY_URL', payload: { url: 'http://127.0.0.1:8188/system_stats' } })).toMatchObject({ ok: false });
  });
});
