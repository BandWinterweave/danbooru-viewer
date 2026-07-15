import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UnifiedPost } from '../types/post';
import { extensionStorage } from './storage';

interface UiStore {
  sidebarOpen: boolean;
  detailOpen: boolean;
  currentPost: UnifiedPost | null;
  viewerOpen: boolean;
  viewerIndex: number;
  advancedFiltersOpen: boolean;
  shortcutNotice: string;
  toggleSidebar: () => void;
  openDetail: (post: UnifiedPost) => void;
  closeDetail: () => void;
  openViewer: (post: UnifiedPost) => void;
  closeViewer: () => void;
  setCurrentPost: (post: UnifiedPost) => void;
  toggleAdvancedFilters: () => void;
  setShortcutNotice: (message: string) => void;
}

export const useUiStore = create<UiStore>()(persist(
  (set) => ({
    sidebarOpen: true,
    detailOpen: false,
    currentPost: null,
    viewerOpen: false,
    viewerIndex: 0,
    advancedFiltersOpen: false,
    shortcutNotice: '',
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    openDetail: (post) => set({ currentPost: post, detailOpen: true }),
    closeDetail: () => set({ detailOpen: false }),
    openViewer: (post) => set({ currentPost: post, viewerOpen: true }),
    closeViewer: () => set({ viewerOpen: false }),
    setCurrentPost: (currentPost) => set({ currentPost }),
    toggleAdvancedFilters: () => set((state) => ({ advancedFiltersOpen: !state.advancedFiltersOpen })),
    setShortcutNotice: (shortcutNotice) => set({ shortcutNotice }),
  }),
  { name: 'danbooru-ui', storage: createJSONStorage(() => extensionStorage), partialize: ({ sidebarOpen }) => ({ sidebarOpen }) },
));
