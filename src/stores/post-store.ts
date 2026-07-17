import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getBooruAdapter } from '../services/booru-adapters';
import type { BooruAdapter, Credentials, SearchQuery } from '../types/api';
import type { BooruSource, UnifiedPost } from '../types/post';
import { useSettingsStore } from './settings-store';
import { extensionStorage } from './storage';
import { getMessages } from '../i18n/runtime-core';
import { notify } from '../services/notifications';
import { ApiRequestError } from '../services/api/client';
import { enrichPostTags } from '../services/booru-adapters/tag-enrichment';

interface PostStore {
  posts: UnifiedPost[];
  query: SearchQuery;
  page: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadingPhase: 'idle' | 'initial' | 'refresh' | 'append' | 'retry';
  failedOperation: 'search' | 'append' | null;
  hasMore: boolean;
  paginationStopReason: 'remote-end' | 'filtered-page-limit' | null;
  error: string | null;
  selectedPostKeys: string[];
  search: (query: SearchQuery) => Promise<void>;
  cancelSearch: () => void;
  loadMore: () => Promise<void>;
  navigateDetail: (current: UnifiedPost, direction: -1 | 1) => Promise<UnifiedPost | null>;
  retry: () => Promise<void>;
  enrichTags: (post: UnifiedPost) => Promise<UnifiedPost>;
  toggleSelected: (post: UnifiedPost) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

const MAX_CONSECUTIVE_FILTERED_PAGES = 5;

interface SearchSession {
  id: number;
  source: BooruSource;
  adapter: BooruAdapter;
  credentials?: Credentials;
  query: SearchQuery;
  page: number;
  controller: AbortController;
  loadMorePromise: Promise<void> | null;
}

let nextSessionId = 0;
let activeSession: SearchSession | null = null;

function credentials(source: BooruSource = useSettingsStore.getState().activeSource) {
  const value = useSettingsStore.getState().credentials[source];
  return value?.username && value.apiKey ? { ...value } : undefined;
}

function isCurrentSession(session: SearchSession) {
  return activeSession?.id === session.id && useSettingsStore.getState().activeSource === session.source;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function fetchVisiblePage(session: SearchSession, firstPage: number) {
  for (let offset = 0; offset < MAX_CONSECUTIVE_FILTERED_PAGES; offset += 1) {
    const page = firstPage + offset;
    const result = await session.adapter.searchPosts({ ...session.query, page }, session.credentials, session.controller.signal);
    if (result.items.length > 0) {
      return { ...result, page, paginationStopReason: result.hasMore ? null : 'remote-end' as const };
    }
    if (!result.hasMore) {
      return { ...result, page, paginationStopReason: 'remote-end' as const };
    }
  }
  return { items: [], page: firstPage + MAX_CONSECUTIVE_FILTERED_PAGES - 1, limit: session.query.limit ?? 40, hasMore: false, paginationStopReason: 'filtered-page-limit' as const };
}

export const usePostStore = create<PostStore>()(persist(
  (set, get) => {
    const runSearch = async (query: SearchQuery, loadingPhase: 'initial' | 'refresh' | 'retry') => {
      const recovering = Boolean(get().error);
      const normalizedQuery = { ...query, page: 1, limit: query.limit ?? 40 };
      const source = useSettingsStore.getState().activeSource;
      activeSession?.controller.abort();
      const session: SearchSession = {
        id: ++nextSessionId,
        source,
        adapter: getBooruAdapter(source),
        credentials: credentials(source),
        query: normalizedQuery,
        page: 0,
        controller: new AbortController(),
        loadMorePromise: null,
      };
      activeSession = session;
      const preservePosts = loadingPhase !== 'initial';
      set({
        ...(preservePosts ? {} : { posts: [], selectedPostKeys: [], page: 0 }),
        hasMore: preservePosts ? get().hasMore : false,
        paginationStopReason: null,
        isLoading: true,
        isLoadingMore: false,
        loadingPhase,
        failedOperation: null,
        error: null,
        query: normalizedQuery,
      });
      try {
        const result = await fetchVisiblePage(session, 1);
        if (!isCurrentSession(session)) return;
        session.page = result.page;
        set({ posts: result.items, page: result.page, hasMore: result.hasMore, paginationStopReason: result.paginationStopReason, isLoading: false, loadingPhase: 'idle' });
        const messages = getMessages();
        if (recovering) notify({ tone: 'success', title: messages.toast.restored, description: messages.toast.restoredBody });
      } catch (error) {
        if (!isCurrentSession(session) || isAbortError(error)) return;
        const messages = getMessages();
        const detail = error instanceof Error ? error.message : messages.domainActions.network.searchFailed;
        set({ isLoading: false, loadingPhase: 'idle', failedOperation: 'search', error: detail });
        const limited = error instanceof ApiRequestError && error.status === 429;
        notify({ tone: limited ? 'warning' : 'error', title: limited ? messages.toast.rateLimited : messages.toast.searchFailed, description: limited ? messages.toast.rateLimitedBody : messages.toast.networkBody });
      }
    };

    const runLoadMore = (loadingPhase: 'append' | 'retry') => {
      const state = get();
      const session = activeSession;
      if (!session || state.isLoading || !state.hasMore) return Promise.resolve();
      if (session.loadMorePromise) return session.loadMorePromise;
      session.loadMorePromise = (async () => {
        const nextPage = session.page + 1;
        set({ isLoadingMore: true, loadingPhase, failedOperation: null, paginationStopReason: null, error: null });
        try {
          const result = await fetchVisiblePage(session, nextPage);
          if (!isCurrentSession(session)) return;
          session.page = result.page;
          set((current) => ({
            posts: [...current.posts, ...result.items.filter((item) => !current.posts.some((post) => post.id === item.id && post.source === item.source))],
            page: result.page,
            hasMore: result.hasMore,
            paginationStopReason: result.paginationStopReason,
          }));
        } catch (error) {
          if (isCurrentSession(session) && !isAbortError(error)) set({ failedOperation: 'append', error: error instanceof Error ? error.message : getMessages().domainActions.network.loadMoreFailed });
        } finally {
          if (isCurrentSession(session)) set({ isLoadingMore: false, loadingPhase: 'idle' });
          session.loadMorePromise = null;
        }
      })();
      return session.loadMorePromise;
    };

    return {
    posts: [],
    query: { page: 1, limit: 40 },
    page: 0,
    isLoading: false,
    isLoadingMore: false,
    loadingPhase: 'idle',
    failedOperation: null,
    hasMore: true,
    paginationStopReason: null,
    error: null,
    selectedPostKeys: [],
    search: async (query) => {
      const normalizedQuery = { ...query, page: 1, limit: query.limit ?? 40 };
      const source = useSettingsStore.getState().activeSource;
      const phase = activeSession?.source === source && get().posts.length ? 'refresh' : 'initial';
      await runSearch(normalizedQuery, phase);
    },
    cancelSearch: () => {
      activeSession?.controller.abort();
      activeSession = null;
      set({ isLoading: false, isLoadingMore: false, loadingPhase: 'idle' });
    },
    retry: async () => {
      if (get().failedOperation === 'append') await runLoadMore('retry');
      else await runSearch(get().query, 'retry');
    },
    enrichTags: async (post) => {
      const enriched = await enrichPostTags(post, credentials(post.source));
      set((state) => ({ posts: state.posts.map((item) => item.source === enriched.source && item.id === enriched.id ? enriched : item) }));
      return enriched;
    },
    loadMore: () => runLoadMore('append'),
    navigateDetail: async (current, direction) => {
      const state = get();
      const session = activeSession;
      const index = state.posts.findIndex((post) => post.id === current.id && post.source === current.source);
      if (index < 0) return null;
      const nextIndex = index + direction;
      if (state.posts[nextIndex]) return state.posts[nextIndex];
      if (direction !== 1 || !state.hasMore) return null;
      await get().loadMore();
      if (!session || !isCurrentSession(session)) return null;
      const currentIndex = get().posts.findIndex((post) => post.id === current.id && post.source === current.source);
      return currentIndex >= 0 ? get().posts[currentIndex + 1] ?? null : null;
    },
    toggleSelected: (post) => set((state) => {
      const key = `${post.source}:${post.id}`;
      return { selectedPostKeys: state.selectedPostKeys.includes(key) ? state.selectedPostKeys.filter((item) => item !== key) : [...state.selectedPostKeys, key] };
    }),
    selectAll: () => set((state) => ({ selectedPostKeys: state.posts.map((post) => `${post.source}:${post.id}`) })),
    clearSelection: () => set({ selectedPostKeys: [] }),
    };
  },
  {
    name: 'danbooru-posts-v2',
    storage: createJSONStorage(() => extensionStorage),
    partialize: ({ query }) => ({ query }),
  },
));
