import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CachedImage } from '../../src/components/posts/CachedImage';

const acquireCachedImage = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/image-cache', () => ({ acquireCachedImage }));

describe('CachedImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    acquireCachedImage.mockReset();
  });

  it('renders no placeholder while a transparent thumbnail is resolving', async () => {
    let resolveImage!: (value: { src: string; release: () => void }) => void;
    acquireCachedImage.mockReturnValue(new Promise((resolve) => { resolveImage = resolve; }));
    vi.stubGlobal('indexedDB', {});

    const { container } = render(<CachedImage src="https://cdn.example/transparent.png" alt="transparent" />);
    expect(container).toBeEmptyDOMElement();

    await act(async () => resolveImage({ src: 'blob:cached', release: vi.fn() }));
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:cached');
  });
});
