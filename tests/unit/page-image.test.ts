import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageImageMeetsThreshold, pageImageUrls } from '../../src/content/page-image';

function dimensions(image: HTMLImageElement, width: number, height: number) {
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  });
}

describe('third-party page image selection', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('chooses the largest srcset candidate before currentSrc and src', () => {
    const image = document.createElement('img');
    image.src = '/fallback.jpg';
    image.srcset = '/small.jpg 320w, /large.jpg 1600w, /medium.jpg 800w';
    Object.defineProperty(image, 'currentSrc', { configurable: true, value: 'https://site.test/current.jpg' });
    dimensions(image, 800, 600);

    expect(pageImageUrls(image, 'https://site.test/gallery/')[0]).toBe('https://site.test/large.jpg');
    expect(pageImageUrls(image, 'https://site.test/gallery/')).toEqual(expect.arrayContaining(['https://site.test/current.jpg', image.src]));
  });

  it('uses matching picture sources and density descriptors', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true } as MediaQueryList)));
    const picture = document.createElement('picture');
    picture.innerHTML = '<source media="(min-width: 1px)" srcset="/one.webp 1x, /three.webp 3x"><img src="/fallback.jpg">';
    const image = picture.querySelector('img')!;
    dimensions(image, 500, 500);

    expect(pageImageUrls(image, 'https://site.test/')[0]).toBe('https://site.test/three.webp');
  });

  it('checks natural pixel count against the configured threshold', () => {
    const image = document.createElement('img');
    dimensions(image, 512, 512);
    expect(pageImageMeetsThreshold(image, 262_144)).toBe(true);
    expect(pageImageMeetsThreshold(image, 262_145)).toBe(false);
  });

  it('caps candidates while preserving currentSrc and src fallbacks', () => {
    const image = document.createElement('img');
    image.src = '/fallback.jpg';
    image.srcset = Array.from({ length: 24 }, (_, index) => `/candidate-${index}.jpg ${index + 1}w`).join(', ');
    Object.defineProperty(image, 'currentSrc', { configurable: true, value: 'https://site.test/current.jpg' });
    dimensions(image, 800, 600);

    const urls = pageImageUrls(image, 'https://site.test/');
    expect(urls).toHaveLength(16);
    expect(urls).toEqual(expect.arrayContaining(['https://site.test/current.jpg', image.src]));
  });
});
