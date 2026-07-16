import { useEffect, useRef, useState } from 'react';
import Lightbox, { type SlideshowRef, type ZoomRef } from 'yet-another-react-lightbox';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { getBooruAdapter } from '../../services/booru-adapters';
import { displayImageUrl } from '../../services/api/image-url';
import { displayMediaUrl, isVideoPost } from '../../services/post-media';
import { useImagePreload } from '../../hooks/useImagePreload';
import { usePostStore } from '../../stores/post-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import type { NoteRecord } from '../../types/post';
import { DownloadMenu } from '../downloads/DownloadMenu';
import { NoteOverlay } from './NoteOverlay';
import { postMessages } from '../../i18n/en-posts';

export function ImageViewer() {
  const open = useUiStore((state) => state.viewerOpen);
  const current = useUiStore((state) => state.currentPost);
  const viewerIndex = useUiStore((state) => state.viewerIndex);
  const close = useUiStore((state) => state.closeViewer);
  const setViewerIndex = useUiStore((state) => state.setViewerIndex);
  const posts = usePostStore((state) => state.posts);
  const interval = useSettingsStore((state) => state.slideshowInterval);
  const credentials = useSettingsStore((state) => current ? state.credentials[current.source] : undefined);
  const viewable = posts.filter((post) => displayMediaUrl(post));
  const slides = viewable.map((post) => ({ src: displayImageUrl(displayMediaUrl(post)), alt: postMessages.common.postAlt(post.source, post.id), width: post.imageWidth, height: post.imageHeight }));
  const initialIndex = current ? Math.max(0, viewable.findIndex((post) => post.id === current.id && post.source === current.source)) : 0;
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [zoomLevel, setZoomLevel] = useState(1);
  const slideshowRef = useRef<SlideshowRef>(null);
  const zoomRef = useRef<ZoomRef>(null);
  const activePost = viewable[viewerIndex] ?? viewable[initialIndex] ?? current;
  useImagePreload(viewable, viewerIndex);

  useEffect(() => { if (open) setViewerIndex(initialIndex); }, [initialIndex, open, setViewerIndex]);
  useEffect(() => {
    if (!open || !activePost) { setNotes([]); return; }
    const adapter = getBooruAdapter(activePost.source);
    if (!adapter.getNotes) { setNotes([]); return; }
    let cancelled = false;
    adapter.getNotes(activePost.id, credentials).then((items) => { if (!cancelled) setNotes(items); }).catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [activePost, credentials, open]);
  useEffect(() => {
    const toggle = () => { const slideshow = slideshowRef.current; if (slideshow) slideshow.playing ? slideshow.pause() : slideshow.play(); };
    window.addEventListener('danbooru-toggle-slideshow', toggle);
    const runtimeListener = (message: unknown) => { if ((message as { type?: string })?.type === 'TOGGLE_SLIDESHOW') toggle(); };
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) chrome.runtime.onMessage.addListener(runtimeListener);
    return () => { window.removeEventListener('danbooru-toggle-slideshow', toggle); if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) chrome.runtime.onMessage.removeListener(runtimeListener); };
  }, []);

  return <Lightbox open={open} close={close} index={viewerIndex} slides={slides} plugins={[Zoom, Fullscreen, Slideshow]} animation={{ swipe: 0, navigation: 0 }} zoom={{ ref: zoomRef, scrollToZoom: false, zoomInMultiplier: 1.25, maxZoomPixelRatio: 6 }} slideshow={{ ref: slideshowRef, delay: interval * 1000 }} on={{ view: ({ index }) => { setViewerIndex(index); setZoomLevel(1); }, zoom: ({ zoom }) => setZoomLevel(zoom) }} render={{ slide: ({ slide, offset }) => { const post = viewable.find((item) => displayImageUrl(displayMediaUrl(item)) === slide.src); return post && isVideoPost(post) ? <video className="viewer-video" src={displayImageUrl(post.playbackUrl || post.fileUrl)} controls autoPlay={offset === 0} preload={offset === 0 ? 'auto' : 'metadata'} loop playsInline /> : undefined; }, slideContainer: ({ slide, children }) => { const post = viewable.find((item) => displayImageUrl(displayMediaUrl(item)) === slide.src); return <div className="viewer-slide" onWheel={(event) => { const zoom = zoomRef.current; if (!zoom || zoom.disabled) return; const target = Math.min(zoom.maxZoom, Math.max(zoom.minZoom, zoom.zoom * Math.exp(-event.deltaY * .0015))); zoom.changeZoom(target, true); }}>{children}{post && post.id === activePost?.id && !isVideoPost(post) && <NoteOverlay post={post} notes={notes} />}</div>; }, controls: () => activePost ? <div className="viewer-download"><DownloadMenu post={activePost} compact /><label title={postMessages.viewer.zoomLevel}>{Math.round(zoomLevel * 100)}%</label><label title={postMessages.viewer.slideshowInterval}>{interval}s</label></div> : null }} carousel={{ finite: false }} />;
}
