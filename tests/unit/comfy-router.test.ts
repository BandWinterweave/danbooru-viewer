import { describe, expect, it } from 'vitest';
import { isAllowedPageImageUrl, validateComfyMessage } from '../../src/background/comfy-router';

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

  it('allows public image hosts and blocks privileged network destinations', () => {
    expect(isAllowedPageImageUrl('https://i.pinimg.com/image.jpg')).toBe(true);
    expect(isAllowedPageImageUrl('https://user:secret@example.com/image.jpg')).toBe(false);
    expect(isAllowedPageImageUrl('http://localhost:8188/view')).toBe(false);
    expect(isAllowedPageImageUrl('http://127.0.0.1/image')).toBe(false);
    expect(isAllowedPageImageUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isAllowedPageImageUrl('http://192.168.1.20/image')).toBe(false);
    expect(isAllowedPageImageUrl('http://[::1]/image')).toBe(false);
    expect(isAllowedPageImageUrl('http://printer.local/image')).toBe(false);
  });
});
