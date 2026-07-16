import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { cachedImageUrl, cachedObjectUrl } from '../../services/image-cache';

export function CachedImage({ src = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [resolvedSrc, setResolvedSrc] = useState(() => cachedObjectUrl(src) ?? (typeof indexedDB === 'undefined' ? src : ''));
  useEffect(() => {
    let current = true;
    setResolvedSrc(cachedObjectUrl(src) ?? (typeof indexedDB === 'undefined' ? src : ''));
    void cachedImageUrl(src).then((value) => { if (current) setResolvedSrc(value); });
    return () => { current = false; };
  }, [src]);
  return resolvedSrc ? <img {...props} src={resolvedSrc} /> : <span className="image-cache-loading" aria-hidden="true" />;
}
