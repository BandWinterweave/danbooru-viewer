import { describe, expect, it } from 'vitest';
import { normalizePost, normalizeRelatedTags } from '../../src/services/booru-adapters/danbooru';

describe('Danbooru adapter', () => {
  it('normalizes raw post fields and categorized tags', () => {
    const post = normalizePost({
      id: 42,
      rating: 'q',
      tag_string: 'artist_name character_name blue_sky',
      tag_string_general: 'blue_sky',
      tag_string_artist: 'artist_name',
      tag_string_copyright: 'sample_series',
      tag_string_character: 'character_name',
      tag_string_meta: 'highres',
      score: 12,
      up_score: 14,
      down_score: -2,
      fav_count: 7,
      uploader_name: 'viewer',
      source: 'https://example.com',
      image_width: 1200,
      image_height: 800,
      file_size: 2048,
      file_ext: 'jpg',
      preview_file_url: 'https://cdn.example/preview.jpg',
      large_file_url: 'https://cdn.example/large.jpg',
      file_url: 'https://cdn.example/full.jpg',
      md5: 'abc',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
      parent_id: null,
      has_children: false,
    });

    expect(post.id).toBe(42);
    expect(post.rating).toBe('q');
    expect(post.tags).toContainEqual({ name: 'artist_name', category: 'artist' });
    expect(post.tags).toContainEqual({ name: 'character_name', category: 'character' });
    expect(post.sampleUrl).toBe('https://cdn.example/large.jpg');
  });

  it('keeps the source archive and selects a playable ugoira variant', () => {
    const post = normalizePost({
      id: 99, rating: 'g', tag_string: 'animated', tag_string_general: 'animated', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '',
      score: 0, up_score: 0, down_score: 0, fav_count: 0, source: '', image_width: 1000, image_height: 1000, file_size: 10, file_ext: 'zip',
      preview_file_url: 'https://cdn.example/preview.jpg', large_file_url: 'https://cdn.example/large.jpg', file_url: 'https://cdn.example/frames.zip', md5: 'zip',
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false,
      media_asset: { duration: 2.5, variants: [{ file_ext: 'mp4', url: 'https://cdn.example/ugoira.mp4', width: 720, height: 720 }] },
    });
    expect(post.fileUrl).toBe('https://cdn.example/frames.zip');
    expect(post.playbackUrl).toBe('https://cdn.example/ugoira.mp4');
    expect(post.duration).toBe(2.5);
  });

  it('normalizes legacy and current related-tag responses and filters malformed records', () => {
    expect(normalizeRelatedTags({ related_tags: [['blue_sky', 0], ['bad'], [4, 1], ['nan', Number.NaN]] }))
      .toEqual([{ name: 'blue_sky', category: 0 }]);
    expect(normalizeRelatedTags({ tags: [{ name: 'artist_name', category: 1 }, null, { name: '', category: 0 }, { name: 'bad' }] }))
      .toEqual([{ name: 'artist_name', category: 1 }]);
    expect(normalizeRelatedTags(Array.from({ length: 15 }, (_, index) => ({ name: `tag_${index}`, category: 0 })))).toHaveLength(12);
  });
});
