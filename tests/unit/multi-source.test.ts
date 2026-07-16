import { describe, expect, it } from 'vitest';
import { booruSources, getBooruAdapter } from '../../src/services/booru-adapters';
import { normalizeGelbooruPost } from '../../src/services/booru-adapters/gelbooru';
import { normalizeYanderePost } from '../../src/services/booru-adapters/yandere';

describe('multi-source adapters', () => {
  it('registers every Phase 2 source', () => {
    expect(booruSources.map((source) => source.id)).toEqual(['danbooru', 'gelbooru', 'safebooru', 'yandere', 'rule34']);
    expect(getBooruAdapter('gelbooru').name).toBe('Gelbooru');
  });

  it('normalizes Gelbooru ratings, strings, and unclassified tags', () => {
    const post = normalizeGelbooruPost({ id: '19', tags: 'blue_sky 1girl', rating: 'general', score: '7', width: '1200', height: '800', file_url: 'http://img3.gelbooru.com/images/19.jpg' }, 'gelbooru');
    expect(post).toMatchObject({ id: 19, source: 'gelbooru', rating: 'g', score: 7, imageWidth: 1200 });
    expect(post.fileUrl).toBe('https://img3.gelbooru.com/images/19.jpg');
    expect(post.tags).toContainEqual({ name: 'blue_sky', category: 'general' });
  });

  it('reuses the Gelbooru contract without enabling unsupported writes', () => {
    expect(getBooruAdapter('gelbooru').addFavorite).toBeTypeOf('function');
    expect(getBooruAdapter('rule34').addFavorite).toBeUndefined();
    expect(getBooruAdapter('safebooru').supportsWrites).toBe(false);
  });

  it('normalizes Yande.re timestamps, media, and fallback ratings', () => {
    const post = normalizeYanderePost({ id: 23, tags: 'landscape sky', rating: 'unknown', score: 9, file_url: 'https://files.example/23.webm', width: 1280, height: 720, created_at: 1_700_000_000 });
    expect(post).toMatchObject({ id: 23, source: 'yandere', rating: 's', fileExt: 'webm', playbackUrl: 'https://files.example/23.webm', imageWidth: 1280 });
    expect(post.createdAt).toBe('2023-11-14T22:13:20.000Z');
  });
});
