import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('idb-keyval', () => ({ createStore: vi.fn(() => ({})), get: vi.fn(), getMany: vi.fn(), set: vi.fn(), setMany: vi.fn(), del: vi.fn() }));
import { useFavoriteStore } from '../../src/stores/favorite-store';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';

const post = normalizePost({ id: 8, rating: 'g', tag_string: 'sample', tag_string_general: 'sample', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '', score: 1, up_score: 1, down_score: 0, fav_count: 0, source: '', image_width: 100, image_height: 100, file_size: 10, file_ext: 'jpg', preview_file_url: 'https://cdn.donmai.us/a.jpg', file_url: 'https://cdn.donmai.us/a.jpg', md5: 'a', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false });

describe('favorite groups', () => {
  beforeEach(() => useFavoriteStore.setState({ favorites: [], groups: [{ id: 'group', name: 'Samples', postKeys: [] }] }));

  it('adds a grouped post to local favorites and removes both references together', async () => {
    await useFavoriteStore.getState().toggleInGroup('group', post);
    expect(useFavoriteStore.getState().favorites).toContainEqual(post);
    expect(useFavoriteStore.getState().groups[0].postKeys).toEqual(['danbooru:8']);
    await useFavoriteStore.getState().toggleLocal(post);
    expect(useFavoriteStore.getState().favorites).toEqual([]);
    expect(useFavoriteStore.getState().groups[0].postKeys).toEqual([]);
  });
});
