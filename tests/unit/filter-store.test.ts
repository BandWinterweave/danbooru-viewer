import { beforeEach, describe, expect, it } from 'vitest';
import { useFilterStore } from '../../src/stores/filter-store';

describe('filter store', () => {
  beforeEach(() => {
    useFilterStore.setState({ searchText: '', activeFilters: [], ratings: [], meta: {}, presets: [] });
  });

  it('builds a Danbooru query from text, tags, exclusions, and ratings', () => {
    const store = useFilterStore.getState();
    store.addSearchFilters('1girl');
    store.addTagFilter('blue sky', 'include');
    store.addTagFilter('sketch', 'exclude');
    store.toggleRating('g');

    expect(useFilterStore.getState().getSearchQuery()).toEqual({
      tags: '1girl blue_sky -sketch',
      ratings: ['g'],
      page: 1,
      limit: 40,
    });
  });

  it('turns a search draft into persistent include and exclude chips', () => {
    const store = useFilterStore.getState();
    store.setSearchText('draft');
    store.addSearchFilters('1girl -sketch');

    expect(useFilterStore.getState().searchText).toBe('');
    expect(useFilterStore.getState().activeFilters).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: '1girl', mode: 'include' }),
      expect.objectContaining({ value: 'sketch', mode: 'exclude' }),
    ]));
    expect(useFilterStore.getState().getSearchQuery().tags).toBe('1girl -sketch');
  });

  it('keeps rating selection portable by allowing one rating at a time', () => {
    useFilterStore.getState().toggleRating('g');
    useFilterStore.getState().toggleRating('q');
    expect(useFilterStore.getState().ratings).toEqual(['q']);
  });

  it('updates an existing tag instead of creating duplicates', () => {
    const store = useFilterStore.getState();
    store.addTagFilter('landscape', 'include');
    store.addTagFilter('landscape', 'exclude');

    expect(useFilterStore.getState().activeFilters).toHaveLength(1);
    expect(useFilterStore.getState().activeFilters[0].mode).toBe('exclude');
  });

  it('saves and restores a source-scoped filter preset', () => {
    useFilterStore.getState().addTagFilter('highres', 'include');
    useFilterStore.getState().setMetaFilter({ scoreMin: 50, order: 'score' });
    useFilterStore.getState().savePreset('High score', 'danbooru');
    const preset = useFilterStore.getState().presets[0];
    useFilterStore.getState().clearAll();
    useFilterStore.getState().loadPreset(preset.id);
    expect(useFilterStore.getState().getSearchQuery()).toMatchObject({ tags: 'highres', scoreMin: 50, order: 'score' });
    expect(preset.sourceId).toBe('danbooru');
  });
});
