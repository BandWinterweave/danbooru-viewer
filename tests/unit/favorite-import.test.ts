import { describe, expect, it } from 'vitest';
import { mergeFavoriteImports, previewFavoriteImport } from '../../src/services/favorite-import';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';

const post = normalizePost({ id: 8, rating: 'g', tag_string: 'sample', tag_string_general: 'sample', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '', score: 1, up_score: 1, down_score: 0, fav_count: 0, source: '', image_width: 100, image_height: 100, file_size: 10, file_ext: 'jpg', preview_file_url: 'https://cdn.example/a.jpg', file_url: 'https://cdn.example/a.jpg', md5: 'a', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false });
const second = { ...post, id: 9, md5: 'b' };

describe('favorite import merge', () => {
  it('uses imported post snapshots while preserving local names for same-id groups', () => {
    const current = { favorites: [post], groups: [{ id: 'group', name: 'Old', postKeys: ['danbooru:8'] }, { id: 'same-name', name: 'Shared', postKeys: [] }] };
    const imported = { favorites: [{ ...post, score: 99 }, second], groups: [{ id: 'group', name: 'Imported', postKeys: ['danbooru:9'] }, { id: 'other-id', name: 'Shared', postKeys: ['danbooru:9'] }] };
    const merged = mergeFavoriteImports(current, imported);
    expect(merged.favorites).toEqual([{ ...post, score: 99 }, second]);
    expect(merged.groups).toEqual([
      { id: 'group', name: 'Old', postKeys: ['danbooru:8', 'danbooru:9'] },
      { id: 'same-name', name: 'Shared', postKeys: [] },
      { id: 'other-id', name: 'Shared', postKeys: ['danbooru:9'] },
    ]);
  });

  it('previews merge and replacement counts', () => {
    const preview = previewFavoriteImport({ favorites: [post], groups: [{ id: 'group', name: 'Old', postKeys: [] }] }, { favorites: [{ ...post, score: 2 }, second], groups: [{ id: 'group', name: 'New', postKeys: [] }, { id: 'new', name: 'New group', postKeys: [] }] });
    expect(preview).toMatchObject({ baseline: expect.stringMatching(/^[0-9a-f]{16}$/), importedFavorites: 2, addedFavorites: 1, updatedFavorites: 1, addedGroups: 1, mergedGroups: 1, resultFavorites: 2, resultGroups: 2, replacedFavorites: 1, replacedGroups: 1 });
  });
});
