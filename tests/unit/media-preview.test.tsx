import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MediaPreview } from '../../src/components/posts/MediaPreview';
import { displayImageUrl } from '../../src/services/api/image-url';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';
import { thumbnailImageUrl } from '../../src/services/post-media';
import { useSettingsStore } from '../../src/stores/settings-store';

const post = normalizePost({
  id: 12, rating: 'g', tag_string: 'blue_sky', tag_string_general: 'blue_sky', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '',
  score: 1, up_score: 1, down_score: 0, fav_count: 0, source: '', image_width: 100, image_height: 100, file_size: 10, file_ext: 'jpg',
  preview_file_url: 'https://cdn.example/preview.jpg', large_file_url: 'https://cdn.example/sample.jpg', file_url: 'https://cdn.example/original.jpg',
  md5: 'media', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false,
});

describe('MediaPreview thumbnail quality', () => {
  beforeEach(() => useSettingsStore.setState({ thumbnailQuality: 'preview' }));

  it('selects preview or sample without falling back to the original image', () => {
    expect(thumbnailImageUrl(post, 'preview')).toBe(post.previewUrl);
    expect(thumbnailImageUrl(post, 'sample')).toBe(post.sampleUrl);
    expect(thumbnailImageUrl({ ...post, previewUrl: '', sampleUrl: '' }, 'sample')).toBe('');

    const { rerender } = render(<MediaPreview post={post} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', displayImageUrl(post.previewUrl));

    useSettingsStore.setState({ thumbnailQuality: 'sample' });
    rerender(<MediaPreview post={post} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', displayImageUrl(post.sampleUrl));
  });

  it('uses the selected non-original quality for video posters', () => {
    useSettingsStore.setState({ thumbnailQuality: 'sample' });
    const videoPost = { ...post, fileExt: 'mp4', playbackUrl: 'https://cdn.example/playback.mp4' };
    const { container } = render(<MediaPreview post={videoPost} />);

    expect(container.querySelector('video')).toHaveAttribute('poster', displayImageUrl(post.sampleUrl));
    expect(container.querySelector('video')).not.toHaveAttribute('poster', displayImageUrl(post.fileUrl));
  });

  it('retries after the post media URL or thumbnail quality changes', async () => {
    const { rerender } = render(<MediaPreview post={post} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('Preview unavailable')).toBeInTheDocument();

    useSettingsStore.setState({ thumbnailQuality: 'sample' });
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', displayImageUrl(post.sampleUrl)));
    fireEvent.error(screen.getByRole('img'));
    rerender(<MediaPreview post={{ ...post, id: 13, previewUrl: 'https://cdn.example/new.jpg', sampleUrl: 'https://cdn.example/new-sample.jpg' }} />);
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', displayImageUrl('https://cdn.example/new-sample.jpg')));
  });
});
