import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../../src/services/api/client';

describe('API client cancellation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a matching background cancellation message when aborted', async () => {
    const messages: unknown[] = [];
    const sendMessage = vi.fn((message: unknown) => {
      messages.push(message);
      if ((message as { type?: string }).type === 'API_CANCEL') return Promise.resolve({ ok: true });
      return new Promise(() => undefined);
    });
    vi.stubGlobal('chrome', { runtime: { id: 'extension-id', sendMessage } });
    const controller = new AbortController();

    const request = apiGet(new URL('https://danbooru.donmai.us/posts.json'), undefined, controller.signal);
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(messages).toHaveLength(2);
    const requestId = (messages[0] as { payload: { requestId: string } }).payload.requestId;
    expect(requestId).toEqual(expect.any(String));
    expect(messages[1]).toEqual({ type: 'API_CANCEL', payload: { requestId } });
  });
});
