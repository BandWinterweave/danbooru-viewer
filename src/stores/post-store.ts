import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getBooruAdapter } from '../services/booru-adapters';
import type { SearchQuery } from '../types/api';
import type { UnifiedPost } from '../types/post';
import { useSettingsStore } from './settings-store';
import { extensionStorage } from './storage';

interface PostStore {
  posts: UnifiedPost[];
  query: SearchQuery;
  page: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  selectedPostKeys: string[];
  search: (query: SearchQuery) => Promise<void>;
  loadMore: () => Promise<void>;
  toggleSelected: (post: UnifiedPost) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

let requestSequence = 0;

function credentials() {
  const { activeSource, credentials: allCredentials } = useSettingsStore.getState();
  const value = allCredentials[activeSource];
  return value?.username && value.apiKey ? value : undefined;
}

function adapter() { return getBooruAdapter(useSettingsStore.getState().activeSource); }

export const usePostStore = create<PostStore>()(persist(
  (set, get) => ({
    posts: [],
    query: { page: 1, limit: 40 },
    page: 0,
    isLoading: false,
    isLoadingMore: false,
    hasMore: true,
    error: null,
    selectedPostKeys: [],
    search: async (query) => {
      const requestId = ++requestSequence;
      const normalizedQuery = { ...query, page: 1, limit: query.limit ?? 40 };
      set({ posts: [], selectedPostKeys: [], page: 0, hasMore: false, isLoading: true, isLoadingMore: false, error: null, query: normalizedQuery });
      try {
        const result = await adapter().searchPosts(normalizedQuery, credentials());
        if (requestId !== requestSequence) return;
        set({ posts: result.items, page: 1, hasMore: result.hasMore, isLoading: false });
      } catch (error) {
        if (requestId !== requestSequence) return;
        set({ isLoading: false, error: error instanceof Error ? error.message : 'Search failed' });
      }
    },
    loadMore: async () => {
      const state = get();
      if (state.isLoading || state.isLoadingMore || !state.hasMore) return;
      const nextPage = state.page + 1;
      const requestId = requestSequence;
      const source = useSettingsStore.getState().activeSource;
      set({ isLoadingMore: true, error: null });
      try {
        const result = await adapter().searchPosts({ ...state.query, page: nextPage }, credentials());
        if (requestId !== requestSequence || source !== useSettingsStore.getState().activeSource) return;
        set((current) => ({
          posts: [...current.posts, ...result.items.filter((item) => !current.posts.some((post) => post.id === item.id))],
          page: nextPage,
          hasMore: result.hasMore,
          isLoadingMore: false,
        }));
      } catch (error) {
        if (requestId !== requestSequence) return;
        set({ isLoadingMore: false, error: error instanceof Error ? error.message : 'Could not load more posts' });
      }
    },
    toggleSelected: (post) => set((state) => {
      const key = `${post.source}:${post.id}`;
      return { selectedPostKeys: state.selectedPostKeys.includes(key) ? state.selectedPostKeys.filter((item) => item !== key) : [...state.selectedPostKeys, key] };
    }),
    selectAll: () => set((state) => ({ selectedPostKeys: state.posts.map((post) => `${post.source}:${post.id}`) })),
    clearSelection: () => set({ selectedPostKeys: [] }),
  }),
  {
    name: 'danbooru-posts-v2',
    storage: createJSONStorage(() => extensionStorage),
    partialize: ({ query }) => ({ query }),
  },
));
