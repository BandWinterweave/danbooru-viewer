import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PostDetailMedia } from '../../src/components/posts/PostDetailMedia';
import { normalizePost } from '../../src/services/booru-adapters/danbooru';
import { useSettingsStore } from '../../src/stores/settings-store';

vi.mock('../../src/components/posts/CachedImage', () => ({ CachedImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));

const post = normalizePost({ id: 30, rating: 'g', tag_string: 'sample', tag_string_general: 'sample', tag_string_artist: '', tag_string_copyright: '', tag_string_character: '', tag_string_meta: '', score: 0, up_score: 0, down_score: 0, fav_count: 0, source: '', image_width: 8000, image_height: 6000, file_size: 10, file_ext: 'jpg', preview_file_url: 'https://cdn.example/preview.jpg', file_url: 'https://cdn.example/original.jpg', md5: 'media', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', parent_id: null, has_children: false });

describe('PostDetailMedia', () => {
  const pointer = (element: Element, type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(element, event);
  };

  it('keeps scale-one media in the contain surface and can drag below scale one', () => {
    const { container } = render(<PostDetailMedia post={post} quality="original" />);
    const zoom = container.querySelector('.detail-media-zoom') as HTMLElement;
    Object.defineProperty(zoom, 'setPointerCapture', { value: vi.fn() });
    fireEvent.wheel(zoom, { deltaY: 1000 });
    pointer(zoom, 'pointerdown', 10, 10);
    pointer(zoom, 'pointermove', 35, 45);

    expect(zoom).toHaveClass('is-dragging');
    expect(container.querySelector<HTMLElement>('.detail-media-full')?.style.transform).toContain('translate(25px, 35px)');
    pointer(zoom, 'pointerup', 35, 45);
    expect(zoom).not.toHaveClass('is-dragging');
  });

  it('resets scale and offset when the post changes', () => {
    const { container, rerender } = render(<PostDetailMedia post={post} quality="original" />);
    const zoom = container.querySelector('.detail-media-zoom') as HTMLElement;
    Object.defineProperty(zoom, 'setPointerCapture', { value: vi.fn() });
    pointer(zoom, 'pointerdown', 0, 0);
    pointer(zoom, 'pointermove', 20, 20);
    rerender(<PostDetailMedia post={{ ...post, id: 31 }} quality="original" />);
    expect(container.querySelector('.detail-media-full')).toHaveStyle({ transform: 'translate(0px, 0px) scale(1)' });
  });

  it('provides native controls and zooming for video', () => {
    useSettingsStore.setState({ videoAutoplay: true });
    const video = { ...post, fileExt: 'mp4', fileUrl: 'https://cdn.example/video.mp4', playbackUrl: 'https://cdn.example/video.mp4' };
    const { container } = render(<PostDetailMedia post={video} quality="original" />);
    const zoom = container.querySelector('.detail-media-zoom') as HTMLElement;
    fireEvent.wheel(zoom, { deltaY: -5000 });
    expect(container.querySelector('video')).toHaveAttribute('controls');
    expect(container.querySelector('video')).toHaveAttribute('autoplay');
    expect(container.querySelector<HTMLVideoElement>('video')?.muted).toBe(true);
    expect(container.querySelector<HTMLElement>('video')?.style.transform).toContain('scale(50)');
  });
});
