import { create } from 'zustand';
import type { ComfyHistoryRecord, ComfyRequestMessage, ComfyResponse, ComfyStateSnapshot } from '../services/comfy/types';

interface ComfyStore extends ComfyStateSnapshot {
  hydrated: boolean;
  busy: boolean;
  serviceOnline: boolean | null;
  error: string;
  history: ComfyHistoryRecord[];
  refresh: () => Promise<void>;
  hydrate: () => Promise<void>;
  request: <T = unknown>(message: ComfyRequestMessage) => Promise<T>;
  loadHistory: () => Promise<void>;
}

const emptyState: ComfyStateSnapshot = {
  settings: { baseUrl: 'http://127.0.0.1:8188/', historyLimit: 100, storageLimitBytes: 1024 ** 3, replaceReverseWithTags: true, cacheOutputs: true },
  workflows: [], tasks: [], unreadCount: 0,
};

async function runtimeRequest<T>(message: ComfyRequestMessage): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) throw new Error('ComfyUI background is unavailable');
  let response: ComfyResponse<T> | undefined;
  try {
    response = await chrome.runtime.sendMessage(message) as ComfyResponse<T> | undefined;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'ComfyUI background request failed');
  }
  if (!response) throw new Error('ComfyUI background did not respond. Reload the extension and try again.');
  if (!response.ok) throw new Error(response.error.message);
  return response.data;
}

let port: chrome.runtime.Port | null = null;

export const useComfyStore = create<ComfyStore>((set, get) => ({
  ...emptyState,
  hydrated: false,
  busy: false,
  serviceOnline: null,
  error: '',
  history: [],
  refresh: async () => {
    try {
      const snapshot = await runtimeRequest<ComfyStateSnapshot>({ type: 'COMFY_LOAD_STATE' });
      set(snapshot);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'ComfyUI state could not be refreshed' });
    }
  },
  hydrate: async () => {
    if (get().hydrated) {
      try { await runtimeRequest({ type: 'COMFY_TEST_ON_LOAD' }); set({ serviceOnline: true }); } catch { set({ serviceOnline: false }); }
      return;
    }
    set({ busy: true, error: '' });
    try {
      const snapshot = await runtimeRequest<ComfyStateSnapshot>({ type: 'COMFY_LOAD_STATE' });
      set({ ...snapshot, hydrated: true });
      if (!port && chrome.runtime?.connect) {
        port = chrome.runtime.connect({ name: 'comfy-workbench' });
        port.onMessage.addListener((message: unknown) => {
          if (message && typeof message === 'object' && (message as { type?: string }).type === 'COMFY_STATE_UPDATE') {
            const payload = (message as { payload: Pick<ComfyStateSnapshot, 'tasks' | 'unreadCount'> }).payload;
            set(payload);
          }
        });
        port.onDisconnect.addListener(() => { port = null; });
      }
      try { await runtimeRequest({ type: 'COMFY_TEST_ON_LOAD' }); set({ serviceOnline: true }); } catch { set({ serviceOnline: false }); }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'ComfyUI state could not be loaded' });
    } finally {
      set({ busy: false });
    }
  },
  request: async <T,>(message: ComfyRequestMessage) => {
    set({ busy: true, error: '' });
    try {
      const data = await runtimeRequest<T>(message);
      if (data && typeof data === 'object' && 'settings' in data && 'workflows' in data && 'tasks' in data) set(data as unknown as ComfyStateSnapshot);
      return data;
    } catch (error) {
      const text = error instanceof Error ? error.message : 'ComfyUI request failed';
      set({ error: text });
      throw error;
    } finally {
      set({ busy: false });
    }
  },
  loadHistory: async () => {
    try {
      const data = await runtimeRequest<{ items: ComfyHistoryRecord[] }>({ type: 'COMFY_GET_HISTORY', payload: { limit: 100 } });
      set({ history: data.items });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'ComfyUI history could not be refreshed' });
    }
  },
}));
