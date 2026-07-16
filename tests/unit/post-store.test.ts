import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaginatedResult, SearchQuery } from '../../src/types/api';
import type { BooruSource, UnifiedPost } from '../../src/types/post';

const mocks = vi.hoisted(() => ({ getBooruAdapter: vi.fn(), searchPosts: vi.fn() }));

vi.mock('../../src/services/booru-adapters', () => ({
  getBooruAdapter: mocks.getBooruAdapter,
}));

import { usePostStore } from '../../src/stores/post-store';
import { useSettingsStore } from '../../src/stores/settings-store';

function post(id: number, source: BooruSource = 'gelbooru'): UnifiedPost {
  return {
    id,
    source,
    rating: 'g',
    tags: [],
    tagString: '',
    score: 0,
    upScore: 0,
    downScore: 0,
    favCount: 0,
    uploader: 'tester',
    sourceUrl: '',
    imageWidth: 100,
    imageHeight: 100,
    fileSize: 0,
    fileExt: 'jpg',
    previewUrl: `https://example.com/${id}-preview.jpg`,
    sampleUrl: `https://example.com/${id}-sample.jpg`,
    fileUrl: `https://example.com/${id}.jpg`,
    md5: String(id),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    parentId: null,
    hasChildren: false,
    tagStringGeneral: '',
    tagStringArtist: '',
    tagStringCopyright: '',
    tagStringCharacter: '',
    tagStringMeta: '',
  };
}

function page(query: SearchQuery, items: UnifiedPost[], hasMore: boolean): PaginatedResult<UnifiedPost> {
  return { items, page: query.page ?? 1, limit: query.limit ?? 40, hasMore };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function abortable<T>(value: ReturnType<typeof deferred<T>>, signal?: AbortSignal) {
  signal?.addEventListener('abort', () => value.reject(new DOMException('cancelled', 'AbortError')), { once: true });
  return value.promise;
}

describe('post store pagination', () => {
  beforeEach(() => {
    mocks.searchPosts.mockReset();
    mocks.getBooruAdapter.mockReset();
    mocks.getBooruAdapter.mockImplementation(() => ({ searchPosts: mocks.searchPosts }));
    useSettingsStore.setState({ activeSource: 'gelbooru', credentials: {} });
    usePostStore.setState({
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
    });
  });

  it('continues an initial search after a client-filtered empty page', async () => {
    mocks.searchPosts
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [], true)))
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [post(2)], true)));

    await usePostStore.getState().search({ dateAfter: '2026-01-01', page: 1, limit: 40 });

    expect(mocks.searchPosts.mock.calls.map(([query]) => query.page)).toEqual([1, 2]);
    expect(usePostStore.getState()).toMatchObject({ posts: [post(2)], page: 2, hasMore: true, paginationStopReason: null, error: null });
  });

  it('stops after five consecutive client-filtered empty pages', async () => {
    mocks.searchPosts.mockImplementation((query: SearchQuery) => Promise.resolve(page(query, [], true)));

    await usePostStore.getState().search({ dateAfter: '2027-01-01', page: 1, limit: 40 });

    expect(mocks.searchPosts.mock.calls.map(([query]) => query.page)).toEqual([1, 2, 3, 4, 5]);
    expect(usePostStore.getState()).toMatchObject({ posts: [], page: 5, hasMore: false, paginationStopReason: 'filtered-page-limit', error: null });
  });

  it('distinguishes remote exhaustion from a filtered-page limit', async () => {
    mocks.searchPosts
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [], true)))
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [], false)));

    await usePostStore.getState().search({ dateAfter: '2026-01-01', page: 1, limit: 40 });

    expect(mocks.searchPosts).toHaveBeenCalledTimes(2);
    expect(usePostStore.getState()).toMatchObject({ posts: [], page: 2, hasMore: false, paginationStopReason: 'remote-end', error: null });
  });

  it('skips a filtered empty page while appending posts', async () => {
    mocks.searchPosts
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [post(1)], true)))
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [], true)))
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [post(3)], false)));

    await usePostStore.getState().search({ page: 1, limit: 40 });
    await usePostStore.getState().loadMore();

    expect(mocks.searchPosts.mock.calls.map(([query]) => query.page)).toEqual([1, 2, 3]);
    expect(usePostStore.getState()).toMatchObject({ posts: [post(1), post(3)], page: 3, hasMore: false, paginationStopReason: 'remote-end', error: null });
  });

  it('keeps the previous page retryable when a later request fails', async () => {
    mocks.searchPosts
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [post(1)], true)))
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [], true)))
      .mockRejectedValueOnce(new Error('network failed'));

    await usePostStore.getState().search({ page: 1, limit: 40 });
    await usePostStore.getState().loadMore();

    expect(mocks.searchPosts.mock.calls.map(([query]) => query.page)).toEqual([1, 2, 3]);
    expect(usePostStore.getState()).toMatchObject({ posts: [post(1)], page: 1, hasMore: true, paginationStopReason: null, failedOperation: 'append', error: 'network failed', isLoadingMore: false });
  });

  it('cancels a slow search and only commits the latest query', async () => {
    const slow = deferred<PaginatedResult<UnifiedPost>>();
    let slowSignal: AbortSignal | undefined;
    mocks.searchPosts.mockImplementation((query: SearchQuery, _credentials: unknown, signal?: AbortSignal) => {
      if (query.tags === 'slow') {
        slowSignal = signal;
        return abortable(slow, signal);
      }
      return Promise.resolve(page(query, [post(2)], false));
    });

    const oldSearch = usePostStore.getState().search({ tags: 'slow' });
    await usePostStore.getState().search({ tags: 'latest' });
    await oldSearch;

    expect(slowSignal?.aborted).toBe(true);
    expect(usePostStore.getState()).toMatchObject({ posts: [post(2)], query: { tags: 'latest' }, loadingPhase: 'idle', error: null });
  });

  it('freezes the source for a session and rejects results from the previous source', async () => {
    const slow = deferred<PaginatedResult<UnifiedPost>>();
    const adapters = new Map<BooruSource, { searchPosts: typeof mocks.searchPosts }>();
    mocks.getBooruAdapter.mockImplementation((source: BooruSource) => {
      const searchPosts = vi.fn((query: SearchQuery, _credentials: unknown, signal?: AbortSignal) => source === 'danbooru'
        ? abortable(slow, signal)
        : Promise.resolve(page(query, [post(7, source)], false)));
      const sourceAdapter = { searchPosts } as { searchPosts: typeof mocks.searchPosts };
      adapters.set(source, sourceAdapter);
      return sourceAdapter;
    });
    useSettingsStore.setState({ activeSource: 'danbooru' });

    const danbooruSearch = usePostStore.getState().search({ tags: 'source-test' });
    useSettingsStore.setState({ activeSource: 'gelbooru' });
    await usePostStore.getState().search({ tags: 'source-test' });
    await danbooruSearch;

    expect(adapters.get('danbooru')?.searchPosts.mock.calls[0]?.[2]).toMatchObject({ aborted: true });
    expect(usePostStore.getState().posts).toEqual([post(7, 'gelbooru')]);
  });

  it('does not let an old pagination promise block the new session', async () => {
    const oldPage = deferred<PaginatedResult<UnifiedPost>>();
    mocks.searchPosts.mockImplementation((query: SearchQuery, _credentials: unknown, signal?: AbortSignal) => {
      if (query.tags === 'old' && query.page === 2) return abortable(oldPage, signal);
      const id = query.tags === 'old' ? 1 : query.page === 1 ? 10 : 11;
      return Promise.resolve(page(query, [post(id)], true));
    });

    await usePostStore.getState().search({ tags: 'old' });
    const oldLoadMore = usePostStore.getState().loadMore();
    await usePostStore.getState().search({ tags: 'new' });
    await oldLoadMore;
    await usePostStore.getState().loadMore();

    expect(usePostStore.getState().posts).toEqual([post(10), post(11)]);
    expect(mocks.searchPosts.mock.calls.map(([query]) => [query.tags, query.page])).toEqual([
      ['old', 1], ['old', 2], ['new', 1], ['new', 2],
    ]);
  });

  it('deduplicates repeated pagination within one session', async () => {
    const secondPage = deferred<PaginatedResult<UnifiedPost>>();
    mocks.searchPosts
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [post(1)], true)))
      .mockImplementationOnce((_query: SearchQuery, _credentials: unknown, signal?: AbortSignal) => abortable(secondPage, signal));
    await usePostStore.getState().search({ tags: 'dedupe' });

    const first = usePostStore.getState().loadMore();
    const second = usePostStore.getState().loadMore();
    expect(first).toBe(second);
    expect(usePostStore.getState().loadingPhase).toBe('append');
    secondPage.resolve(page({ page: 2 }, [post(2)], false));
    await first;

    expect(mocks.searchPosts).toHaveBeenCalledTimes(2);
    expect(usePostStore.getState()).toMatchObject({ posts: [post(1), post(2)], loadingPhase: 'idle' });
  });

  it('keeps existing posts visible when filters refresh the same source', async () => {
    const refresh = deferred<PaginatedResult<UnifiedPost>>();
    mocks.searchPosts
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [post(1)], true)))
      .mockImplementationOnce((_query: SearchQuery, _credentials: unknown, signal?: AbortSignal) => abortable(refresh, signal));
    await usePostStore.getState().search({ tags: 'refresh' });

    const request = usePostStore.getState().search({ tags: 'changed-filter' });
    expect(usePostStore.getState()).toMatchObject({ posts: [post(1)], query: { tags: 'changed-filter' }, loadingPhase: 'refresh', isLoading: true });
    refresh.resolve(page({ page: 1 }, [post(2)], false));
    await request;

    expect(usePostStore.getState()).toMatchObject({ posts: [post(2)], loadingPhase: 'idle', isLoading: false });
  });

  it('keeps credentials fixed for pagination in the same session', async () => {
    useSettingsStore.setState({ credentials: { gelbooru: { username: 'old-user', apiKey: 'old-key' } } });
    mocks.searchPosts.mockImplementation((query: SearchQuery) => Promise.resolve(page(query, [post(query.page ?? 1)], true)));

    await usePostStore.getState().search({ tags: 'credentials' });
    useSettingsStore.setState({ credentials: { gelbooru: { username: 'new-user', apiKey: 'new-key' } } });
    await usePostStore.getState().loadMore();

    expect(mocks.searchPosts.mock.calls.map(([, passedCredentials]) => passedCredentials)).toEqual([
      { username: 'old-user', apiKey: 'old-key' },
      { username: 'old-user', apiKey: 'old-key' },
    ]);
  });

  it('retries a failed append without clearing existing posts', async () => {
    mocks.searchPosts
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [post(1)], true)))
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [post(2)], false)));
    await usePostStore.getState().search({ tags: 'retry' });
    await usePostStore.getState().loadMore();

    const retry = usePostStore.getState().retry();
    expect(usePostStore.getState()).toMatchObject({ posts: [post(1)], loadingPhase: 'retry' });
    await retry;

    expect(mocks.searchPosts.mock.calls.map(([query]) => query.page)).toEqual([1, 2, 2]);
    expect(usePostStore.getState()).toMatchObject({ posts: [post(1), post(2)], failedOperation: null, error: null });
  });

  it('does not navigate into a replacement search session', async () => {
    const oldPage = deferred<PaginatedResult<UnifiedPost>>();
    mocks.searchPosts.mockImplementation((query: SearchQuery, _credentials: unknown, signal?: AbortSignal) => {
      if (query.tags === 'old' && query.page === 2) return abortable(oldPage, signal);
      return Promise.resolve(page(query, [post(query.tags === 'old' ? 1 : 10)], true));
    });
    await usePostStore.getState().search({ tags: 'old' });

    const navigation = usePostStore.getState().navigateDetail(post(1), 1);
    await usePostStore.getState().search({ tags: 'new' });

    await expect(navigation).resolves.toBeNull();
  });
});
