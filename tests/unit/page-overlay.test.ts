import { afterEach, describe, expect, it, vi } from 'vitest';

describe('third-party page overlay', () => {
  afterEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mounts only one workbench while an open request is in flight', async () => {
    vi.resetModules();
    let resolveSession!: (value: { ok: true; token: string }) => void;
    const session = new Promise<{ ok: true; token: string }>((resolve) => { resolveSession = resolve; });
    const sendMessage = vi.fn((message: { type: string }) => message.type === 'PAGE_GET_SETTINGS'
      ? Promise.resolve({ enabled: true, minPixels: 1, language: 'en' })
      : message.type === 'PAGE_CREATE_WORKBENCH' ? session : Promise.resolve({ ok: true }));
    const runtimeListeners: Array<(message: unknown) => void> = [];
    vi.stubGlobal('chrome', { runtime: { sendMessage, getURL: (path: string) => `chrome-extension://viewer/${path}`, onMessage: { addListener: (listener: (message: unknown) => void) => runtimeListeners.push(listener), removeListener: vi.fn() } } });
    const attachShadow = Element.prototype.attachShadow;
    vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init) { return attachShadow.call(this, { ...init, mode: 'open' }); });

    await import('../../src/content/page-overlay');
    await vi.waitFor(() => expect(document.querySelector('#danbooru-viewer-page-overlay')).not.toBeNull());
    const shadow = document.querySelector('#danbooru-viewer-page-overlay')!.shadowRoot!;
    const launcher = shadow.querySelector<HTMLButtonElement>('#dv-launcher')!;
    launcher.click();
    launcher.click();
    expect(sendMessage.mock.calls.filter(([message]) => message.type === 'PAGE_CREATE_WORKBENCH')).toHaveLength(1);

    resolveSession({ ok: true, token: 'single-session' });
    await vi.waitFor(() => expect(shadow.querySelectorAll('#dv-workbench')).toHaveLength(1));
    runtimeListeners.forEach((listener) => listener({ type: 'PAGE_OVERLAY_REMOVE' }));
  });
});
