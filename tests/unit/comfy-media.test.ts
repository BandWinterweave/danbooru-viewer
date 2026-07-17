import { describe, expect, it } from 'vitest';
import { normalizeComfyMedia } from '../../src/services/comfy/media';

describe('normalizeComfyMedia', () => {
  it('keeps a static image blob and cleans its filename', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    const result = await normalizeComfyMedia(blob, 'bad:name.png');
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe('bad_name.png');
    expect(result.mediaType).toBe('image/png');
  });

  it('rejects invalid ugoira archives with a media error', async () => {
    await expect(normalizeComfyMedia(new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])]), 'frames.zip')).rejects.toMatchObject({ code: 'media' });
  });

  it('rejects unsupported local files before upload', async () => {
    await expect(normalizeComfyMedia(new Blob(['text'], { type: 'text/plain' }), 'notes.txt')).rejects.toThrow('Unsupported media type');
  });
});
