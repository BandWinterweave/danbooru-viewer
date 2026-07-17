import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboard } from '../../src/hooks/useKeyboard';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';
import { usePostStore } from '../../src/stores/post-store';
import { useSettingsStore } from '../../src/stores/settings-store';
import { useUiStore } from '../../src/stores/ui-store';
import { useFavoriteStore } from '../../src/stores/favorite-store';
import { downloadPost } from '../../src/services/download-service';

vi.mock('../../src/services/download-service', () => ({ downloadPost: vi.fn().mockResolvedValue(undefined), downloadPosts: vi.fn().mockResolvedValue(undefined) }));

const post = normalizePost({ id: 8, rating: 'g', tag_string: 'sample', tag_string_general: 'sample', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '', score: 1, up_score: 1, down_score: 0, fav_count: 0, source: '', image_width: 100, image_height: 100, file_size: 10, file_ext: 'jpg', preview_file_url: 'https://cdn.example/a.jpg', file_url: 'https://cdn.example/a.jpg', md5: 'a', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false });

function KeyboardHarness() { useKeyboard(); return null; }

describe('useKeyboard detail navigation', () => {
  beforeEach(() => {
    vi.mocked(downloadPost).mockClear();
    useSettingsStore.setState({ keyboardEnabled: true });
    useUiStore.setState({ detailOpen: true, currentPost: post, hoveredPost: null, detailContext: 'favorites' });
  });

  it('does not browse with left or right arrows from favorite detail context', async () => {
    const navigateDetail = vi.fn().mockResolvedValue(null);
    usePostStore.setState({ navigateDetail });
    render(<KeyboardHarness />);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(navigateDetail).not.toHaveBeenCalled();

    useUiStore.setState({ detailContext: 'browse' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(navigateDetail).toHaveBeenCalledWith(post, -1);
  });

  it('uses the hovered post for F and D outside detail and ignores repeats', () => {
    const toggleLocal = vi.fn().mockResolvedValue(undefined);
    useFavoriteStore.setState({ toggleLocal });
    useUiStore.setState({ detailOpen: false, currentPost: null, hoveredPost: post });
    render(<KeyboardHarness />);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', repeat: true }));

    expect(toggleLocal).toHaveBeenCalledWith(post);
    expect(downloadPost).toHaveBeenCalledTimes(1);
    expect(downloadPost).toHaveBeenCalledWith(post, 'full', useSettingsStore.getState().downloadRule);
  });

  it('prefers the detail post and applies zip playback download behavior', () => {
    const zipPost = { ...post, id: 9, fileExt: 'zip', playbackUrl: 'https://cdn.example/play.mp4' };
    useUiStore.setState({ detailOpen: true, currentPost: zipPost, hoveredPost: post });
    render(<KeyboardHarness />);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

    expect(downloadPost).toHaveBeenCalledWith(zipPost, 'playback', useSettingsStore.getState().downloadRule);
  });

  it('does nothing without a detail or hovered target', () => {
    const toggleLocal = vi.fn().mockResolvedValue(undefined);
    useFavoriteStore.setState({ toggleLocal });
    useUiStore.setState({ detailOpen: false, currentPost: post, hoveredPost: null });
    render(<KeyboardHarness />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(toggleLocal).not.toHaveBeenCalled();
    expect(downloadPost).not.toHaveBeenCalled();
  });
});
