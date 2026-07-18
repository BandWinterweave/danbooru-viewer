import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'danbooru-filters';

async function loadFilterStore() {
  const { useFilterStore } = await import('../../src/stores/filter-store');
  await useFilterStore.persist.rehydrate();
  return useFilterStore;
}

describe('filter store rating persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('enables only General for a first installation', async () => {
    const store = await loadFilterStore();

    expect(store.getState().ratings).toEqual(['g']);
    expect(store.getState().getSearchQuery().ratings).toEqual(['g']);
  });

  it('restores an existing saved rating instead of applying the new default', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { ratings: ['q'] }, version: 0 }));

    const store = await loadFilterStore();

    expect(store.getState().ratings).toEqual(['q']);
  });

  it('persists a manually selected rating across reloads', async () => {
    const store = await loadFilterStore();
    store.getState().toggleRating('e');
    expect(store.getState().ratings).toEqual(['g', 'e']);

    vi.resetModules();
    const reloadedStore = await loadFilterStore();

    expect(reloadedStore.getState().ratings).toEqual(['g', 'e']);
  });

  it('restores legacy presets in their existing array order', async () => {
    const presets = [
      { id: 'second', name: 'Second', sourceId: 'danbooru', filters: [], ratings: ['g'], meta: {}, createdAt: '2025-02-01T00:00:00Z' },
      { id: 'first', name: 'First', sourceId: 'danbooru', filters: [], ratings: [], meta: {}, createdAt: '2025-01-01T00:00:00Z' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { presets }, version: 0 }));

    const store = await loadFilterStore();

    expect(store.getState().presets.map(({ id }) => id)).toEqual(['second', 'first']);
    expect(store.getState().presets[0]).not.toHaveProperty('order');
  });
});
