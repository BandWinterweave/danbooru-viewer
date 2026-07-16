import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaginatedResult, SearchQuery } from '../../src/types/api';
import type { UnifiedPost } from '../../src/types/post';

const mocks = vi.hoisted(() => ({ searchPosts: vi.fn() }));

vi.mock('../../src/services/booru-adapters', () => ({
  getBooruAdapter: () => ({ searchPosts: mocks.searchPosts }),
}));

import { usePostStore } from '../../src/stores/post-store';

function post(id: number): UnifiedPost {
  return {
    id,
    source: 'gelbooru',
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

describe('post store pagination', () => {
  beforeEach(() => {
    mocks.searchPosts.mockReset();
    usePostStore.setState({
      posts: [],
      query: { page: 1, limit: 40 },
      page: 0,
      isLoading: false,
      isLoadingMore: false,
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
    usePostStore.setState({ posts: [post(1)], page: 1, hasMore: true });
    mocks.searchPosts
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [], true)))
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [post(3)], false)));

    await usePostStore.getState().loadMore();

    expect(mocks.searchPosts.mock.calls.map(([query]) => query.page)).toEqual([2, 3]);
    expect(usePostStore.getState()).toMatchObject({ posts: [post(1), post(3)], page: 3, hasMore: false, paginationStopReason: 'remote-end', error: null });
  });

  it('keeps the previous page retryable when a later request fails', async () => {
    usePostStore.setState({ posts: [post(1)], page: 1, hasMore: true });
    mocks.searchPosts
      .mockImplementationOnce((query: SearchQuery) => Promise.resolve(page(query, [], true)))
      .mockRejectedValueOnce(new Error('network failed'));

    await usePostStore.getState().loadMore();

    expect(mocks.searchPosts.mock.calls.map(([query]) => query.page)).toEqual([2, 3]);
    expect(usePostStore.getState()).toMatchObject({ posts: [post(1)], page: 1, hasMore: true, paginationStopReason: null, error: 'network failed', isLoadingMore: false });
  });
});
