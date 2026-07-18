import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { extensionStorage } from './storage';
import type { BooruSource, TagCategory } from '../types/post';
import type { Credentials } from '../types/api';

export type Theme = 'light' | 'dark' | 'system';
export type Layout = 'grid' | 'masonry' | 'list';
export type DetailImageQuality = 'preview' | 'sample' | 'original';
export type ThumbnailQuality = 'preview' | 'sample';
export type Language = 'system' | 'en' | 'zh-CN';

interface SettingsStore {
  activeSource: BooruSource;
  theme: Theme;
  language: Language;
  columns: number;
  layout: Layout;
  detailImageQuality: DetailImageQuality;
  detailPreloadCount: number;
  thumbnailQuality: ThumbnailQuality;
  imageCacheLimitBytes: number;
  keyboardEnabled: boolean;
  downloadRule: string;
  quickTags: string[];
  copyTagCategories: TagCategory[];
  copyTagsUseUnderscores: boolean;
  copyTagsEscapeParentheses: boolean;
  hideUnavailablePreviews: boolean;
  comfyBaseUrl: string;
  comfyHistoryLimit: number;
  comfyStorageLimitBytes: number;
  comfyReplaceReverseWithTags: boolean;
  comfyCacheOutputs: boolean;
  credentials: Partial<Record<BooruSource, Credentials>>;
  credentialRevisions: Partial<Record<BooruSource, number>>;
  setActiveSource: (source: BooruSource) => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setColumns: (columns: number) => void;
  setLayout: (layout: Layout) => void;
  setDetailImageQuality: (quality: DetailImageQuality) => void;
  setDetailPreloadCount: (count: number) => void;
  setThumbnailQuality: (quality: ThumbnailQuality) => void;
  setImageCacheLimitBytes: (value: number) => void;
  setKeyboardEnabled: (enabled: boolean) => void;
  setDownloadRule: (rule: string) => void;
  addQuickTag: (tag: string) => void;
  removeQuickTag: (tag: string) => void;
  setCopyTagCategory: (category: TagCategory, enabled: boolean) => void;
  setCopyTagsUseUnderscores: (enabled: boolean) => void;
  setCopyTagsEscapeParentheses: (enabled: boolean) => void;
  setHideUnavailablePreviews: (enabled: boolean) => void;
  setComfyBaseUrl: (value: string) => void;
  setComfyHistoryLimit: (value: number) => void;
  setComfyStorageLimitBytes: (value: number) => void;
  setComfyReplaceReverseWithTags: (enabled: boolean) => void;
  setComfyCacheOutputs: (enabled: boolean) => void;
  setCredentials: (source: BooruSource, username: string, apiKey: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(persist(
  (set) => ({
    activeSource: 'danbooru',
    theme: 'system',
    language: 'system',
    columns: 5,
    layout: 'grid',
    detailImageQuality: 'sample',
    detailPreloadCount: 2,
    thumbnailQuality: 'preview',
    imageCacheLimitBytes: 512 * 1024 ** 2,
    keyboardEnabled: true,
    downloadRule: '{source}-{id}-{artist}',
    quickTags: [],
    copyTagCategories: ['artist', 'character', 'copyright', 'general', 'meta'],
    copyTagsUseUnderscores: true,
    copyTagsEscapeParentheses: false,
    hideUnavailablePreviews: false,
    comfyBaseUrl: 'http://127.0.0.1:8188/',
    comfyHistoryLimit: 100,
    comfyStorageLimitBytes: 1024 * 1024 * 1024,
    comfyReplaceReverseWithTags: true,
    comfyCacheOutputs: true,
    credentials: {},
    credentialRevisions: {},
    setActiveSource: (activeSource) => set({ activeSource }),
    setTheme: (theme) => set({ theme }),
    setLanguage: (language) => set({ language }),
    setColumns: (columns) => set({ columns: Math.min(Math.max(columns, 2), 12) }),
    setLayout: (layout) => set({ layout }),
    setDetailImageQuality: (detailImageQuality) => set({ detailImageQuality }),
    setDetailPreloadCount: (detailPreloadCount) => set({ detailPreloadCount: Math.min(20, Math.max(0, Math.round(detailPreloadCount) || 0)) }),
    setThumbnailQuality: (thumbnailQuality) => set({ thumbnailQuality }),
    setImageCacheLimitBytes: (imageCacheLimitBytes) => set({ imageCacheLimitBytes: Math.min(10 * 1024 ** 3, Math.max(64 * 1024 ** 2, Math.round(imageCacheLimitBytes) || 512 * 1024 ** 2)) }),
    setKeyboardEnabled: (keyboardEnabled) => set({ keyboardEnabled }),
    setDownloadRule: (downloadRule) => set({ downloadRule: downloadRule.trim() || '{source}-{id}' }),
    addQuickTag: (rawTag) => set((state) => { const tag = rawTag.trim().replace(/\s+/g, '_'); return !tag || state.quickTags.includes(tag) ? {} : { quickTags: [...state.quickTags, tag] }; }),
    removeQuickTag: (tag) => set((state) => ({ quickTags: state.quickTags.filter((item) => item !== tag) })),
    setCopyTagCategory: (category, enabled) => set((state) => ({ copyTagCategories: enabled ? [...new Set([...state.copyTagCategories, category])] : state.copyTagCategories.filter((item) => item !== category) })),
    setCopyTagsUseUnderscores: (copyTagsUseUnderscores) => set({ copyTagsUseUnderscores }),
    setCopyTagsEscapeParentheses: (copyTagsEscapeParentheses) => set({ copyTagsEscapeParentheses }),
    setHideUnavailablePreviews: (hideUnavailablePreviews) => set({ hideUnavailablePreviews }),
    setComfyBaseUrl: (comfyBaseUrl) => set({ comfyBaseUrl: comfyBaseUrl.trim() }),
    setComfyHistoryLimit: (comfyHistoryLimit) => set({ comfyHistoryLimit: Math.min(1000, Math.max(10, Math.round(comfyHistoryLimit) || 100)) }),
    setComfyStorageLimitBytes: (comfyStorageLimitBytes) => set({ comfyStorageLimitBytes: Math.min(10 * 1024 ** 3, Math.max(64 * 1024 ** 2, Math.round(comfyStorageLimitBytes) || 1024 ** 3)) }),
    setComfyReplaceReverseWithTags: (comfyReplaceReverseWithTags) => set({ comfyReplaceReverseWithTags }),
    setComfyCacheOutputs: (comfyCacheOutputs) => set({ comfyCacheOutputs }),
    setCredentials: (source, username, apiKey) => set((state) => ({
      credentials: { ...state.credentials, [source]: { username: username.trim(), apiKey: apiKey.trim() } },
      credentialRevisions: { ...state.credentialRevisions, [source]: (state.credentialRevisions[source] ?? 0) + 1 },
    })),
  }),
  {
    name: 'danbooru-settings',
    storage: createJSONStorage(() => extensionStorage),
    version: 4,
    migrate: (persistedState) => {
      if (!persistedState || typeof persistedState !== 'object') return persistedState as SettingsStore;
      const state = { ...persistedState as Record<string, unknown> };
      delete state.slideshowInterval;
      return state as unknown as SettingsStore;
    },
  },
));
