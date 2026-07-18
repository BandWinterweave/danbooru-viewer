import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostCard } from '../../src/components/posts/PostCard';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';
import { useFilterStore } from '../../src/stores/filter-store';
import { displayImageUrl } from '../../src/services/api/image-url';
import { useUiStore } from '../../src/stores/ui-store';
import { usePostStore } from '../../src/stores/post-store';
import { useSettingsStore } from '../../src/stores/settings-store';
import { ToastViewport } from '../../src/components/feedback/ToastViewport';
import { useFavoriteStore } from '../../src/stores/favorite-store';

const post = normalizePost({
  id: 11590118,
  rating: 'g',
  tag_string: 're_naya original 1girl',
  tag_string_general: 'original 1girl',
  tag_string_artist: 're_naya',
  tag_string_copyright: '',
  tag_string_character: '',
  tag_string_meta: 'highres',
  score: 100,
  up_score: 100,
  down_score: 0,
  fav_count: 25,
  uploader_name: 'tester',
  source: '',
  image_width: 1200,
  image_height: 1600,
  file_size: 1024,
  file_ext: 'jpg',
  preview_file_url: 'https://cdn.example/preview.jpg',
  large_file_url: 'https://cdn.example/large.jpg',
  file_url: 'https://cdn.example/original.jpg',
  md5: 'abc',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  parent_id: null,
  has_children: false,
});

describe('PostCard', () => {
  beforeEach(() => {
    useFilterStore.setState({ searchText: '', activeFilters: [], ratings: [] });
    useUiStore.setState({ detailOpen: false, currentPost: null });
    useSettingsStore.setState({ layout: 'grid', copyTagCategories: ['artist', 'character', 'copyright', 'general', 'meta'], copyTagsUseUnderscores: false, copyTagsEscapeParentheses: false });
    usePostStore.setState({ enrichTags: vi.fn().mockResolvedValue(post) });
    useFavoriteStore.setState({ favorites: [], groups: [], hydrated: true });
  });
  afterEach(() => vi.useRealTimers());

  it('uses the thumbnail and exposes the canonical post link', () => {
    const { container } = render(<PostCard post={post} />);
    const image = screen.getByRole('img');
    const link = image.closest('a');
    const card = container.querySelector('.post-card');

    expect(image).toHaveAttribute('src', displayImageUrl(post.previewUrl));
    expect(image).not.toHaveAttribute('data-original');
    expect(link).toHaveAttribute('href', 'https://danbooru.donmai.us/posts/11590118?q=re_naya');
    expect(card).toHaveAttribute('data-post-url', 'https://danbooru.donmai.us/posts/11590118?q=re_naya');
    expect(card).not.toHaveAttribute('tabindex');
    expect(container.querySelector('.rating-badge')?.tagName).toBe('SPAN');
  });

  it('shows multiple tags and applies the selected tag', async () => {
    vi.useFakeTimers();
    const { container } = render(<PostCard post={post} />);
    fireEvent.mouseMove(container.querySelector('.post-card')!, { clientX: 200, clientY: 200 });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByText('re naya')).toBeInTheDocument();
    expect(screen.getByText('original')).toBeInTheDocument();
    expect(screen.getByText('highres')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTitle('Copy original').closest('.tooltip-tag')!);
    expect(screen.getByTitle('Exclude original').closest('.tooltip-tag')).not.toHaveClass('tooltip-tag--shifted');
    fireEvent.click(screen.getByTitle('Exclude original'));
    expect(useFilterStore.getState().activeFilters).toContainEqual(expect.objectContaining({ value: 'original', mode: 'exclude' }));
  });

  it('opens details from the image', () => {
    render(<PostCard post={post} />);
    fireEvent.click(screen.getByLabelText('Open post details'));
    expect(useUiStore.getState()).toMatchObject({ detailOpen: true, currentPost: post });
  });

  it('copies a tooltip tag without adding a filter', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { container } = render(<><PostCard post={post} /><ToastViewport /></>);
    fireEvent.mouseMove(container.querySelector('.post-card')!, { clientX: 200, clientY: 200 });
    await act(() => vi.advanceTimersByTimeAsync(800));

    fireEvent.click(screen.getByTitle('Copy re_naya'));
    await act(() => Promise.resolve());

    expect(writeText).toHaveBeenCalledWith('re naya');
    expect(useFilterStore.getState().activeFilters).toEqual([]);
  });

  it('shows a persistent indicator for a local favorite', () => {
    useFavoriteStore.setState({ favorites: [post] });
    const { container } = render(<PostCard post={post} />);
    expect(container.querySelector('.local-favorite-badge')).toBeInTheDocument();
  });

  it('enriches mounted list cards once and renders every tag', () => {
    const tags = Array.from({ length: 10 }, (_, index) => ({ name: `tag_${index}`, category: 'general' as const }));
    const listPost = { ...post, tags };
    const enrichTags = vi.fn().mockResolvedValue(listPost);
    usePostStore.setState({ enrichTags });
    useSettingsStore.setState({ layout: 'list' });

    const { rerender } = render(<PostCard post={listPost} />);
    expect(enrichTags).toHaveBeenCalledTimes(1);
    expect(screen.getByText('tag 9')).toBeInTheDocument();

    rerender(<PostCard post={{ ...listPost }} />);
    expect(enrichTags).toHaveBeenCalledTimes(1);
  });

  it('does not enrich cards outside list layout', () => {
    const enrichTags = vi.fn().mockResolvedValue(post);
    usePostStore.setState({ enrichTags });
    render(<PostCard post={post} />);
    expect(enrichTags).not.toHaveBeenCalled();
  });
});
