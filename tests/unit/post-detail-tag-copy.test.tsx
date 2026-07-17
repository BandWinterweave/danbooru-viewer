import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostDetail } from '../../src/components/posts/PostDetail';
import { ToastViewport } from '../../src/components/feedback/ToastViewport';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';
import { useFavoriteStore } from '../../src/stores/favorite-store';
import { usePostStore } from '../../src/stores/post-store';
import { useUiStore } from '../../src/stores/ui-store';
import { useSettingsStore } from '../../src/stores/settings-store';

vi.mock('../../src/components/posts/PostDetailMedia', () => ({ PostDetailMedia: () => <div data-testid="detail-media" /> }));
vi.mock('../../src/components/downloads/DownloadMenu', () => ({ DownloadMenu: () => <button>download</button> }));
vi.mock('../../src/hooks/usePostDetailResources', () => ({
  usePostDetailResources: () => {
    const resource = { status: 'unavailable', data: [], error: '', retry: vi.fn() };
    return { comments: resource, relatedTags: resource, pools: resource, relations: resource };
  },
}));

const post = normalizePost({
  id: 15, rating: 'g', tag_string: 'blue_sky', tag_string_general: 'blue_sky', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '',
  score: 1, up_score: 1, down_score: 0, fav_count: 0, uploader_name: 'user', source: '', image_width: 100, image_height: 100, file_size: 10, file_ext: 'jpg',
  preview_file_url: 'https://cdn.example/preview.jpg', large_file_url: 'https://cdn.example/sample.jpg', file_url: 'https://cdn.example/original.jpg',
  md5: 'detail-copy', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false,
});

describe('PostDetail tag copy', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    useUiStore.setState({ detailOpen: true, currentPost: post, detailContext: 'browse' });
    useFavoriteStore.setState({ hydrated: true, favorites: [], groups: [] });
    usePostStore.setState({ posts: [post], hasMore: false, isLoadingMore: false, enrichTags: vi.fn().mockResolvedValue(post) });
    useSettingsStore.setState({ copyTagCategories: ['artist', 'character', 'copyright', 'general', 'meta'], copyTagsUseUnderscores: true, copyTagsEscapeParentheses: false });
  });

  it('does not write when the tag category is disabled and explains why', async () => {
    useSettingsStore.setState({ copyTagCategories: ['artist'] });
    render(<><PostDetail /><ToastViewport /></>);

    fireEvent.click(screen.getByTitle('Copy blue_sky'));

    expect(writeText).not.toHaveBeenCalled();
    expect(await screen.findByText('Tag was not copied')).toBeInTheDocument();
    expect(screen.getByText('General tag copying is disabled in Settings.')).toBeInTheDocument();
  });

  it('copies the canonical tag name and shows a success toast', async () => {
    writeText.mockResolvedValue(undefined);
    render(<><PostDetail /><ToastViewport /></>);

    fireEvent.click(screen.getByTitle('Copy blue_sky'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('blue_sky'));
    expect(await screen.findByText('Tag copied')).toBeInTheDocument();
  });

  it('shows a localized permission failure toast when clipboard access is denied', async () => {
    writeText.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    render(<><PostDetail /><ToastViewport /></>);

    fireEvent.click(screen.getByTitle('Copy blue_sky'));

    expect(await screen.findByText('Could not copy tag')).toBeInTheDocument();
    expect(screen.getByText('Allow clipboard access and try again.')).toBeInTheDocument();
  });
});
