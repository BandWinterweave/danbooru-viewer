import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { extensionStorage } from './storage';
import type { BooruSource } from '../types/post';
import type { Credentials } from '../types/api';

export type Theme = 'light' | 'dark' | 'system';
export type Layout = 'grid' | 'masonry' | 'list';

interface SettingsStore {
  activeSource: BooruSource;
  theme: Theme;
  columns: number;
  layout: Layout;
  keyboardEnabled: boolean;
  downloadRule: string;
  slideshowInterval: number;
  quickTags: string[];
  credentials: Partial<Record<BooruSource, Credentials>>;
  setActiveSource: (source: BooruSource) => void;
  setTheme: (theme: Theme) => void;
  setColumns: (columns: number) => void;
  setLayout: (layout: Layout) => void;
  setKeyboardEnabled: (enabled: boolean) => void;
  setDownloadRule: (rule: string) => void;
  setSlideshowInterval: (seconds: number) => void;
  addQuickTag: (tag: string) => void;
  removeQuickTag: (tag: string) => void;
  setCredentials: (source: BooruSource, username: string, apiKey: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(persist(
  (set) => ({
    activeSource: 'danbooru',
    theme: 'system',
    columns: 5,
    layout: 'grid',
    keyboardEnabled: true,
    downloadRule: '{source}-{id}-{artist}',
    slideshowInterval: 5,
    quickTags: [],
    credentials: {},
    setActiveSource: (activeSource) => set({ activeSource }),
    setTheme: (theme) => set({ theme }),
    setColumns: (columns) => set({ columns: Math.min(Math.max(columns, 2), 8) }),
    setLayout: (layout) => set({ layout }),
    setKeyboardEnabled: (keyboardEnabled) => set({ keyboardEnabled }),
    setDownloadRule: (downloadRule) => set({ downloadRule: downloadRule.trim() || '{source}-{id}' }),
    setSlideshowInterval: (seconds) => set({ slideshowInterval: Math.min(Math.max(seconds, 2), 30) }),
    addQuickTag: (rawTag) => set((state) => { const tag = rawTag.trim().replace(/\s+/g, '_'); return !tag || state.quickTags.includes(tag) ? {} : { quickTags: [...state.quickTags, tag] }; }),
    removeQuickTag: (tag) => set((state) => ({ quickTags: state.quickTags.filter((item) => item !== tag) })),
    setCredentials: (source, username, apiKey) => set((state) => ({ credentials: { ...state.credentials, [source]: { username: username.trim(), apiKey: apiKey.trim() } } })),
  }),
  { name: 'danbooru-settings', storage: createJSONStorage(() => extensionStorage) },
));
