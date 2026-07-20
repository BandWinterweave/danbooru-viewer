interface SrcsetCandidate {
  url: string;
  score: number;
}

function parseSrcset(srcset: string, baseUrl: string, naturalWidth: number): SrcsetCandidate[] {
  return srcset.split(',').flatMap((raw) => {
    const value = raw.trim();
    if (!value) return [];
    const [urlValue, descriptor = '1x'] = value.split(/\s+/, 2);
    let url: URL;
    try { url = new URL(urlValue, baseUrl); } catch { return []; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return [];
    const number = Number.parseFloat(descriptor);
    const score = descriptor.endsWith('w') ? number : descriptor.endsWith('x') ? number * Math.max(1, naturalWidth) : 1;
    return Number.isFinite(score) ? [{ url: url.toString(), score }] : [];
  });
}

export function pageImageUrls(image: HTMLImageElement, baseUrl = document.baseURI): string[] {
  const candidates: SrcsetCandidate[] = [];
  const picture = image.closest('picture');
  if (picture) {
    for (const source of picture.querySelectorAll<HTMLSourceElement>('source[srcset]')) {
      if (source.media && !window.matchMedia(source.media).matches) continue;
      candidates.push(...parseSrcset(source.srcset, baseUrl, image.naturalWidth));
    }
  }
  candidates.push(...parseSrcset(image.srcset, baseUrl, image.naturalWidth));
  const ordered = candidates.sort((left, right) => right.score - left.score).map((candidate) => candidate.url);
  const fallbacks: string[] = [];
  for (const fallback of [image.currentSrc, image.src]) {
    try {
      const url = new URL(fallback, baseUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') fallbacks.push(url.toString());
    } catch { /* Ignore invalid page image URLs. */ }
  }
  const uniqueFallbacks = [...new Set(fallbacks)];
  const preferred = [...new Set(ordered)].filter((url) => !uniqueFallbacks.includes(url)).slice(0, Math.max(0, 16 - uniqueFallbacks.length));
  return [...preferred, ...uniqueFallbacks].slice(0, 16);
}

export function pageImageMeetsThreshold(image: HTMLImageElement, minPixels: number): boolean {
  return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth * image.naturalHeight >= minPixels;
}
