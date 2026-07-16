import { proxyRequest } from './api-proxy';

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || (message as { type?: string }).type !== 'API_REQUEST') return false;
  void proxyRequest(message).then(sendResponse, () => sendResponse({ ok: false, status: 0, error: 'Background request failed' }));
  return true;
});
