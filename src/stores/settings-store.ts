import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { extensionStorage } from './storage';
import type { BooruSource, TagCategory } from '../types/post';
import type { Credentials } from '../types/api';

export type Theme = 'light' | 'dark' | 'system';
export type Layout = 'grid' | 'masonry' | 'list';
export type DetailImageQuality = 'preview' | 'sample' | 'original';

interface SettingsStore {
  activeSource: BooruSource;
  theme: Theme;
  columns: number;
  layout: Layout;
  detailImageQuality: DetailImageQuality;
  keyboardEnabled: boolean;
  downloadRule: string;
  quickTags: string[];
  copyTagCategories: TagCategory[];
  copyTagsUseUnderscores: boolean;
  copyTagsEscapeParentheses: boolean;
  hideUnavailablePreviews: boolean;
  credentials: Partial<Record<BooruSource, Credentials>>;
  setActiveSource: (source: BooruSource) => void;
  setTheme: (theme: Theme) => void;
  setColumns: (columns: number) => void;
  setLayout: (layout: Layout) => void;
  setDetailImageQuality: (quality: DetailImageQuality) => void;
  setKeyboardEnabled: (enabled: boolean) => void;
  setDownloadRule: (rule: string) => void;
  addQuickTag: (tag: string) => void;
  removeQuickTag: (tag: string) => void;
  setCopyTagCategory: (category: TagCategory, enabled: boolean) => void;
  setCopyTagsUseUnderscores: (enabled: boolean) => void;
  setCopyTagsEscapeParentheses: (enabled: boolean) => void;
  setHideUnavailablePreviews: (enabled: boolean) => void;
  setCredentials: (source: BooruSource, username: string, apiKey: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(persist(
  (set) => ({
    activeSource: 'danbooru',
    theme: 'system',
    columns: 5,
    layout: 'grid',
    detailImageQuality: 'sample',
    keyboardEnabled: true,
    downloadRule: '{source}-{id}-{artist}',
    quickTags: [],
    copyTagCategories: ['artist', 'character', 'copyright', 'general', 'meta'],
    copyTagsUseUnderscores: true,
    copyTagsEscapeParentheses: false,
    hideUnavailablePreviews: false,
    credentials: {},
    setActiveSource: (activeSource) => set({ activeSource }),
    setTheme: (theme) => set({ theme }),
    setColumns: (columns) => set({ columns: Math.min(Math.max(columns, 2), 8) }),
    setLayout: (layout) => set({ layout }),
    setDetailImageQuality: (detailImageQuality) => set({ detailImageQuality }),
    setKeyboardEnabled: (keyboardEnabled) => set({ keyboardEnabled }),
    setDownloadRule: (downloadRule) => set({ downloadRule: downloadRule.trim() || '{source}-{id}' }),
    addQuickTag: (rawTag) => set((state) => { const tag = rawTag.trim().replace(/\s+/g, '_'); return !tag || state.quickTags.includes(tag) ? {} : { quickTags: [...state.quickTags, tag] }; }),
    removeQuickTag: (tag) => set((state) => ({ quickTags: state.quickTags.filter((item) => item !== tag) })),
    setCopyTagCategory: (category, enabled) => set((state) => ({ copyTagCategories: enabled ? [...new Set([...state.copyTagCategories, category])] : state.copyTagCategories.filter((item) => item !== category) })),
    setCopyTagsUseUnderscores: (copyTagsUseUnderscores) => set({ copyTagsUseUnderscores }),
    setCopyTagsEscapeParentheses: (copyTagsEscapeParentheses) => set({ copyTagsEscapeParentheses }),
    setHideUnavailablePreviews: (hideUnavailablePreviews) => set({ hideUnavailablePreviews }),
    setCredentials: (source, username, apiKey) => set((state) => ({ credentials: { ...state.credentials, [source]: { username: username.trim(), apiKey: apiKey.trim() } } })),
  }),
  {
    name: 'danbooru-settings',
    storage: createJSONStorage(() => extensionStorage),
    version: 1,
    migrate: (persistedState) => {
      if (!persistedState || typeof persistedState !== 'object') return persistedState as SettingsStore;
      const state = { ...persistedState as Record<string, unknown> };
      delete state.slideshowInterval;
      return state as unknown as SettingsStore;
    },
  },
));
