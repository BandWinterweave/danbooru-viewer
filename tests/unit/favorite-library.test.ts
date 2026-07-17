import { describe, expect, it } from 'vitest';
import { indexFavoriteLibrary, queryFavoriteLibrary } from '../../src/services/favorite-library';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';

const base = normalizePost({ id: 8, rating: 'g', tag_string: 'sample blue_hair', tag_string_general: 'sample blue_hair', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '', score: 1, up_score: 1, down_score: 0, fav_count: 0, uploader_name: 'alice', source: 'https://example.com/work', image_width: 100, image_height: 100, file_size: 10, file_ext: 'jpg', preview_file_url: 'https://cdn.example/a.jpg', file_url: 'https://cdn.example/a.jpg', md5: 'a', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false });
const newer = { ...base, id: 9, md5: 'b', score: 20, rating: 'q' as const, uploader: 'bob', createdAt: '2026-02-01T00:00:00Z' };
const groups = [{ id: 'references', name: 'References', postKeys: ['danbooru:8'] }];

describe('favorite library query', () => {
  it('indexes grouped and ungrouped favorites', () => {
    const index = indexFavoriteLibrary([base, newer], groups);
    expect(index.groupIdsByPostKey.get('danbooru:8')).toEqual(new Set(['references']));
    expect(index.ungroupedKeys).toEqual(new Set(['danbooru:9']));
  });

  it.each(['blue_hair', '8', 'alice', 'example.com', 'references'])('searches across post and group fields: %s', (search) => {
    expect(queryFavoriteLibrary([base, newer], groups, { search }).map((post) => post.id)).toContain(8);
  });

  it('filters group, source, and rating together', () => {
    expect(queryFavoriteLibrary([base, newer], groups, { groupId: 'ungrouped', source: 'danbooru', rating: 'q' })).toEqual([newer]);
  });

  it('sorts without mutating saved order', () => {
    const favorites = [base, newer];
    expect(queryFavoriteLibrary(favorites, groups, { sort: 'score', direction: 'desc' }).map((post) => post.id)).toEqual([9, 8]);
    expect(queryFavoriteLibrary(favorites, groups, { sort: 'id', direction: 'asc' }).map((post) => post.id)).toEqual([8, 9]);
    expect(favorites).toEqual([base, newer]);
  });
});
