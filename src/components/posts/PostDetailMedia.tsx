import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { displayImageUrl } from '../../services/api/image-url';
import { isVideoPost } from '../../services/post-media';
import type { DetailImageQuality } from '../../stores/settings-store';
import type { UnifiedPost } from '../../types/post';
import { useI18n } from '../../i18n/runtime';
import { CachedImage } from './CachedImage';
import { MediaPreview } from './MediaPreview';

function detailImageUrl(post: UnifiedPost, quality: DetailImageQuality) {
  if (quality === 'preview') return post.previewUrl || post.sampleUrl || post.fileUrl;
  if (quality === 'original') return post.fileUrl || post.sampleUrl || post.previewUrl;
  return post.sampleUrl || post.fileUrl || post.previewUrl;
}

export function PostDetailMedia({ post, quality }: { post: UnifiedPost; quality: DetailImageQuality }) {
  const { messages: { posts: postMessages } } = useI18n();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });
  const source = detailImageUrl(post, quality);
  const thumbnailSource = post.previewUrl || post.sampleUrl || post.fileUrl;

  useEffect(() => {
    setScale(1); setOffset({ x: 0, y: 0 }); setFailed(false); setLoaded(false); setIsDragging(false); dragging.current = false;
  }, [post.source, post.id, quality]);

  if (isVideoPost(post) || !source || failed) return <MediaPreview key={`${post.source}:${post.id}`} post={post} eager />;

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };
  const zoom = (event: React.WheelEvent) => setScale((current) => Math.min(20, Math.max(.1, current * Math.exp(-event.deltaY * .0015))));
  const startDrag = (event: React.PointerEvent) => {
    dragging.current = true; setIsDragging(true); lastPoint.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId);
  };
  const drag = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = event.clientX - lastPoint.current.x; const dy = event.clientY - lastPoint.current.y;
    lastPoint.current = { x: event.clientX, y: event.clientY };
    setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
  };
  const endDrag = () => { dragging.current = false; setIsDragging(false); };

  return <div className={`detail-media-zoom${isDragging ? ' is-dragging' : ''}`} onWheel={zoom} onDoubleClick={reset} onPointerDown={startDrag} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>
    {!loaded && <span className="detail-media-loading"><LoaderCircle className="spin" size={24} /></span>}
    {thumbnailSource && <img className={`detail-media-thumb ${loaded ? 'is-replaced' : ''}`} src={displayImageUrl(thumbnailSource)} alt="" draggable={false} aria-hidden="true" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }} />}
    <CachedImage className={`detail-media-full ${loaded ? 'is-loaded' : ''}`} src={displayImageUrl(source)} alt={postMessages.common.postAlt(post.source, post.id)} draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }} />
  </div>;
}
