import { cancelProxyRequest, proxyRequest } from './api-proxy';
import { getMessages, getRuntimeLanguage, initializeRuntimeI18n, subscribeRuntimeLanguage } from '../i18n/runtime-core';
import { connectComfyWorkbench, initializeComfyBackground, routeComfyMessage } from './comfy-router';

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
chrome.runtime.onConnect?.addListener(connectComfyWorkbench);

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;
  if ((message as { type?: string }).type === 'GET_LANGUAGE') {
    void initializeRuntimeI18n().then(() => sendResponse({ language: getRuntimeLanguage() }));
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
