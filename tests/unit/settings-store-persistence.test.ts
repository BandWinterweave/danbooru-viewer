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
    expect(store.getState().language).toBe('system');
    expect(store.getState().thumbnailQuality).toBe('preview');
    expect(store.getState()).not.toHaveProperty('slideshowInterval');
  });

  it('persists the selected thumbnail quality', async () => {
    const store = await loadSettingsStore();
    store.getState().setThumbnailQuality('sample');

    expect(store.getState().thumbnailQuality).toBe('sample');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"thumbnailQuality":"sample"');
  });

  it('persists and clamps the browsing image cache limit', async () => {
    const store = await loadSettingsStore();
    store.getState().setImageCacheLimitBytes(768 * 1024 ** 2);
    expect(store.getState().imageCacheLimitBytes).toBe(768 * 1024 ** 2);
    store.getState().setImageCacheLimitBytes(1);
    expect(store.getState().imageCacheLimitBytes).toBe(64 * 1024 ** 2);
  });

  it('persists and clamps the number of large images preloaded ahead', async () => {
    const store = await loadSettingsStore();
    store.getState().setDetailPreloadCount(8);
    expect(store.getState().detailPreloadCount).toBe(8);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"detailPreloadCount":8');
    store.getState().setDetailPreloadCount(99);
    expect(store.getState().detailPreloadCount).toBe(20);
    store.getState().setDetailPreloadCount(-1);
    expect(store.getState().detailPreloadCount).toBe(0);
  });

  it('clamps grid and masonry columns to the 2-12 range', async () => {
    const store = await loadSettingsStore();
    store.getState().setColumns(99);
    expect(store.getState().columns).toBe(12);
    store.getState().setColumns(1);
    expect(store.getState().columns).toBe(2);
  });

  it('defaults a current-version stored setting without thumbnail quality to preview', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { theme: 'dark', detailImageQuality: 'original' }, version: 2 }));

    const store = await loadSettingsStore();

    expect(store.getState()).toMatchObject({ theme: 'dark', detailImageQuality: 'original', thumbnailQuality: 'preview' });
  });

  it('persists only a non-sensitive incrementing credential revision for cache identity', async () => {
    const store = await loadSettingsStore();
    store.getState().setCredentials('danbooru', 'first-user', 'first-key');
    store.getState().setCredentials('danbooru', 'second-user', 'second-key');
    expect(store.getState().credentialRevisions.danbooru).toBe(2);
    const persisted = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(persisted).toContain('"credentialRevisions":{"danbooru":2}');
    expect(persisted).not.toMatch(/credentialRevisions[^}]+first-user|credentialRevisions[^}]+first-key/);
  });
});
