import { describe, expect, it } from 'vitest';
import { buildSourceTags } from '../../src/services/booru-adapters/query-tags';
import type { SearchQuery } from '../../src/types/api';
import { isOnOrAfter } from '../../src/services/booru-adapters/date-filter';

describe('source-specific filter translation', () => {
  const query: SearchQuery = { tags: 'landscape', ratings: ['g'], scoreMin: 10, dateAfter: '2026-01-01', minWidth: 1600, minHeight: 900, order: 'score' };

  it('uses Danbooru and Yande.re metatags', () => {
    expect(buildSourceTags('danbooru', query)).toBe('landscape rating:g score:>=10 date:>=2026-01-01 width:>=1600 height:>=900 order:score');
    expect(buildSourceTags('yandere', query)).toContain('rating:s');
    expect(buildSourceTags('yandere', query)).toContain('order:score');
    expect(buildSourceTags('yandere', query)).not.toContain('date:');
  });

  it('maps ratings and sorting for Gelbooru-family APIs', () => {
    expect(buildSourceTags('gelbooru', query)).toContain('rating:general');
    expect(buildSourceTags('gelbooru', query)).toContain('sort:score:desc');
    expect(buildSourceTags('gelbooru', query)).not.toContain('date:');
    expect(buildSourceTags('gelbooru', { ratings: ['s'] })).toBe('rating:sensitive');
    expect(buildSourceTags('safebooru', { ratings: ['s'] })).toBe('rating:safe');
    expect(buildSourceTags('rule34', { ratings: ['s'] })).toBe('rating:sensitive');
    expect(buildSourceTags('yandere', { ratings: ['s'] })).toBe('rating:s');
    expect(buildSourceTags('rule34', { ratings: ['e'], order: 'random' })).toBe('rating:explicit sort:random:desc');
    expect(buildSourceTags('safebooru', { order: 'rank' })).toBe('sort:updated:desc');
    expect(buildSourceTags('danbooru', { order: 'rank' })).toBe('order:rank');
    expect(buildSourceTags('danbooru', { order: 'score' })).toBe('score:>50 order:score');
    expect(buildSourceTags('danbooru', { order: 'random' })).toBe('age:<1month order:random');
  });

  it('applies unsupported date filters to normalized timestamps', () => {
    expect(isOnOrAfter('2026-07-15T10:00:00Z', '2026-07-15')).toBe(true);
    expect(isOnOrAfter('2026-07-14T23:59:59Z', '2026-07-15')).toBe(false);
  });
});
