import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UnifiedPost } from '../types/post';
import { extensionStorage } from './storage';

interface UiStore {
  sidebarOpen: boolean;
  detailOpen: boolean;
  currentPost: UnifiedPost | null;
  detailTrigger: HTMLElement | null;
  advancedFiltersOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openDetail: (post: UnifiedPost) => void;
  closeDetail: () => void;
  setCurrentPost: (post: UnifiedPost) => void;
  toggleAdvancedFilters: () => void;
  closeAdvancedFilters: () => void;
}

export const useUiStore = create<UiStore>()(persist(
  (set) => ({
    sidebarOpen: true,
    detailOpen: false,
    currentPost: null,
    detailTrigger: null,
    advancedFiltersOpen: false,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    openDetail: (post) => set({
      currentPost: post,
      detailOpen: true,
      detailTrigger: typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
    }),
    closeDetail: () => set({ detailOpen: false }),
    setCurrentPost: (currentPost) => set({ currentPost }),
    toggleAdvancedFilters: () => set((state) => ({ advancedFiltersOpen: !state.advancedFiltersOpen })),
    closeAdvancedFilters: () => set({ advancedFiltersOpen: false }),
  }),
  { name: 'danbooru-ui', storage: createJSONStorage(() => extensionStorage), partialize: ({ sidebarOpen }) => ({ sidebarOpen }) },
));
