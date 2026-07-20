export const PAGE_INTEGRATION_ORIGINS = ['<all_urls>'];

export async function requestPageIntegrationPermission(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.request) return false;
  try {
    return await chrome.permissions.request({ origins: PAGE_INTEGRATION_ORIGINS });
  } catch {
    return false;
  }
}

export async function removePageIntegrationPermission(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.permissions?.remove) return;
  const response = await chrome.runtime.sendMessage({ type: 'PAGE_INTEGRATION_DISABLE' }) as { ok?: boolean } | undefined;
  if (!response?.ok) throw new Error('Website integration could not be disabled');
  const removed = await chrome.permissions.remove({ origins: PAGE_INTEGRATION_ORIGINS });
  if (!removed && await chrome.permissions.contains({ origins: PAGE_INTEGRATION_ORIGINS })) throw new Error('Website access permission could not be removed');
}

export async function activatePageIntegration(minPixels: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) throw new Error('Website integration is unavailable');
  const response = await chrome.runtime.sendMessage({ type: 'PAGE_INTEGRATION_ENABLE', payload: { minPixels } }) as { ok?: boolean } | undefined;
  if (!response?.ok) throw new Error('Website integration could not be enabled');
}
