import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeOverlay, disablePageIntegration, enablePageIntegration, isAuthorizedOverlaySender, issueOverlayToken, revokeOverlay } from '../../src/background/page-integration';

describe('third-party page integration registration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registers the stable overlay script and injects existing HTTP pages', async () => {
    const registerContentScripts = vi.fn().mockResolvedValue(undefined);
    const executeScript = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
      runtime: { getManifest: () => ({ content_scripts: [{ matches: ['https://danbooru.donmai.us/posts*'], js: ['main.js', 'compiled-overlay.js'] }] }) },
      permissions: { contains: vi.fn().mockResolvedValue(true) },
      scripting: { getRegisteredContentScripts: vi.fn().mockResolvedValue([]), registerContentScripts, executeScript, unregisterContentScripts: vi.fn().mockResolvedValue(undefined) },
      tabs: { query: vi.fn().mockResolvedValue([{ id: 7 }]), sendMessage: vi.fn().mockResolvedValue(undefined) },
    });

    await enablePageIntegration(262_144);

    expect(registerContentScripts).toHaveBeenCalledWith([expect.objectContaining({ id: 'danbooru-viewer-page-overlay', matches: ['http://*/*', 'https://*/*'], js: ['compiled-overlay.js'] })]);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, files: ['compiled-overlay.js'] });
  });

  it('unregisters the script and removes launchers from open tabs', async () => {
    const unregisterContentScripts = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', { scripting: { unregisterContentScripts }, tabs: { query: vi.fn().mockResolvedValue([{ id: 9 }]), sendMessage } });

    await disablePageIntegration();

    expect(unregisterContentScripts).toHaveBeenCalledWith({ ids: ['danbooru-viewer-page-overlay'] });
    expect(sendMessage).toHaveBeenCalledWith(9, { type: 'PAGE_OVERLAY_REMOVE' });
  });

  it('authorizes an overlay token once for the issuing tab and document', () => {
    vi.stubGlobal('chrome', { runtime: { getURL: (path: string) => `chrome-extension://viewer/${path}` } });
    const pageSender = { tab: { id: 7 }, frameId: 0 } as chrome.runtime.MessageSender;
    const overlaySender = { tab: { id: 7 }, frameId: 3, documentId: 'overlay-document', url: 'chrome-extension://viewer/src/overlay/index.html?token=hidden' } as chrome.runtime.MessageSender & { documentId: string };
    const token = issueOverlayToken(pageSender);

    expect(authorizeOverlay(token, overlaySender)).toBe(true);
    expect(isAuthorizedOverlaySender(overlaySender)).toBe(true);
    expect(authorizeOverlay(token, { ...overlaySender, documentId: 'another-document' } as chrome.runtime.MessageSender & { documentId: string })).toBe(false);
    revokeOverlay(overlaySender);
    expect(isAuthorizedOverlaySender(overlaySender)).toBe(false);
  });
});
