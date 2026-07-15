import { describe, expect, it } from 'vitest';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';

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
});
