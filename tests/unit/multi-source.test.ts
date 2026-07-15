import { describe, expect, it } from 'vitest';
import { booruSources, getBooruAdapter } from '../../src/services/booru-adapters';
import { normalizeGelbooruPost } from '../../src/services/booru-adapters/gelbooru';

describe('multi-source adapters', () => {
  it('registers every Phase 2 source', () => {
    expect(booruSources.map((source) => source.id)).toEqual(['danbooru', 'gelbooru', 'safebooru', 'yandere', 'rule34']);
    expect(getBooruAdapter('gelbooru').name).toBe('Gelbooru');
  });

  it('normalizes Gelbooru ratings, strings, and unclassified tags', () => {
    const post = normalizeGelbooruPost({ id: '19', tags: 'blue_sky 1girl', rating: 'general', score: '7', width: '1200', height: '800', file_url: 'https://img.example/19.jpg' }, 'gelbooru');
    expect(post).toMatchObject({ id: 19, source: 'gelbooru', rating: 'g', score: 7, imageWidth: 1200 });
    expect(post.tags).toContainEqual({ name: 'blue_sky', category: 'general' });
  });

  it('reuses the Gelbooru contract without enabling unsupported writes', () => {
    expect(getBooruAdapter('gelbooru').addFavorite).toBeTypeOf('function');
    expect(getBooruAdapter('rule34').addFavorite).toBeUndefined();
    expect(getBooruAdapter('safebooru').supportsWrites).toBe(false);
  });
});
