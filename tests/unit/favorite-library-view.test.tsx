import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('idb-keyval', () => ({ createStore: vi.fn(() => ({})), get: vi.fn(), getMany: vi.fn(), set: vi.fn(), setMany: vi.fn().mockResolvedValue(undefined), del: vi.fn() }));
vi.mock('../../src/components/posts/MediaPreview', () => ({ MediaPreview: ({ post }: { post: { id: number } }) => <span>media-{post.id}</span> }));
import { setMany } from 'idb-keyval';
import { FavoriteLibrary } from '../../src/components/favorites/FavoriteLibrary';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';
import { useFavoriteStore } from '../../src/stores/favorite-store';
import { useUiStore } from '../../src/stores/ui-store';

const post = normalizePost({ id: 8, rating: 'g', tag_string: 'sample', tag_string_general: 'sample', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '', score: 1, up_score: 1, down_score: 0, fav_count: 0, source: '', image_width: 100, image_height: 100, file_size: 10, file_ext: 'jpg', preview_file_url: 'https://cdn.example/a.jpg', file_url: 'https://cdn.example/a.jpg', md5: 'a', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false });

describe('FavoriteLibrary', () => {
  beforeEach(() => {
    vi.mocked(setMany).mockReset().mockResolvedValue(undefined);
    vi.restoreAllMocks();
    useFavoriteStore.setState({ favorites: [post], groups: [{ id: 'group', name: 'Samples', postKeys: [] }], hydrated: true });
  });

  it('selects visible favorites and adds them to a group in one write', async () => {
    render(<FavoriteLibrary />);
    fireEvent.click(screen.getByRole('button', { name: 'Select visible favorites' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Choose group' }), { target: { value: 'group' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to group' }));
    await waitFor(() => expect(useFavoriteStore.getState().groups[0].postKeys).toEqual(['danbooru:8']));
    expect(setMany).toHaveBeenCalledTimes(1);
  });

  it('requires confirmation before removing local favorites', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<FavoriteLibrary />);
    fireEvent.click(screen.getByRole('button', { name: 'Select visible favorites' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove local favorites' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(setMany).not.toHaveBeenCalled();
    expect(useFavoriteStore.getState().favorites).toEqual([post]);
  });

  it('parses an import and shows merge and replace choices before writing', async () => {
    render(<FavoriteLibrary />);
    const data = JSON.stringify({ version: 1, favorites: [post], groups: [{ id: 'group', name: 'Imported name', postKeys: [] }] });
    const file = { size: data.length, text: async () => data } as File;
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(await screen.findByRole('dialog', { name: 'Import preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.getByText('Merge adds 0, updates 1, adds 0 groups, and merges 1 existing groups.')).toBeInTheDocument();
    expect(setMany).not.toHaveBeenCalled();
  });

  it('keeps the newest file selection when reads finish out of order', async () => {
    let resolveFirst!: (value: string) => void;
    let resolveSecond!: (value: string) => void;
    const first = { size: 1, text: () => new Promise<string>((resolve) => { resolveFirst = resolve; }) } as File;
    const second = { size: 1, text: () => new Promise<string>((resolve) => { resolveSecond = resolve; }) } as File;
    render(<FavoriteLibrary />);
    const input = document.querySelector('input[type="file"]')!;

    fireEvent.change(input, { target: { files: [first] } });
    fireEvent.change(input, { target: { files: [second] } });
    resolveSecond(JSON.stringify({ version: 1, favorites: [], groups: [] }));
    expect(await screen.findByText('0 favorites and 0 groups in this file')).toBeInTheDocument();
    resolveFirst(JSON.stringify({ version: 1, favorites: [post], groups: [{ id: 'old', name: 'Old', postKeys: [] }] }));
    await Promise.resolve();
    expect(screen.getByText('0 favorites and 0 groups in this file')).toBeInTheDocument();
  });

  it('traps modal focus, makes the background inert, closes on Escape, and restores focus', async () => {
    render(<div className="app-background"><FavoriteLibrary /></div>);
    const importButton = screen.getByRole('button', { name: 'Choose import file' });
    importButton.focus();
    const data = JSON.stringify({ version: 1, favorites: [], groups: [] });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [{ size: data.length, text: async () => data }] } });
    const dialog = await screen.findByRole('dialog', { name: 'Import preview' });

    expect(screen.getByRole('button', { name: 'Merge' })).toHaveFocus();
    expect((document.querySelector('.app-background') as HTMLElement).inert).toBe(true);
    screen.getByRole('button', { name: 'Cancel import' }).focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Merge' })).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect((document.querySelector('.app-background') as HTMLElement).inert).toBe(false);
    expect(importButton).toHaveFocus();
  });

  it('clears hidden selections when search, source, rating, or group filters change', () => {
    render(<FavoriteLibrary />);
    const selectVisible = screen.getByRole('button', { name: 'Select visible favorites' });
    const assertClearedAfter = (change: () => void) => {
      fireEvent.click(selectVisible);
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      change();
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    };
    assertClearedAfter(() => fireEvent.change(screen.getByRole('textbox', { name: 'Search favorites' }), { target: { value: 'sample' } }));
    assertClearedAfter(() => fireEvent.change(screen.getByRole('combobox', { name: 'All sources' }), { target: { value: 'danbooru' } }));
    assertClearedAfter(() => fireEvent.change(screen.getByRole('combobox', { name: 'All ratings' }), { target: { value: 'g' } }));
    assertClearedAfter(() => fireEvent.change(screen.getByRole('combobox', { name: 'All groups' }), { target: { value: 'group' } }));
  });

  it('disables import and export with an accessible reason before hydration', () => {
    useFavoriteStore.setState({ hydrated: false });
    render(<FavoriteLibrary />);
    expect(screen.getByRole('button', { name: 'Choose import file' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
    expect(screen.getAllByText(/Favorites could not be loaded/).length).toBeGreaterThan(0);
  });

  it('tracks the hovered favorite without allowing an old card to clear a newer target', () => {
    render(<FavoriteLibrary />);
    const card = screen.getByText('media-8').closest('article')!;
    fireEvent.mouseEnter(card);
    expect(useUiStore.getState().hoveredPost).toEqual(post);

    const newer = { ...post, id: 9 };
    useUiStore.getState().setHoveredPost(newer);
    fireEvent.mouseLeave(card);
    expect(useUiStore.getState().hoveredPost).toEqual(newer);
  });
});
