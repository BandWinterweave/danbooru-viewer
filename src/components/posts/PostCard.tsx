import { Check, CircleCheck, Eye, FolderPlus, Heart, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFilterStore } from '../../stores/filter-store';
import { useUiStore } from '../../stores/ui-store';
import { useFavoriteStore } from '../../stores/favorite-store';
import type { UnifiedPost } from '../../types/post';
import { displayImageUrl } from '../../services/api/image-url';
import { hasDownloaded } from '../../services/download-service';
import { DownloadMenu } from '../downloads/DownloadMenu';
import { usePostStore } from '../../stores/post-store';

function orderedTags(post: UnifiedPost) {
  const order = { artist: 0, character: 1, copyright: 2, general: 3, meta: 4 };
  return [...post.tags].sort((left, right) => order[left.category] - order[right.category]);
}

export function PostCard({ post }: { post: UnifiedPost }) {
  const openDetail = useUiStore((state) => state.openDetail);
  const openViewer = useUiStore((state) => state.openViewer);
  const addTag = useFilterStore((state) => state.addTagFilter);
  const isLocal = useFavoriteStore((state) => state.isLocal(post));
  const toggleLocal = useFavoriteStore((state) => state.toggleLocal);
  const groups = useFavoriteStore((state) => state.groups);
  const toggleInGroup = useFavoriteStore((state) => state.toggleInGroup);
  const selected = usePostStore((state) => state.selectedPostKeys.includes(`${post.source}:${post.id}`));
  const toggleSelected = usePostStore((state) => state.toggleSelected);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const closeTimer = useRef<number>();
  const dwellTimer = useRef<number>();
  const cursorPoint = useRef({ x: 0, y: 0 });
  const tags = orderedTags(post);
  const queryTag = tags.find((tag) => tag.category === 'artist') ?? tags.find((tag) => tag.category === 'character') ?? tags[0];
  const previewUrl = displayImageUrl(post.previewUrl);
  const sampleUrl = displayImageUrl(post.sampleUrl);
  const baseUrls = { danbooru: 'https://danbooru.donmai.us/posts/', gelbooru: 'https://gelbooru.com/index.php?page=post&s=view&id=', safebooru: 'https://safebooru.org/index.php?page=post&s=view&id=', yandere: 'https://yande.re/post/show/', rule34: 'https://rule34.xxx/index.php?page=post&s=view&id=' };
  const postUrl = `${baseUrls[post.source]}${post.id}${post.source === 'danbooru' && queryTag ? `?q=${encodeURIComponent(queryTag.name)}` : ''}`;
  const add = (tag: string, mode: 'include' | 'exclude') => (event: React.MouseEvent) => {
    event.stopPropagation();
    addTag(tag, mode);
  };
  const favorite = (event: React.MouseEvent) => { event.stopPropagation(); void toggleLocal(post); };
  const cancelClose = () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); };
  const cancelDwell = () => { if (dwellTimer.current) window.clearTimeout(dwellTimer.current); };
  const scheduleClose = () => { cancelDwell(); cancelClose(); if (tooltipOpen) closeTimer.current = window.setTimeout(() => { setTooltipOpen(false); setGroupMenuOpen(false); }, 140); };
  const trackDwell = (event: React.MouseEvent) => {
    cancelClose();
    cursorPoint.current = { x: event.clientX, y: event.clientY };
    if (tooltipOpen) return;
    cancelDwell();
    dwellTimer.current = window.setTimeout(() => { setPoint(cursorPoint.current); setTooltipOpen(true); }, 2000);
  };
  useEffect(() => {
    void hasDownloaded(post).then(setDownloaded);
    const update = () => void hasDownloaded(post).then(setDownloaded);
    window.addEventListener('danbooru-download-recorded', update);
    return () => { cancelDwell(); cancelClose(); window.removeEventListener('danbooru-download-recorded', update); };
  }, [post]);
  const tooltipWidth = typeof window === 'undefined' ? 460 : Math.min(520, window.innerWidth - 20);
  const tooltipLeft = typeof window === 'undefined' ? point.x : Math.min(Math.max(point.x - tooltipWidth / 2, 10), window.innerWidth - tooltipWidth - 10);
  const tooltipAbove = point.y > 225;

  const tooltip = tooltipOpen && typeof document !== 'undefined' ? createPortal(
    <div
      className="post-tooltip"
      data-placement={tooltipAbove ? 'above' : 'below'}
      style={{ width: tooltipWidth, left: tooltipLeft, top: tooltipAbove ? point.y - 12 : point.y + 14, transform: tooltipAbove ? 'translateY(-100%)' : undefined, '--tooltip-arrow-x': `${point.x - tooltipLeft}px` } as React.CSSProperties}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <div className="post-tooltip-header">
        <strong>{post.source} #{post.id}</strong>
        <span>score {post.score}</span><span>{post.rating.toUpperCase()}</span><span>{post.fileSize ? `${(post.fileSize / 1024 / 1024).toFixed(1)} MB` : post.fileExt.toUpperCase()}</span><span>{post.imageWidth}×{post.imageHeight}</span>
        <div className="tooltip-actions">
          <div className="card-group-control"><button title="Add to favorite group" onClick={(event) => { event.stopPropagation(); setGroupMenuOpen((value) => !value); }}><FolderPlus size={14} /></button>{groupMenuOpen && <div className="card-group-menu" onClick={(event) => event.stopPropagation()}>{groups.length ? groups.map((group) => { const selected = group.postKeys.includes(`${post.source}:${post.id}`); return <button className={selected ? 'is-selected' : ''} key={group.id} onClick={() => { void toggleInGroup(group.id, post); setGroupMenuOpen(false); }}>{selected && <Check size={10} />}{group.name}</button>; }) : <span>No favorite groups</span>}</div>}</div>
          <button title="Open image viewer" onClick={(event) => { event.stopPropagation(); openViewer(post); }}><Eye size={14} /></button>
          <DownloadMenu post={post} compact />
          <button className={isLocal ? 'is-local' : ''} title={isLocal ? 'Remove from local favorites' : 'Save to local favorites'} onClick={favorite}><Heart size={14} fill={isLocal ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
      <div className="post-tooltip-tags" aria-label="Post tags">{tags.map((tag) => <span className="tooltip-tag" data-category={tag.category} key={`${tag.category}:${tag.name}`}><button className="tooltip-tag-name" onClick={add(tag.name, 'include')}>{tag.name.replaceAll('_', ' ')}</button><span className="tooltip-tag-actions"><button title={`Include ${tag.name}`} onClick={add(tag.name, 'include')}><Plus size={10} /></button><button title={`Exclude ${tag.name}`} onClick={add(tag.name, 'exclude')}><Minus size={10} /></button></span></span>)}</div>
    </div>, document.body) : null;

  return (
    <article className="post-card thumbnail-container" data-post-id={post.id} data-post-url={postUrl} data-file-url={post.fileUrl} tabIndex={0} onMouseEnter={trackDwell} onMouseMove={trackDwell} onMouseLeave={scheduleClose} onFocus={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setPoint({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); setTooltipOpen(true); }} onBlur={scheduleClose} onClick={() => openDetail(post)} onKeyDown={(event) => event.key === 'Enter' && openDetail(post)}>
      <button className={`post-select ${selected ? 'is-selected' : ''}`} title={selected ? 'Remove from batch' : 'Add to batch'} aria-label={selected ? 'Remove from batch' : 'Add to batch'} onClick={(event) => { event.stopPropagation(); toggleSelected(post); }}><Check size={13} /></button>
      {downloaded && <span className="downloaded-badge" title="Previously downloaded"><CircleCheck size={12} /> Downloaded</span>}
      {post.sampleUrl || post.previewUrl
        ? <a className="post-image-link" href={postUrl} title="Open post details" onClick={(event) => { event.preventDefault(); event.stopPropagation(); openDetail(post); }}><img src={sampleUrl || previewUrl} srcSet={previewUrl && sampleUrl ? `${previewUrl} 180w, ${sampleUrl} 850w` : undefined} sizes="(max-width: 720px) 50vw, 24vw" data-original={post.fileUrl} alt={`${post.source} post ${post.id}`} loading="lazy" /></a>
        : <div className="image-missing">No preview</div>}
      <button className={`rating-badge rating-badge--${post.rating}`} title="Open image viewer" onClick={(event) => { event.stopPropagation(); openViewer(post); }}>{post.rating}</button>
      {tooltip}
    </article>
  );
}
