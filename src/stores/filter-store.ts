import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SearchQuery } from '../types/api';
import type { FilterChip, FilterPreset, MetaFilter } from '../types/filter';
import type { Rating } from '../types/post';
import { extensionStorage } from './storage';

interface FilterStore {
  searchText: string;
  activeFilters: FilterChip[];
  ratings: Rating[];
  meta: MetaFilter;
  presets: FilterPreset[];
  setSearchText: (value: string) => void;
  addSearchFilters: (query: string) => void;
  addTagFilter: (tag: string, mode: 'include' | 'exclude') => void;
  removeFilter: (id: string) => void;
  toggleFilterMode: (id: string) => void;
  clearAll: () => void;
  toggleRating: (rating: Rating) => void;
  setMetaFilter: (meta: Partial<MetaFilter>) => void;
  savePreset: (name: string, sourceId: string) => void;
  loadPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  getSearchQuery: () => SearchQuery;
}

function tagId(tag: string) {
  return `tag:${tag.toLowerCase().replace(/\s+/g, '_')}`;
}

export const useFilterStore = create<FilterStore>()(persist(
  (set, get) => ({
    searchText: '',
    activeFilters: [],
    ratings: ['g'],
    meta: {},
    presets: [],
    setSearchText: (searchText) => set({ searchText }),
    addSearchFilters: (query) => {
      const requested = query.trim().split(/\s+/).filter(Boolean).map((term) => ({
        value: term.replace(/^-/, ''),
        mode: term.startsWith('-') ? 'exclude' as const : 'include' as const,
      })).filter((term) => term.value);
      if (!requested.length) return;

      set((state) => {
        const next = [...state.activeFilters];
        for (const { value: rawValue, mode } of requested) {
          const value = rawValue.replace(/\s+/g, '_');
          const id = tagId(value);
          const index = next.findIndex((chip) => chip.id === id);
          const chip: FilterChip = { id, type: 'tag', label: value.replaceAll('_', ' '), value, mode };
          if (index >= 0) next[index] = chip;
          else next.push(chip);
        }
        return { activeFilters: next, searchText: '' };
      });
    },
    addTagFilter: (rawTag, mode) => {
      const tag = rawTag.trim().replace(/\s+/g, '_').replace(/^-/, '');
      if (!tag) return;
      const id = tagId(tag);
      set((state) => {
        const existing = state.activeFilters.find((chip) => chip.id === id);
        if (existing) {
          return { activeFilters: state.activeFilters.map((chip) => chip.id === id ? { ...chip, mode } : chip) };
        }
        return { activeFilters: [...state.activeFilters, { id, type: 'tag', label: tag.replaceAll('_', ' '), value: tag, mode }] };
      });
    },
    removeFilter: (id) => set((state) => ({ activeFilters: state.activeFilters.filter((chip) => chip.id !== id) })),
    toggleFilterMode: (id) => set((state) => ({
      activeFilters: state.activeFilters.map((chip) => chip.id === id
        ? { ...chip, mode: chip.mode === 'include' ? 'exclude' : 'include' }
        : chip),
    })),
    clearAll: () => set({ activeFilters: [], ratings: [], meta: {} }),
    toggleRating: (rating) => set((state) => ({ ratings: state.ratings.includes(rating) ? [] : [rating] })),
    setMetaFilter: (meta) => set((state) => ({ meta: { ...state.meta, ...meta } })),
    savePreset: (name, sourceId) => set((state) => ({ presets: [...state.presets, { id: crypto.randomUUID(), name: name.trim(), sourceId, filters: state.activeFilters, ratings: state.ratings, meta: state.meta, createdAt: new Date().toISOString() }] })),
    loadPreset: (id) => set((state) => { const preset = state.presets.find((item) => item.id === id); return preset ? { activeFilters: preset.filters, ratings: preset.ratings, meta: preset.meta } : {}; }),
    deletePreset: (id) => set((state) => ({ presets: state.presets.filter((item) => item.id !== id) })),
    getSearchQuery: () => {
      const state = get();
      const terms = state.activeFilters.map((chip) => `${chip.mode === 'exclude' ? '-' : ''}${chip.value}`);
      return { tags: terms.filter(Boolean).join(' '), ratings: state.ratings, page: 1, limit: 40, ...state.meta };
    },
  }),
  {
    name: 'danbooru-filters',
    storage: createJSONStorage(() => extensionStorage),
    partialize: ({ searchText, activeFilters, ratings, meta, presets }) => ({ searchText, activeFilters, ratings, meta, presets }),
  },
));
