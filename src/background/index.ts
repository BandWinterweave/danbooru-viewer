import { cancelProxyRequest, proxyRequest } from './api-proxy';
import { getMessages, getRuntimeLanguage, initializeRuntimeI18n, subscribeRuntimeLanguage } from '../i18n/runtime-core';
import { connectComfyWorkbench, enqueuePageImage, initializeComfyBackground, isTrustedPageSender, routeComfyMessage } from './comfy-router';
import { authorizeOverlay, disablePageIntegration, enablePageIntegration, initializePageIntegration, issueOverlayToken, pageIntegrationSettings, revokeOverlay } from './page-integration';

try {
  void chrome.storage?.local?.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => undefined);
} catch {
  // Firefox and older Chromium versions do not expose setAccessLevel.
}

function broadcastLanguage() {
  void chrome.tabs.query({ url: ['https://danbooru.donmai.us/*'] }).then((tabs) => Promise.all(tabs.map((tab) => (
    typeof tab.id === 'number'
      ? chrome.tabs.sendMessage(tab.id, { type: 'LANGUAGE_CHANGED', payload: { language: getRuntimeLanguage() } }).catch(() => undefined)
      : undefined
  )))).catch(() => undefined);
}

subscribeRuntimeLanguage(broadcastLanguage);
void initializeRuntimeI18n();
void initializeComfyBackground().catch(() => undefined);
initializePageIntegration();
chrome.runtime.onConnect?.addListener(connectComfyWorkbench);

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;
  if ((message as { type?: string }).type === 'GET_LANGUAGE') {
    void initializeRuntimeI18n().then(() => sendResponse({ language: getRuntimeLanguage() }));
    return true;
  }
  if ((message as { type?: string }).type === 'PAGE_GET_SETTINGS') {
    if (!isTrustedPageSender(sender)) { sendResponse({ enabled: false, minPixels: 262_144 }); return false; }
    void pageIntegrationSettings().then((settings) => sendResponse({ ...settings, language: getRuntimeLanguage() }), () => sendResponse({ enabled: false, minPixels: 262_144, language: getRuntimeLanguage() }));
    return true;
  }
  if ((message as { type?: string }).type === 'PAGE_CREATE_WORKBENCH') {
    if (!isTrustedPageSender(sender)) { sendResponse({ ok: false }); return false; }
    void pageIntegrationSettings().then((settings) => sendResponse(settings.enabled ? { ok: true, token: issueOverlayToken(sender) } : { ok: false }), () => sendResponse({ ok: false }));
    return true;
  }
  if ((message as { type?: string }).type === 'PAGE_VALIDATE_WORKBENCH') {
    sendResponse({ ok: authorizeOverlay((message as { payload?: { token?: unknown } }).payload?.token, sender) });
    return false;
  }
  if ((message as { type?: string }).type === 'PAGE_REVOKE_WORKBENCH') {
    revokeOverlay(sender);
    sendResponse({ ok: true });
    return false;
  }
  if ((message as { type?: string }).type === 'PAGE_INTEGRATION_ENABLE') {
    const trusted = sender.id === chrome.runtime.id && Boolean(sender.url?.startsWith(chrome.runtime.getURL('')));
    const minPixels = Number((message as { payload?: { minPixels?: unknown } }).payload?.minPixels);
    if (!trusted || !Number.isSafeInteger(minPixels)) { sendResponse({ ok: false }); return false; }
    void enablePageIntegration(minPixels).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  if ((message as { type?: string }).type === 'PAGE_INTEGRATION_DISABLE') {
    const trusted = sender.id === chrome.runtime.id && Boolean(sender.url?.startsWith(chrome.runtime.getURL('')));
    if (!trusted) { sendResponse({ ok: false }); return false; }
    void disablePageIntegration().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  if ((message as { type?: string }).type === 'PAGE_ENQUEUE_IMAGE') {
    void pageIntegrationSettings().then((settings) => settings.enabled ? enqueuePageImage(message, sender) : Promise.resolve({ ok: false as const, error: { code: 'validation' as const, message: 'Website integration is disabled' } })).then(sendResponse, () => sendResponse({ ok: false, error: { code: 'media', message: 'Page image could not be queued' } }));
    return true;
  }
  if ((message as { type?: string }).type === 'API_CANCEL') {
    const requestId = (message as { payload?: { requestId?: unknown } }).payload?.requestId;
    sendResponse({ ok: typeof requestId === 'string' && cancelProxyRequest(requestId) });
    return false;
  }
  if (typeof (message as { type?: unknown }).type === 'string' && (message as { type: string }).type.startsWith('COMFY_')) {
    void routeComfyMessage(message, sender).then(sendResponse, () => sendResponse({ ok: false, error: { code: 'validation', message: 'ComfyUI background request failed' } }));
    return true;
  }
  if ((message as { type?: string }).type !== 'API_REQUEST') return false;
  void proxyRequest(message).then(sendResponse, () => sendResponse({ ok: false, status: 0, reason: 'network', error: getMessages().domainActions.network.backgroundFailed }));
  return true;
});
