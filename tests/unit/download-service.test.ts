import { describe, expect, it } from 'vitest';
import { buildDownloadFilename, resolveDownloadUrl } from '../../src/services/download-service';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';

const post = normalizePost({
  id: 42, rating: 'q', tag_string: 'artist_name 1girl', tag_string_general: '1girl', tag_string_artist: 'artist_name',
  tag_string_copyright: '', tag_string_character: '', tag_string_meta: '', score: 1, up_score: 1, down_score: 0,
  fav_count: 0, source: '', image_width: 1000, image_height: 800, file_size: 100, file_ext: 'png',
  preview_file_url: 'https://cdn.example/thumb.jpg', large_file_url: 'https://cdn.example/large.webp', file_url: 'https://cdn.example/full.png',
  md5: 'hash', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false,
});

describe('download service', () => {
  it('selects the requested rendition', () => {
    expect(resolveDownloadUrl(post, 'full')).toBe(post.fileUrl);
    expect(resolveDownloadUrl(post, 'sample')).toBe(post.sampleUrl);
    expect(resolveDownloadUrl(post, 'preview')).toBe(post.previewUrl);
  });

  it('expands filename variables and removes unsafe characters', () => {
    expect(buildDownloadFilename(post, '{source}:{id}/{artist}-{rating}-{size}', 'sample'))
      .toBe('Danbooru Viewer/danbooru_42_artist_name-q-sample.webp');
  });
});
