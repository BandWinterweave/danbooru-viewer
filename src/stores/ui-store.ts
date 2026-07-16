import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UnifiedPost } from '../types/post';
import { extensionStorage } from './storage';

interface UiStore {
  sidebarOpen: boolean;
  detailOpen: boolean;
  currentPost: UnifiedPost | null;
  advancedFiltersOpen: boolean;
  toggleSidebar: () => void;
  openDetail: (post: UnifiedPost) => void;
  closeDetail: () => void;
  setCurrentPost: (post: UnifiedPost) => void;
  toggleAdvancedFilters: () => void;
}

export const useUiStore = create<UiStore>()(persist(
  (set) => ({
    sidebarOpen: true,
    detailOpen: false,
    currentPost: null,
    advancedFiltersOpen: false,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    openDetail: (post) => set({ currentPost: post, detailOpen: true }),
    closeDetail: () => set({ detailOpen: false }),
    setCurrentPost: (currentPost) => set({ currentPost }),
    toggleAdvancedFilters: () => set((state) => ({ advancedFiltersOpen: !state.advancedFiltersOpen })),
  }),
  { name: 'danbooru-ui', storage: createJSONStorage(() => extensionStorage), partialize: ({ sidebarOpen }) => ({ sidebarOpen }) },
));
