import { Film, ImageOff } from 'lucide-react';
import { useState } from 'react';
import { displayImageUrl } from '../../services/api/image-url';
import { displayMediaUrl, isAnimatedPost, isVideoPost } from '../../services/post-media';
import type { UnifiedPost } from '../../types/post';

export function MediaPreview({ post, className = '', eager = false }: { post: UnifiedPost; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const mediaUrl = displayMediaUrl(post);
  if (!mediaUrl || failed) return <span className={`media-placeholder ${className}`}><ImageOff size={28} /><span>Preview unavailable</span><small>{post.fileExt || 'No media data'}</small></span>;
  if (isVideoPost(post)) return <video className={className} src={displayImageUrl(post.playbackUrl || post.fileUrl)} poster={post.previewUrl ? displayImageUrl(post.previewUrl) : undefined} muted loop autoPlay={eager} playsInline preload={eager ? 'auto' : 'none'} onMouseEnter={(event) => { if (!eager) void event.currentTarget.play().catch(() => undefined); }} onMouseLeave={(event) => { if (!eager) event.currentTarget.pause(); }} onError={() => setFailed(true)} />;
  return <span className={`media-image ${className}`}><img src={displayImageUrl(post.sampleUrl || post.previewUrl || post.fileUrl)} srcSet={post.previewUrl && post.sampleUrl ? `${displayImageUrl(post.previewUrl)} 180w, ${displayImageUrl(post.sampleUrl)} 850w` : undefined} sizes="(max-width: 720px) 50vw, 24vw" data-original={post.fileUrl} alt={`${post.source} post ${post.id}`} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />{isAnimatedPost(post) && <span className="media-kind"><Film size={11} /> {post.fileExt.toUpperCase()}</span>}</span>;
}
