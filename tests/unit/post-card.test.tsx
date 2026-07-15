import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostCard } from '../../src/components/posts/PostCard';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';
import { useFilterStore } from '../../src/stores/filter-store';
import { displayImageUrl } from '../../src/services/api/image-url';
import { useUiStore } from '../../src/stores/ui-store';

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
    useUiStore.setState({ detailOpen: false, viewerOpen: false, currentPost: null });
  });
  afterEach(() => vi.useRealTimers());

  it('uses a large thumbnail and exposes the canonical post link', () => {
    const { container } = render(<PostCard post={post} />);
    const image = screen.getByRole('img');
    const link = image.closest('a');

    expect(image).toHaveAttribute('src', displayImageUrl(post.sampleUrl));
    expect(image).toHaveAttribute('data-original', post.fileUrl);
    expect(link).toHaveAttribute('href', 'https://danbooru.donmai.us/posts/11590118?q=re_naya');
    expect(container.querySelector('.post-card')).toHaveAttribute('data-post-url', 'https://danbooru.donmai.us/posts/11590118?q=re_naya');
  });

  it('shows multiple tags and applies the selected tag', () => {
    vi.useFakeTimers();
    const { container } = render(<PostCard post={post} />);
    fireEvent.mouseMove(container.querySelector('.post-card')!, { clientX: 200, clientY: 200 });
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('re naya')).toBeInTheDocument();
    expect(screen.getByText('original')).toBeInTheDocument();
    expect(screen.getByText('highres')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Exclude original'));
    expect(useFilterStore.getState().activeFilters).toContainEqual(expect.objectContaining({ value: 'original', mode: 'exclude' }));
  });

  it('opens details from the image and the viewer from the rating badge', () => {
    render(<PostCard post={post} />);
    fireEvent.click(screen.getByLabelText('Open post details'));
    expect(useUiStore.getState()).toMatchObject({ detailOpen: true, viewerOpen: false, currentPost: post });
    useUiStore.setState({ detailOpen: false, viewerOpen: false, currentPost: null });
    fireEvent.click(screen.getByTitle('Open image viewer'));
    expect(useUiStore.getState()).toMatchObject({ detailOpen: false, viewerOpen: true, currentPost: post });
  });
});
