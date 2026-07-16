import { describe, expect, it } from 'vitest';
import { booruSources, getBooruAdapter } from '../../src/services/booru-adapters';
import { normalizeGelbooruPost, normalizeGelbooruTagResponse } from '../../src/services/booru-adapters/gelbooru';
import { normalizeYanderePost } from '../../src/services/booru-adapters/yandere';
import { hasTagCategory, rememberTagCategory, rememberTagMetadata, tagCategoryFor, tagCategoryFromType, tagMetadataNeedsRefresh } from '../../src/services/booru-adapters/tag-categories';
import { applyKnownTagCategories } from '../../src/services/booru-adapters/tag-enrichment';
import { cacheSuggestions, getCachedSuggestions } from '../../src/services/booru-adapters/tag-suggestion-cache';

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

  it('maps source tag types to shared visual categories', () => {
    expect(tagCategoryFromType(1)).toBe('artist');
    expect(tagCategoryFromType(3)).toBe('copyright');
    expect(tagCategoryFromType(4)).toBe('character');
    expect(tagCategoryFromType(5)).toBe('meta');
    expect(tagCategoryFromType(99)).toBe('general');
  });

  it('parses Gelbooru-family XML tag suggestions with categories', () => {
    const tags = normalizeGelbooruTagResponse('<?xml version="1.0"?><tags><tag type="1" count="120" name="sample_artist"/><tag type="4" count="75" name="sample_character"/></tags>');
    expect(tags).toEqual([
      { name: 'sample_artist', label: 'sample_artist', postCount: 120, category: 'artist' },
      { name: 'sample_character', label: 'sample_character', postCount: 75, category: 'character' },
    ]);
  });

  it('reuses learned categories when a post API only returns flat tags', () => {
    rememberTagCategory('safebooru', 'known_artist', 'artist');
    const post = normalizeGelbooruPost({ id: 31, tags: 'known_artist blue_sky', rating: 'safe' }, 'safebooru');
    expect(post.tags).toContainEqual({ name: 'known_artist', category: 'artist' });
    expect(post.tags).toContainEqual({ name: 'blue_sky', category: 'general' });
  });

  it('applies learned categories to an existing post record', () => {
    rememberTagCategory('yandere', 'sample_character', 'character');
    rememberTagCategory('yandere', 'sample_series', 'copyright');
    const post = normalizeYanderePost({ id: 45, tags: 'sample_character sample_series blue_sky', rating: 's', score: 2 });
    const enriched = applyKnownTagCategories(post);
    expect(enriched.tags).toContainEqual({ name: 'sample_character', category: 'character' });
    expect(enriched.tags).toContainEqual({ name: 'sample_series', category: 'copyright' });
  });

  it('keeps learned categories while tracking weekly count freshness', async () => {
    await rememberTagMetadata('rule34', [{ name: 'persistent_character', category: 'character', postCount: 42 }]);
    expect(hasTagCategory('rule34', 'persistent_character')).toBe(true);
    expect(tagCategoryFor('rule34', 'persistent_character')).toBe('character');
    expect(tagMetadataNeedsRefresh('rule34', ['persistent_character'])).toBe(false);
    rememberTagCategory('rule34', 'category_without_count', 'artist');
    expect(tagMetadataNeedsRefresh('rule34', ['category_without_count'])).toBe(true);
  });

  it('returns cached search suggestions without another request', async () => {
    const items = [{ name: 'cached_artist', label: 'cached_artist', category: 'artist' as const, postCount: 18 }];
    await cacheSuggestions('gelbooru', 'cached', items);
    await expect(getCachedSuggestions('gelbooru', 'cached')).resolves.toMatchObject({ items, stale: false });
  });
});
