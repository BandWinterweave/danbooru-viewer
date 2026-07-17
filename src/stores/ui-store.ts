import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UnifiedPost } from '../types/post';
import { extensionStorage } from './storage';

interface UiStore {
  view: 'browse' | 'favorites';
  sidebarOpen: boolean;
  detailOpen: boolean;
  currentPost: UnifiedPost | null;
  hoveredPost: UnifiedPost | null;
  detailTrigger: HTMLElement | null;
  advancedFiltersOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  detailContext: 'browse' | 'favorites';
  setView: (view: 'browse' | 'favorites') => void;
  openDetail: (post: UnifiedPost, context?: 'browse' | 'favorites') => void;
  closeDetail: () => void;
  setCurrentPost: (post: UnifiedPost) => void;
  setHoveredPost: (post: UnifiedPost) => void;
  clearHoveredPost: (post: UnifiedPost) => void;
  toggleAdvancedFilters: () => void;
  closeAdvancedFilters: () => void;
}

export const useUiStore = create<UiStore>()(persist(
  (set) => ({
    sidebarOpen: true,
    view: 'browse',
    detailOpen: false,
    currentPost: null,
    hoveredPost: null,
    detailTrigger: null,
    advancedFiltersOpen: false,
    detailContext: 'browse',
    setView: (view) => set({ view }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    openDetail: (post, detailContext = 'browse') => set({
      currentPost: post,
      detailOpen: true,
      detailContext,
      detailTrigger: typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
    }),
    closeDetail: () => set({ detailOpen: false }),
    setCurrentPost: (currentPost) => set({ currentPost }),
    setHoveredPost: (hoveredPost) => set({ hoveredPost }),
    clearHoveredPost: (post) => set((state) => state.hoveredPost?.source === post.source && state.hoveredPost.id === post.id ? { hoveredPost: null } : {}),
    toggleAdvancedFilters: () => set((state) => ({ advancedFiltersOpen: !state.advancedFiltersOpen })),
    closeAdvancedFilters: () => set({ advancedFiltersOpen: false }),
  }),
  { name: 'danbooru-ui', storage: createJSONStorage(() => extensionStorage), partialize: ({ sidebarOpen }) => ({ sidebarOpen }) },
));
