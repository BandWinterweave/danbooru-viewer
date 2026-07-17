import { afterEach, describe, expect, it, vi } from 'vitest';

describe('runtime i18n initialization', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('falls back safely when extension storage rejects', async () => {
    vi.stubGlobal('chrome', {
      i18n: { getUILanguage: () => 'en' },
      storage: {
        local: { get: vi.fn().mockRejectedValue(new Error('storage unavailable')) },
        onChanged: { addListener: vi.fn() },
      },
    });
    const runtime = await import('../../src/i18n/runtime-core');

    await expect(runtime.initializeRuntimeI18n()).resolves.toBeUndefined();
    await expect(runtime.initializeRuntimeI18n()).resolves.toBeUndefined();
    expect(runtime.getLocale()).toBe('en');
  });

  it('does not let a delayed stored language overwrite a newer choice', async () => {
    let resolveStorage!: (value: Record<string, string>) => void;
    vi.stubGlobal('chrome', {
      i18n: { getUILanguage: () => 'en' },
      storage: {
        local: { get: vi.fn(() => new Promise((resolve) => { resolveStorage = resolve; })) },
        onChanged: { addListener: vi.fn() },
      },
    });
    const runtime = await import('../../src/i18n/runtime-core');
    const initialization = runtime.initializeRuntimeI18n();
    runtime.setRuntimeLanguage('zh-CN');
    resolveStorage({ 'danbooru-settings': JSON.stringify({ state: { language: 'en' } }) });

    await initialization;
    expect(runtime.getRuntimeLanguage()).toBe('zh-CN');
    expect(runtime.getLocale()).toBe('zh-CN');
  });

  it('content initialization only requests language and ignores credential-shaped responses', async () => {
    let listener!: (message: unknown) => void;
    const sendMessage = vi.fn().mockResolvedValue({ credentials: { danbooru: { apiKey: 'secret' } } });
    vi.stubGlobal('chrome', {
      i18n: { getUILanguage: () => 'en' },
      runtime: {
        sendMessage,
        onMessage: { addListener: vi.fn((value) => { listener = value; }) },
      },
    });
    const runtime = await import('../../src/i18n/runtime-core');

    await runtime.initializeContentScriptI18n();
    expect(sendMessage).toHaveBeenCalledWith({ type: 'GET_LANGUAGE' });
    expect(runtime.getLocale()).toBe('en');
    listener({ type: 'LANGUAGE_CHANGED', payload: { language: 'zh-CN', credentials: { apiKey: 'secret' } } });
    expect(runtime.getLocale()).toBe('zh-CN');
  });
});
