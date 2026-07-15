import type { ApiProxyRequest } from '../types/api';
import { proxyRequest } from './api-proxy';

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || (message as { type?: string }).type !== 'API_REQUEST') return false;
  proxyRequest(message as ApiProxyRequest).then(sendResponse);
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-slideshow') void chrome.runtime.sendMessage({ type: 'TOGGLE_SLIDESHOW' }).catch(() => undefined);
});
