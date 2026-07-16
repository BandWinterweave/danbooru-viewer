import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getBooruAdapter } from '../services/booru-adapters';
import type { SearchQuery } from '../types/api';
import type { BooruSource, UnifiedPost } from '../types/post';
import { useSettingsStore } from './settings-store';
import { extensionStorage } from './storage';
import { messages } from '../i18n/en';
import { notify } from '../services/notifications';
import { ApiRequestError } from '../services/api/client';
import { enrichPostTags } from '../services/booru-adapters/tag-enrichment';
import { useUiStore } from './ui-store';

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
  retry: () => Promise<void>;
  enrichTags: (post: UnifiedPost) => Promise<void>;
  toggleSelected: (post: UnifiedPost) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

let requestSequence = 0;

function credentials(source: BooruSource = useSettingsStore.getState().activeSource) {
  const value = useSettingsStore.getState().credentials[source];
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
      const recovering = Boolean(get().error);
      const normalizedQuery = { ...query, page: 1, limit: query.limit ?? 40 };
      set({ posts: [], selectedPostKeys: [], page: 0, hasMore: false, isLoading: true, isLoadingMore: false, error: null, query: normalizedQuery });
      try {
        const result = await adapter().searchPosts(normalizedQuery, credentials());
        if (requestId !== requestSequence) return;
        set({ posts: result.items, page: 1, hasMore: result.hasMore, isLoading: false });
        if (recovering) notify({ tone: 'success', title: messages.toast.restored, description: messages.toast.restoredBody });
      } catch (error) {
        if (requestId !== requestSequence) return;
        const detail = error instanceof Error ? error.message : 'Search failed';
        set({ isLoading: false, error: detail });
        const limited = error instanceof ApiRequestError && error.status === 429;
        notify({ tone: limited ? 'warning' : 'error', title: limited ? messages.toast.rateLimited : messages.toast.searchFailed, description: limited ? messages.toast.rateLimitedBody : messages.toast.networkBody });
      }
    },
    retry: async () => { await get().search(get().query); },
    enrichTags: async (post) => {
      const enriched = await enrichPostTags(post, credentials(post.source));
      set((state) => ({ posts: state.posts.map((item) => item.source === enriched.source && item.id === enriched.id ? enriched : item) }));
      const current = useUiStore.getState().currentPost;
      if (current?.source === enriched.source && current.id === enriched.id) useUiStore.getState().setCurrentPost(enriched);
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
