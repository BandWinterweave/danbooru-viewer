import { PAGE_INTEGRATION_ORIGINS } from '../services/comfy/page-integration';

const SETTINGS_KEY = 'danbooru-settings';
const SCRIPT_ID = 'danbooru-viewer-page-overlay';
const PAGE_MATCHES = ['http://*/*', 'https://*/*'];
const DEFAULT_MIN_PIXELS = 262_144;
const TOKEN_TTL_MS = 60_000;

interface PageIntegrationSettings {
  enabled: boolean;
  minPixels: number;
}

let override: PageIntegrationSettings | null = null;
const overlayTokens = new Map<string, { tabId: number; expiresAt: number }>();
const authorizedOverlays = new Set<string>();

function overlaySenderKey(sender: chrome.runtime.MessageSender) {
  if (typeof sender.tab?.id !== 'number' || typeof sender.frameId !== 'number') return '';
  const documentId = (sender as chrome.runtime.MessageSender & { documentId?: string }).documentId;
  return `${sender.tab.id}:${documentId ?? `frame-${sender.frameId}`}`;
}

export function issueOverlayToken(sender: chrome.runtime.MessageSender) {
  if (typeof sender.tab?.id !== 'number') return '';
  const token = crypto.randomUUID();
  overlayTokens.set(token, { tabId: sender.tab.id, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

export function authorizeOverlay(token: unknown, sender: chrome.runtime.MessageSender) {
  const sourceUrl = sender.url ?? (sender as chrome.runtime.MessageSender & { origin?: string }).origin;
  const record = typeof token === 'string' ? overlayTokens.get(token) : undefined;
  if (typeof token === 'string') overlayTokens.delete(token);
  const key = overlaySenderKey(sender);
  if (!record || record.expiresAt < Date.now() || record.tabId !== sender.tab?.id || !key || !sourceUrl?.startsWith(chrome.runtime.getURL('src/overlay/index.html'))) return false;
  authorizedOverlays.add(key);
  return true;
}

export function revokeOverlay(sender: chrome.runtime.MessageSender) {
  const key = overlaySenderKey(sender);
  if (key) authorizedOverlays.delete(key);
}

export function isAuthorizedOverlaySender(sender: chrome.runtime.MessageSender) {
  const key = overlaySenderKey(sender);
  return Boolean(key && authorizedOverlays.has(key));
}

function overlayScriptFile() {
  const scripts = chrome.runtime?.getManifest?.().content_scripts?.find((script) => script.js && script.js.length > 1)?.js;
  return scripts?.at(-1) ?? 'page-overlay.js';
}

function parseSettings(value: unknown): PageIntegrationSettings {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) as { state?: Record<string, unknown> } : null;
    const state = parsed?.state;
    const minPixels = Number(state?.comfyPageImageMinPixels);
    return {
      enabled: state?.comfyPageIntegrationEnabled === true,
      minPixels: Number.isSafeInteger(minPixels) ? Math.min(100_000_000, Math.max(1, minPixels)) : DEFAULT_MIN_PIXELS,
    };
  } catch {
    return { enabled: false, minPixels: DEFAULT_MIN_PIXELS };
  }
}

async function storedSettings(): Promise<PageIntegrationSettings> {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    return parseSettings(stored[SETTINGS_KEY]);
  } catch {
    return { enabled: false, minPixels: DEFAULT_MIN_PIXELS };
  }
}

async function hasPermission() {
  return Boolean(await chrome.permissions?.contains?.({ origins: PAGE_INTEGRATION_ORIGINS }).catch(() => false));
}

async function unregisterOverlay() {
  if (chrome.scripting?.unregisterContentScripts) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] }).catch(() => undefined);
  const tabs = await chrome.tabs.query({}).catch(() => []);
  await Promise.all(tabs.map((tab) => typeof tab.id === 'number' ? chrome.tabs.sendMessage(tab.id, { type: 'PAGE_OVERLAY_REMOVE' }).catch(() => undefined) : undefined));
}

async function registerOverlay(injectOpenTabs: boolean) {
  if (!chrome.scripting?.registerContentScripts) return;
  const scriptFile = overlayScriptFile();
  const current = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] }).catch(() => []);
  const stale = current.length > 0 && (current[0].js?.length !== 1 || current[0].js[0] !== scriptFile);
  if (stale) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  if (!current.length || stale) await chrome.scripting.registerContentScripts([{ id: SCRIPT_ID, matches: PAGE_MATCHES, js: [scriptFile], runAt: 'document_idle', persistAcrossSessions: true }]);
  if (!injectOpenTabs) return;
  const tabs = await chrome.tabs.query({ url: PAGE_MATCHES }).catch(() => []);
  await Promise.all(tabs.map((tab) => typeof tab.id === 'number' ? chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [scriptFile] }).catch(() => undefined) : undefined));
}

async function broadcastSettings(settings: PageIntegrationSettings) {
  const tabs = await chrome.tabs.query({}).catch(() => []);
  await Promise.all(tabs.map((tab) => typeof tab.id === 'number' ? chrome.tabs.sendMessage(tab.id, { type: 'PAGE_SETTINGS_CHANGED', payload: settings }).catch(() => undefined) : undefined));
}

export async function pageIntegrationSettings(): Promise<PageIntegrationSettings> {
  const settings = override ?? await storedSettings();
  return { ...settings, enabled: settings.enabled && await hasPermission() };
}

export async function enablePageIntegration(minPixels: number): Promise<void> {
  override = { enabled: true, minPixels: Math.min(100_000_000, Math.max(1, Math.round(minPixels) || DEFAULT_MIN_PIXELS)) };
  if (!await hasPermission()) return;
  await registerOverlay(true);
  await broadcastSettings(override);
}

export async function disablePageIntegration(): Promise<void> {
  override = { enabled: false, minPixels: override?.minPixels ?? DEFAULT_MIN_PIXELS };
  await unregisterOverlay();
}

async function syncFromStorage(injectOpenTabs = false) {
  override = null;
  const settings = await pageIntegrationSettings();
  if (settings.enabled) await registerOverlay(injectOpenTabs);
  else await unregisterOverlay();
  await broadcastSettings(settings);
}

export function initializePageIntegration(): void {
  void syncFromStorage().catch(() => undefined);
  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName === 'local' && SETTINGS_KEY in changes) void syncFromStorage(true).catch(() => undefined);
  });
  chrome.permissions?.onAdded?.addListener((permissions) => {
    if (permissions.origins?.includes('<all_urls>')) void syncFromStorage(true).catch(() => undefined);
  });
  chrome.permissions?.onRemoved?.addListener((permissions) => {
    if (permissions.origins?.includes('<all_urls>')) void disablePageIntegration();
  });
  chrome.tabs?.onUpdated?.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'loading') return;
    for (const key of authorizedOverlays) if (key.startsWith(`${tabId}:`)) authorizedOverlays.delete(key);
    for (const [token, record] of overlayTokens) if (record.tabId === tabId) overlayTokens.delete(token);
  });
  chrome.tabs?.onRemoved?.addListener((tabId) => {
    for (const key of authorizedOverlays) if (key.startsWith(`${tabId}:`)) authorizedOverlays.delete(key);
    for (const [token, record] of overlayTokens) if (record.tabId === tabId) overlayTokens.delete(token);
  });
}
