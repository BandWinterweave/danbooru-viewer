import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { acquireCachedImage } from '../../services/image-cache';

export function CachedImage({ src = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [resolvedSrc, setResolvedSrc] = useState(() => typeof indexedDB === 'undefined' ? src : '');
  useEffect(() => {
    let current = true;
    let release: (() => void) | undefined;
    setResolvedSrc(typeof indexedDB === 'undefined' ? src : '');
    void acquireCachedImage(src).then((value) => {
      release = value.release;
      if (current) setResolvedSrc(value.src);
      else release();
    });
    return () => { current = false; release?.(); };
  }, [src]);
  return resolvedSrc ? <img {...props} src={resolvedSrc} /> : null;
}
