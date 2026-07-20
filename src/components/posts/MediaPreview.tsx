import { Film, ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { displayImageUrl } from '../../services/api/image-url';
import { isAnimatedPost, isVideoPost, previewMediaUrl, thumbnailImageUrl } from '../../services/post-media';
import type { UnifiedPost } from '../../types/post';
import { CachedImage } from './CachedImage';
import { useI18n } from '../../i18n/runtime';
import { useSettingsStore } from '../../stores/settings-store';

export function MediaPreview({ post, className = '', eager = false }: { post: UnifiedPost; className?: string; eager?: boolean }) {
  const { messages: { posts: postMessages } } = useI18n();
  const thumbnailQuality = useSettingsStore((state) => state.thumbnailQuality);
  const [failed, setFailed] = useState(false);
  const mediaUrl = previewMediaUrl(post);
  const imageUrl = thumbnailImageUrl(post, thumbnailQuality);
  useEffect(() => setFailed(false), [post.source, post.id, mediaUrl, imageUrl, thumbnailQuality]);
  if (!mediaUrl || failed) return <span className={`media-placeholder ${className}`}><ImageOff size={28} /><span>{postMessages.mediaPreview.unavailable}</span><small>{post.fileExt || postMessages.mediaPreview.noMediaData}</small></span>;
  if (isVideoPost(post)) return <video className={className} src={displayImageUrl(post.playbackUrl || post.fileUrl)} poster={post.previewUrl ? displayImageUrl(post.previewUrl) : undefined} muted loop autoPlay={eager} playsInline preload={eager ? 'auto' : 'none'} onMouseEnter={(event) => { if (!eager) void event.currentTarget.play().catch(() => undefined); }} onMouseLeave={(event) => { if (!eager) event.currentTarget.pause(); }} onError={() => setFailed(true)} />;
  return <span className={`media-image ${className}`}><CachedImage src={displayImageUrl(imageUrl)} sizes="(max-width: 720px) 50vw, 24vw" alt={postMessages.common.postAlt(post.source, post.id)} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />{isAnimatedPost(post) && <span className="media-kind"><Film size={11} /> {post.fileExt.toUpperCase()}</span>}</span>;
}
