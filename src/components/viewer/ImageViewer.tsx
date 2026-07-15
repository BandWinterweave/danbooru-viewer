import { useEffect, useRef, useState } from 'react';
import Lightbox, { type SlideshowRef } from 'yet-another-react-lightbox';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { getBooruAdapter } from '../../services/booru-adapters';
import { displayImageUrl } from '../../services/api/image-url';
import { useImagePreload } from '../../hooks/useImagePreload';
import { usePostStore } from '../../stores/post-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import type { NoteRecord } from '../../types/post';
import { DownloadMenu } from '../downloads/DownloadMenu';
import { NoteOverlay } from './NoteOverlay';

export function ImageViewer() {
  const open = useUiStore((state) => state.viewerOpen);
  const current = useUiStore((state) => state.currentPost);
  const close = useUiStore((state) => state.closeViewer);
  const setCurrent = useUiStore((state) => state.setCurrentPost);
  const posts = usePostStore((state) => state.posts);
  const interval = useSettingsStore((state) => state.slideshowInterval);
  const credentials = useSettingsStore((state) => current ? state.credentials[current.source] : undefined);
  const viewable = posts.filter((post) => post.fileUrl || post.sampleUrl);
  const slides = viewable.map((post) => ({ src: displayImageUrl(post.fileUrl || post.sampleUrl), alt: `${post.source} post ${post.id}`, width: post.imageWidth, height: post.imageHeight }));
  const initialIndex = current ? Math.max(0, viewable.findIndex((post) => post.id === current.id && post.source === current.source)) : 0;
  const [index, setIndex] = useState(initialIndex);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const slideshowRef = useRef<SlideshowRef>(null);
  const activePost = viewable[index] ?? current;
  useImagePreload(viewable, index);

  useEffect(() => { if (open) setIndex(initialIndex); }, [initialIndex, open]);
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

  return <Lightbox open={open} close={close} index={index} slides={slides} plugins={[Zoom, Fullscreen, Slideshow]} slideshow={{ ref: slideshowRef, delay: interval * 1000 }} on={{ view: ({ index: next }) => { setIndex(next); if (viewable[next]) setCurrent(viewable[next]); } }} render={{ slideContainer: ({ slide, children }) => { const post = viewable.find((item) => displayImageUrl(item.fileUrl || item.sampleUrl) === slide.src); return <div className="viewer-slide">{children}{post && post.id === activePost?.id && <NoteOverlay post={post} notes={notes} />}</div>; }, controls: () => activePost ? <div className="viewer-download"><DownloadMenu post={activePost} compact /><label title="Slideshow interval">{interval}s</label></div> : null }} carousel={{ finite: false }} />;
}
