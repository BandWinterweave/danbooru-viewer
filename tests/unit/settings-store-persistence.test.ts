import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'danbooru-settings';

async function loadSettingsStore() {
  const { useSettingsStore } = await import('../../src/stores/settings-store');
  await useSettingsStore.persist.rehydrate();
  return useSettingsStore;
}

describe('settings store migration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('removes the obsolete slideshow setting without changing preferences', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { theme: 'dark', columns: 7, slideshowInterval: 12, credentials: { danbooru: { username: 'user', apiKey: 'key' } } }, version: 0 }));
    const store = await loadSettingsStore();
    expect(store.getState()).toMatchObject({ theme: 'dark', columns: 7, credentials: { danbooru: { username: 'user', apiKey: 'key' } } });
    expect(store.getState()).not.toHaveProperty('slideshowInterval');
  });
});
