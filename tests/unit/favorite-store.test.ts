import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('idb-keyval', () => ({ createStore: vi.fn(() => ({})), get: vi.fn(), getMany: vi.fn(), set: vi.fn(), setMany: vi.fn(), del: vi.fn() }));
import { get, setMany } from 'idb-keyval';
import { useFavoriteStore } from '../../src/stores/favorite-store';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';

const post = normalizePost({ id: 8, rating: 'g', tag_string: 'sample', tag_string_general: 'sample', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '', score: 1, up_score: 1, down_score: 0, fav_count: 0, source: '', image_width: 100, image_height: 100, file_size: 10, file_ext: 'jpg', preview_file_url: 'https://cdn.donmai.us/a.jpg', file_url: 'https://cdn.donmai.us/a.jpg', md5: 'a', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false });
const secondPost = { ...post, id: 9, md5: 'b' };
const importFile = (data: unknown) => ({ size: JSON.stringify(data).length, text: async () => JSON.stringify(data) }) as File;

describe('favorite groups', () => {
  beforeEach(() => {
    vi.mocked(setMany).mockReset().mockResolvedValue(undefined);
    vi.mocked(get).mockReset().mockResolvedValue(undefined);
    useFavoriteStore.setState({ favorites: [], groups: [{ id: 'group', name: 'Samples', postKeys: [] }], hydrated: true });
  });

  it('adds a grouped post to local favorites and removes both references together', async () => {
    await useFavoriteStore.getState().toggleInGroup('group', post);
    expect(useFavoriteStore.getState().favorites).toContainEqual(post);
    expect(useFavoriteStore.getState().groups[0].postKeys).toEqual(['danbooru:8']);
    await useFavoriteStore.getState().toggleLocal(post);
    expect(useFavoriteStore.getState().favorites).toEqual([]);
    expect(useFavoriteStore.getState().groups[0].postKeys).toEqual([]);
  });

  it('serializes concurrent mutations so neither update is lost', async () => {
    let finishFirst!: () => void;
    vi.mocked(setMany)
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(undefined);
    const first = useFavoriteStore.getState().toggleLocal(post);
    const second = useFavoriteStore.getState().toggleLocal(secondPost);
    await Promise.resolve();
    expect(setMany).toHaveBeenCalledTimes(1);
    finishFirst();
    await Promise.all([first, second]);
    expect(useFavoriteStore.getState().favorites.map((item) => item.id)).toEqual([9, 8]);
  });

  it('blocks writes after hydration fails so persisted favorites cannot be overwritten', async () => {
    vi.mocked(get).mockRejectedValueOnce(new Error('read failed'));
    useFavoriteStore.setState({ favorites: [], groups: [], hydrated: false });
    await expect(useFavoriteStore.getState().hydrate()).rejects.toThrow('read failed');
    await expect(useFavoriteStore.getState().toggleLocal(post)).rejects.toThrow('Favorites could not be loaded');
    expect(setMany).not.toHaveBeenCalled();
  });

  it('imports a validated file with one atomic write', async () => {
    const file = importFile({ version: 1, favorites: [post], groups: [{ id: 'imported', name: 'Imported', postKeys: ['danbooru:8'] }] });
    await useFavoriteStore.getState().importJson(file);
    expect(setMany).toHaveBeenCalledTimes(1);
    expect(useFavoriteStore.getState().favorites).toHaveLength(1);
    expect(useFavoriteStore.getState().favorites[0]).toMatchObject({ id: 8, source: 'danbooru', fileUrl: 'https://cdn.donmai.us/a.jpg' });
    expect(useFavoriteStore.getState().groups).toEqual([{ id: 'imported', name: 'Imported', postKeys: ['danbooru:8'] }]);
  });

  it.each([
    { version: 1, favorites: [{ ...post, fileUrl: 'javascript:alert(1)' }], groups: [] },
    { version: 1, favorites: [post, post], groups: [] },
    { version: 1, favorites: [post], groups: [{ id: 'group', name: 'Invalid', postKeys: ['danbooru:999'] }] },
    { version: 2, favorites: [post], groups: [] },
  ])('rejects invalid imports without writing', async (data) => {
    const file = importFile(data);
    await expect(useFavoriteStore.getState().importJson(file)).rejects.toThrow();
    expect(setMany).not.toHaveBeenCalled();
  });

  it('preserves existing state when the import transaction fails', async () => {
    vi.mocked(setMany).mockRejectedValueOnce(new Error('write failed'));
    useFavoriteStore.setState({ favorites: [post], groups: [{ id: 'group', name: 'Samples', postKeys: ['danbooru:8'] }] });
    const file = importFile({ version: 1, favorites: [], groups: [] });
    await expect(useFavoriteStore.getState().importJson(file)).rejects.toThrow('write failed');
    expect(useFavoriteStore.getState()).toMatchObject({ favorites: [post], groups: [{ id: 'group', name: 'Samples', postKeys: ['danbooru:8'] }] });
  });

  it('rejects oversized files before reading them', async () => {
    const file = { size: 10 * 1024 * 1024 + 1, text: vi.fn() } as unknown as File;
    await expect(useFavoriteStore.getState().importJson(file)).rejects.toThrow('Invalid favorites file');
    expect(setMany).not.toHaveBeenCalled();
  });
});
