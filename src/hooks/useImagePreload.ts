import { useEffect } from 'react';
import { displayImageUrl } from '../services/api/image-url';
import type { UnifiedPost } from '../types/post';

export function useImagePreload(posts: UnifiedPost[], currentIndex: number) {
  useEffect(() => {
    const images = posts.slice(currentIndex + 1, currentIndex + 5).map((post) => {
      const image = new Image();
      image.src = displayImageUrl(post.sampleUrl || post.previewUrl);
      return image;
    });
    return () => { images.forEach((image) => { image.src = ''; }); };
  }, [currentIndex, posts]);
}
