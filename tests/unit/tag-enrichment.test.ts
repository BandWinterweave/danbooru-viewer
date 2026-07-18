import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrichPageTags, enrichPostTags, resetPageTagEnrichmentForTests } from '../../src/services/booru-adapters/tag-enrichment';
import { rememberTagMetadata, resetTagMetadataMemoryForTests } from '../../src/services/booru-adapters/tag-categories';
import type { UnifiedPost } from '../../src/types/post';
import { apiGet } from '../../src/services/api/client';

vi.mock('../../src/services/api/client', () => ({ apiGet: vi.fn() }));

const post: UnifiedPost = {
  id: 501,
  source: 'gelbooru',
  rating: 'g',
  tags: [{ name: 'fkey', category: 'general' }],
  tagString: 'fkey',
  score: 0,
  upScore: 0,
  downScore: 0,
  favCount: 0,
  uploader: 'unknown',
  sourceUrl: '',
  imageWidth: 1,
  imageHeight: 1,
  fileSize: 0,
  fileExt: 'jpg',
  previewUrl: '',
  sampleUrl: '',
  fileUrl: '',
  md5: 'fkey',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  parentId: null,
  hasChildren: false,
  tagStringGeneral: 'fkey',
  tagStringArtist: '',
  tagStringCopyright: '',
  tagStringCharacter: '',
  tagStringMeta: '',
};

describe('cross-source tag enrichment', () => {
  beforeEach(() => {
    resetTagMetadataMemoryForTests();
    resetPageTagEnrichmentForTests();
    vi.mocked(apiGet).mockReset().mockResolvedValue([{ name: 'fkey', category: 1, post_count: 100 }]);
  });

  it('applies canonical Danbooru categories to another source immediately', async () => {
    const enriched = await enrichPostTags(post);

    expect(enriched.tags).toEqual([{ name: 'fkey', category: 'artist' }]);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('reuses the canonical category without another request', async () => {
    await enrichPostTags(post);
    await enrichPostTags({ ...post, id: 502 });

    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('deduplicates all tags on a page into one metadata request', async () => {
    vi.mocked(apiGet).mockResolvedValue([
      { name: 'fkey', category: 1, post_count: 100 },
      { name: 'second_tag', category: 4, post_count: 50 },
    ]);
    const items = await enrichPageTags([
      post,
      { ...post, id: 502, tags: [{ name: 'fkey', category: 'general' }, { name: 'second_tag', category: 'general' }] },
    ]);

    expect(apiGet).toHaveBeenCalledTimes(1);
    const requestedUrl = vi.mocked(apiGet).mock.calls[0][0] as URL;
    expect(requestedUrl.searchParams.get('search[name_comma]')).toBe('fkey,second_tag');
    expect(items[1].tags[1].category).toBe('character');
    await enrichPostTags(items[1]);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('splits large page metadata lookups into bounded requests', async () => {
    const tags = Array.from({ length: 101 }, (_, index) => ({ name: `tag_${index}`, category: 'general' as const }));
    vi.mocked(apiGet).mockResolvedValue([]);

    await enrichPageTags([{ ...post, tags }]);

    expect(apiGet).toHaveBeenCalledTimes(2);
    const urls = vi.mocked(apiGet).mock.calls.map(([url]) => url as URL);
    expect(urls.every((url) => url.toString().length <= 7000)).toBe(true);
    expect(urls.map((url) => Number(url.searchParams.get('limit')))).toEqual([100, 1]);
  });

  it('applies cached categories first and requests only missing tags', async () => {
    await rememberTagMetadata('danbooru', [{ name: 'cached_artist', category: 'artist', postCount: 20 }]);
    const mixedPost = {
      ...post,
      id: 503,
      tags: [
        { name: 'cached_artist', category: 'general' as const },
        { name: 'missing_character', category: 'general' as const },
      ],
    };
    let resolveRequest!: (records: Array<{ name: string; category: number; post_count: number }>) => void;
    vi.mocked(apiGet).mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const cachedUpdates: UnifiedPost[] = [];

    const request = enrichPostTags(mixedPost, undefined, (cached) => cachedUpdates.push(cached));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));

    expect(cachedUpdates[0].tags).toEqual([
      { name: 'cached_artist', category: 'artist' },
      { name: 'missing_character', category: 'general' },
    ]);
    const requestedUrl = vi.mocked(apiGet).mock.calls[0][0] as URL;
    expect(requestedUrl.searchParams.get('search[name_comma]')).toBe('missing_character');

    resolveRequest([{ name: 'missing_character', category: 4, post_count: 10 }]);
    await expect(request).resolves.toMatchObject({
      tags: [
        { name: 'cached_artist', category: 'artist' },
        { name: 'missing_character', category: 'character' },
      ],
    });
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('does not retry the same canonical request after a network failure', async () => {
    await rememberTagMetadata('gelbooru', [{ name: 'fkey', category: 'general', postCount: 10 }]);
    vi.mocked(apiGet).mockRejectedValue(new Error('offline'));

    const enriched = await enrichPostTags(post);

    expect(enriched.tags).toEqual([{ name: 'fkey', category: 'general' }]);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
