import { describe, expect, it } from 'vitest';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';
import { formatTagsForCopy } from '../../src/services/tag-copy';

const post = normalizePost({
  id: 5, rating: 'g', tag_string: 'blue_sky artist_name character_(series)', tag_string_general: 'blue_sky', tag_string_artist: 'artist_name',
  tag_string_copyright: 'sample_series', tag_string_character: 'character_(series)', tag_string_meta: 'highres', score: 0, up_score: 0, down_score: 0,
  fav_count: 0, source: '', image_width: 100, image_height: 100, file_size: 10, file_ext: 'jpg', preview_file_url: '', large_file_url: '', file_url: '',
  md5: 'copy', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false,
});

describe('tag copy formatting', () => {
  it('orders selected categories and preserves underscores', () => {
    expect(formatTagsForCopy(post, { categories: ['general', 'artist', 'character'], useUnderscores: true, escapeParentheses: false }))
      .toBe('artist_name character_(series) blue_sky');
  });

  it('converts underscores and escapes prompt parentheses', () => {
    expect(formatTagsForCopy(post, { categories: ['character', 'copyright'], useUnderscores: false, escapeParentheses: true }))
      .toBe('character \\(series\\) sample series');
  });
});
