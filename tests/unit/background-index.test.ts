import { afterEach, describe, expect, it, vi } from 'vitest';

type MessageListener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | undefined;

async function loadBackground(stored: Promise<Record<string, string>>) {
  let listener!: MessageListener;
  const storageListeners: Array<(changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void> = [];
  const setAccessLevel = vi.fn().mockResolvedValue(undefined);
  const sendTabMessage = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', {
    i18n: { getUILanguage: () => 'en' },
    storage: {
      local: { get: vi.fn(() => stored), setAccessLevel },
      onChanged: { addListener: vi.fn((value) => { storageListeners.push(value); }) },
    },
    runtime: { onMessage: { addListener: vi.fn((value) => { listener = value; }) } },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 17 }]), sendMessage: sendTabMessage },
  });
  await import('../../src/background/index');
  return { listener, setAccessLevel, storageListeners, sendTabMessage };
}

describe('background boundaries', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('restricts local storage and exposes only language to content scripts', async () => {
    const storedValue = JSON.stringify({ state: { language: 'zh-CN', credentials: { danbooru: { apiKey: 'secret' } } } });
    const { listener, setAccessLevel, storageListeners, sendTabMessage } = await loadBackground(Promise.resolve({ 'danbooru-settings': storedValue }));
    const sendResponse = vi.fn();

    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
    expect(listener({ type: 'GET_LANGUAGE' }, {}, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ language: 'zh-CN' }));
    expect(JSON.stringify(sendResponse.mock.calls)).not.toContain('secret');

    storageListeners.forEach((storageListener) => storageListener({ 'danbooru-settings': { newValue: JSON.stringify({ state: { language: 'en', credentials: { apiKey: 'other-secret' } } }) } }, 'local'));
    await vi.waitFor(() => expect(sendTabMessage).toHaveBeenCalledWith(17, { type: 'LANGUAGE_CHANGED', payload: { language: 'en' } }));
    expect(JSON.stringify(sendTabMessage.mock.calls)).not.toContain('secret');
  });

  it('serves API requests even when i18n storage initialization fails', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const { listener } = await loadBackground(Promise.reject(new Error('storage unavailable')));
    const sendResponse = vi.fn();

    expect(listener({ type: 'API_REQUEST', payload: { url: 'https://yande.re/post.json?test=background-i18n-failure' } }, {}, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: true, data: [] })));
    expect(fetch).toHaveBeenCalledOnce();
  });
});
