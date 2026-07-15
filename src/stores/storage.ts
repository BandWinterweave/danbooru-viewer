import type { StateStorage } from 'zustand/middleware';

const fallbackStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
};

export const extensionStorage: StateStorage = {
  async getItem(name) {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return fallbackStorage.getItem(name);
    const result = await chrome.storage.local.get(name);
    return typeof result[name] === 'string' ? result[name] : null;
  },
  async setItem(name, value) {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return fallbackStorage.setItem(name, value);
    await chrome.storage.local.set({ [name]: value });
  },
  async removeItem(name) {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return fallbackStorage.removeItem(name);
    await chrome.storage.local.remove(name);
  },
};
