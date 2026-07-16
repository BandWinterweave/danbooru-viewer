import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheSuggestions, getCachedSuggestions, suggestionCacheDiagnostics } from '../../src/services/booru-adapters/tag-suggestion-cache';
import { rememberTagCategory, TAG_COUNT_TTL, tagMetadataCacheDiagnostics } from '../../src/services/booru-adapters/tag-categories';

describe('bounded tag caches', () => {
  afterEach(() => vi.useRealTimers());
  it('bounds unique suggestion queries in memory', async () => {
    for (let index = 0; index < 550; index += 1) await cacheSuggestions('danbooru', `tag-${index}`, []);
    expect(suggestionCacheDiagnostics()).toEqual({ memoryEntries: 500, maxEntries: 500 });
  });

  it('bounds unique tag metadata in memory', () => {
    for (let index = 0; index < 10_050; index += 1) rememberTagCategory('danbooru', `tag-${index}`, 'general');
    expect(tagMetadataCacheDiagnostics()).toEqual({ memoryEntries: 10_000, maxEntries: 10_000 });
  });

  it('expires old suggestion queries', async () => {
    vi.useFakeTimers();
    await cacheSuggestions('yandere', 'ttl-query', []);
    vi.setSystemTime(Date.now() + TAG_COUNT_TTL + 1);
    await expect(getCachedSuggestions('yandere', 'ttl-query')).resolves.toBeUndefined();
  });
});
