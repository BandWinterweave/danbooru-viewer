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
  paginationStopReason: 'remote-end' | 'filtered-page-limit' | null;
  error: string | null;
  selectedPostKeys: string[];
  search: (query: SearchQuery) => Promise<void>;
  loadMore: () => Promise<void>;
  navigateDetail: (direction: -1 | 1) => Promise<void>;
  retry: () => Promise<void>;
  enrichTags: (post: UnifiedPost) => Promise<void>;
  toggleSelected: (post: UnifiedPost) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

let requestSequence = 0;
let loadMorePromise: Promise<void> | null = null;
const MAX_CONSECUTIVE_FILTERED_PAGES = 5;

function credentials(source: BooruSource = useSettingsStore.getState().activeSource) {
  const value = useSettingsStore.getState().credentials[source];
  return value?.username && value.apiKey ? value : undefined;
}

function adapter() { return getBooruAdapter(useSettingsStore.getState().activeSource); }

async function fetchVisiblePage(query: SearchQuery, firstPage: number) {
  const sourceAdapter = adapter();
  const sourceCredentials = credentials();
  for (let offset = 0; offset < MAX_CONSECUTIVE_FILTERED_PAGES; offset += 1) {
    const page = firstPage + offset;
    const result = await sourceAdapter.searchPosts({ ...query, page }, sourceCredentials);
    if (result.items.length > 0) {
      return { ...result, page, paginationStopReason: result.hasMore ? null : 'remote-end' as const };
    }
    if (!result.hasMore) {
      return { ...result, page, paginationStopReason: 'remote-end' as const };
    }
  }
  return { items: [], page: firstPage + MAX_CONSECUTIVE_FILTERED_PAGES - 1, limit: query.limit ?? 40, hasMore: false, paginationStopReason: 'filtered-page-limit' as const };
}

export const usePostStore = create<PostStore>()(persist(
  (set, get) => ({
    posts: [],
    query: { page: 1, limit: 40 },
    page: 0,
    isLoading: false,
    isLoadingMore: false,
    hasMore: true,
    paginationStopReason: null,
    error: null,
    selectedPostKeys: [],
    search: async (query) => {
      const requestId = ++requestSequence;
      const recovering = Boolean(get().error);
      const normalizedQuery = { ...query, page: 1, limit: query.limit ?? 40 };
      set({ posts: [], selectedPostKeys: [], page: 0, hasMore: false, paginationStopReason: null, isLoading: true, isLoadingMore: false, error: null, query: normalizedQuery });
      try {
        const result = await fetchVisiblePage(normalizedQuery, 1);
        if (requestId !== requestSequence) return;
        set({ posts: result.items, page: result.page, hasMore: result.hasMore, paginationStopReason: result.paginationStopReason, isLoading: false });
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
    loadMore: () => {
      const state = get();
      if (state.isLoading || !state.hasMore) return Promise.resolve();
      if (loadMorePromise) return loadMorePromise;
      loadMorePromise = (async () => {
        const currentState = get();
        const nextPage = currentState.page + 1;
        const requestId = requestSequence;
        const source = useSettingsStore.getState().activeSource;
        set({ isLoadingMore: true, paginationStopReason: null, error: null });
        try {
          const result = await fetchVisiblePage(currentState.query, nextPage);
          if (requestId !== requestSequence || source !== useSettingsStore.getState().activeSource) return;
          set((current) => ({
            posts: [...current.posts, ...result.items.filter((item) => !current.posts.some((post) => post.id === item.id && post.source === item.source))],
            page: result.page,
            hasMore: result.hasMore,
            paginationStopReason: result.paginationStopReason,
          }));
        } catch (error) {
          if (requestId === requestSequence) set({ error: error instanceof Error ? error.message : 'Could not load more posts' });
        } finally {
          if (requestId === requestSequence) set({ isLoadingMore: false });
          loadMorePromise = null;
        }
      })();
      return loadMorePromise;
    },
    navigateDetail: async (direction) => {
      const state = get();
      const current = useUiStore.getState().currentPost;
      if (!current) return;
      const index = state.posts.findIndex((post) => post.id === current.id && post.source === current.source);
      if (index < 0) return;
      const nextIndex = index + direction;
      if (state.posts[nextIndex]) { useUiStore.getState().setCurrentPost(state.posts[nextIndex]); return; }
      if (direction !== 1 || !state.hasMore) return;
      await get().loadMore();
      const next = get().posts[index + 1];
      if (next) useUiStore.getState().setCurrentPost(next);
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
