import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePostDetailResources } from '../../src/hooks/usePostDetailResources';
import type { BooruAdapter } from '../../src/types/api';
import type { UnifiedPost } from '../../src/types/post';

function post(overrides: Partial<UnifiedPost> = {}): UnifiedPost {
  return {
    id: 1, source: 'danbooru', rating: 'g', tags: [{ name: 'artist', category: 'artist' }], tagString: 'artist', score: 0,
    upScore: 0, downScore: 0, favCount: 0, uploader: 'tester', sourceUrl: '', imageWidth: 100, imageHeight: 100,
    fileSize: 0, fileExt: 'jpg', previewUrl: 'https://example.com/preview.jpg', sampleUrl: '', fileUrl: '', md5: '1',
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', parentId: 2, hasChildren: true,
    poolIds: [7], tagStringGeneral: '', tagStringArtist: 'artist', tagStringCopyright: '', tagStringCharacter: '', tagStringMeta: '',
    ...overrides,
  };
}

function adapter(overrides: Partial<BooruAdapter> = {}): BooruAdapter {
  return {
    id: 'danbooru', name: 'Danbooru', baseUrl: 'https://danbooru.donmai.us', supportsAuth: true, supportsWrites: true,
    searchPosts: vi.fn(), getPost: vi.fn(), autocomplete: vi.fn(), ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('post detail resources', () => {
  it('isolates failures and keeps successful relation results', async () => {
    const child = post({ id: 3, parentId: null, hasChildren: false });
    const source = adapter({
      getComments: vi.fn().mockRejectedValue(new Error('comments unavailable')),
      getRelatedTags: vi.fn().mockResolvedValue([{ name: 'related', category: 0 }]),
      getPools: vi.fn().mockResolvedValue([{ id: 7, name: 'pool', postCount: 2 }]),
      getPost: vi.fn().mockRejectedValue(new Error('parent unavailable')),
      getChildren: vi.fn().mockResolvedValue([child]),
    });
    const current = post();
    const { result } = renderHook(() => usePostDetailResources(true, current, source));

    await waitFor(() => expect(result.current.comments.status).toBe('error'));
    await waitFor(() => expect(result.current.relatedTags.status).toBe('success'));
    await waitFor(() => expect(result.current.pools.status).toBe('success'));
    await waitFor(() => expect(result.current.relations.status).toBe('error'));

    expect(result.current.relatedTags.data).toEqual([{ name: 'related', category: 0 }]);
    expect(result.current.pools.data).toEqual([{ id: 7, name: 'pool', postCount: 2 }]);
    expect(result.current.relations.data).toEqual([child]);
  });

  it('retries only the requested resource', async () => {
    const getComments = vi.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce([]);
    const getRelatedTags = vi.fn().mockResolvedValue([]);
    const source = adapter({ getComments, getRelatedTags });
    const current = post({ parentId: null, hasChildren: false, poolIds: [] });
    const { result } = renderHook(() => usePostDetailResources(true, current, source));
    await waitFor(() => expect(result.current.comments.status).toBe('error'));

    act(() => result.current.comments.retry());
    await waitFor(() => expect(result.current.comments.status).toBe('success'));

    expect(getComments).toHaveBeenCalledTimes(2);
    expect(getRelatedTags).toHaveBeenCalledTimes(1);
  });

  it('does not reload resources when enrichment replaces the post object', async () => {
    const getComments = vi.fn().mockResolvedValue([]);
    const getPools = vi.fn().mockResolvedValue([]);
    const source = adapter({ getComments, getPools });
    const initial = post({ parentId: null, hasChildren: false });
    const { rerender, result } = renderHook(({ current }) => usePostDetailResources(true, current, source), { initialProps: { current: initial } });
    await waitFor(() => expect(result.current.comments.status).toBe('success'));

    rerender({ current: { ...initial, tags: [...initial.tags] } });
    await act(() => Promise.resolve());

    expect(getComments).toHaveBeenCalledTimes(1);
    expect(getPools).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale resource response after switching posts', async () => {
    const first = deferred<Awaited<ReturnType<NonNullable<BooruAdapter['getComments']>>>>();
    const second = deferred<Awaited<ReturnType<NonNullable<BooruAdapter['getComments']>>>>();
    const getComments = vi.fn((id: number) => id === 1 ? first.promise : second.promise);
    const source = adapter({ getComments });
    const initial = post({ parentId: null, hasChildren: false, poolIds: [], tags: [] });
    const { rerender, result } = renderHook(({ current }) => usePostDetailResources(true, current, source), { initialProps: { current: initial } });

    rerender({ current: post({ id: 2, parentId: null, hasChildren: false, poolIds: [], tags: [] }) });
    expect(result.current.comments).toMatchObject({ status: 'loading', data: [] });
    second.resolve([{ id: 2, postId: 2, creator: 'new', body: 'new', score: 0, createdAt: '2026-01-01' }]);
    await waitFor(() => expect(result.current.comments.data[0]?.postId).toBe(2));
    first.resolve([{ id: 1, postId: 1, creator: 'old', body: 'old', score: 0, createdAt: '2026-01-01' }]);
    await act(() => Promise.resolve());

    expect(result.current.comments.data[0]?.postId).toBe(2);
  });

  it('reloads on a non-sensitive credential revision without putting credentials in resource state', async () => {
    const getComments = vi.fn().mockResolvedValue([]);
    const source = adapter({ getComments });
    const current = post({ parentId: null, hasChildren: false, poolIds: [], tags: [] });
    const credentials = { username: 'private-user', apiKey: 'private-key' };
    const { rerender, result } = renderHook(({ revision }) => usePostDetailResources(true, current, source, credentials, revision), { initialProps: { revision: 1 } });
    await waitFor(() => expect(result.current.comments.status).toBe('success'));
    rerender({ revision: 2 });
    await waitFor(() => expect(getComments).toHaveBeenCalledTimes(2));
    expect(JSON.stringify(result.current)).not.toMatch(/private-user|private-key/);
  });
});
