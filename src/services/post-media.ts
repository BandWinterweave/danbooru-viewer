import type { UnifiedPost } from '../types/post';
import type { ThumbnailQuality } from '../stores/settings-store';

const videoExtensions = new Set(['mp4', 'webm', 'm4v', 'ogv']);

export function extensionFromUrl(url: string) {
  return url.split('.').at(-1)?.split(/[?#]/)[0].toLowerCase() ?? '';
}

export function isVideoPost(post: UnifiedPost) {
  return videoExtensions.has(extensionFromUrl(post.playbackUrl || post.fileUrl)) || videoExtensions.has(post.fileExt.toLowerCase());
}

export function isAnimatedPost(post: UnifiedPost) {
  return isVideoPost(post) || ['gif', 'zip'].includes(post.fileExt.toLowerCase());
}

export function postPageUrl(post: UnifiedPost) {
  const urls = {
    danbooru: `https://danbooru.donmai.us/posts/${post.id}`,
    gelbooru: `https://gelbooru.com/index.php?page=post&s=view&id=${post.id}`,
    safebooru: `https://safebooru.org/index.php?page=post&s=view&id=${post.id}`,
    yandere: `https://yande.re/post/show/${post.id}`,
    rule34: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`,
  };
  return urls[post.source];
}

export function previewMediaUrl(post: UnifiedPost) {
  return isVideoPost(post) ? post.playbackUrl || post.fileUrl : post.previewUrl || post.sampleUrl;
}

export function thumbnailImageUrl(post: UnifiedPost, quality: ThumbnailQuality) {
  return quality === 'sample' ? post.sampleUrl || post.previewUrl : post.previewUrl || post.sampleUrl;
}

export function hasAvailablePreview(post: UnifiedPost) {
  return Boolean(previewMediaUrl(post));
}
