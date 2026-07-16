import { Check, CircleCheck, ClipboardCheck, Copy, FolderPlus, Heart, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFilterStore } from '../../stores/filter-store';
import { useUiStore } from '../../stores/ui-store';
import { useFavoriteStore } from '../../stores/favorite-store';
import type { UnifiedPost } from '../../types/post';
import { hasDownloaded } from '../../services/download-service';
import { DownloadMenu } from '../downloads/DownloadMenu';
import { usePostStore } from '../../stores/post-store';
import { useSettingsStore } from '../../stores/settings-store';
import { postPageUrl } from '../../services/post-media';
import { MediaPreview } from './MediaPreview';
import { formatTagsForCopy } from '../../services/tag-copy';
import { postMessages } from '../../i18n/en-posts';

function orderedTags(post: UnifiedPost) {
  const order = { artist: 0, character: 1, copyright: 2, general: 3, meta: 4 };
  return [...post.tags].sort((left, right) => order[left.category] - order[right.category]);
}

export function PostCard({ post }: { post: UnifiedPost }) {
  const openDetail = useUiStore((state) => state.openDetail);
  const addTag = useFilterStore((state) => state.addTagFilter);
  const isLocal = useFavoriteStore((state) => state.isLocal(post));
  const toggleLocal = useFavoriteStore((state) => state.toggleLocal);
  const groups = useFavoriteStore((state) => state.groups);
  const toggleInGroup = useFavoriteStore((state) => state.toggleInGroup);
  const selected = usePostStore((state) => state.selectedPostKeys.includes(`${post.source}:${post.id}`));
  const toggleSelected = usePostStore((state) => state.toggleSelected);
  const enrichTags = usePostStore((state) => state.enrichTags);
  const layout = useSettingsStore((state) => state.layout);
  const copyTagCategories = useSettingsStore((state) => state.copyTagCategories);
  const copyTagsUseUnderscores = useSettingsStore((state) => state.copyTagsUseUnderscores);
  const copyTagsEscapeParentheses = useSettingsStore((state) => state.copyTagsEscapeParentheses);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const closeTimer = useRef<number>();
  const dwellTimer = useRef<number>();
  const cursorPoint = useRef({ x: 0, y: 0 });
  const tags = orderedTags(post);
  const queryTag = tags.find((tag) => tag.category === 'artist') ?? tags.find((tag) => tag.category === 'character') ?? tags[0];
  const postUrl = `${postPageUrl(post)}${post.source === 'danbooru' && queryTag ? `?q=${encodeURIComponent(queryTag.name)}` : ''}`;
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
    dwellTimer.current = window.setTimeout(() => { setPoint(cursorPoint.current); setTooltipOpen(true); void enrichTags(post); }, 700);
  };
  const copyTags = (event: React.MouseEvent) => {
    event.stopPropagation();
    const text = formatTagsForCopy(post, { categories: copyTagCategories, useUnderscores: copyTagsUseUnderscores, escapeParentheses: copyTagsEscapeParentheses });
    if (!text) return;
    void navigator.clipboard.writeText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200); }).catch(() => undefined);
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
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="post-tooltip-header">
        <strong>{post.source} #{post.id}</strong>
        <span>{postMessages.card.score} {post.score}</span><span>{post.rating.toUpperCase()}</span><span>{post.fileSize ? `${(post.fileSize / 1024 / 1024).toFixed(1)} MB` : post.fileExt.toUpperCase()}</span><span>{post.imageWidth}×{post.imageHeight}</span>
        <div className="tooltip-actions">
          <div className="card-group-control"><button title={postMessages.card.addToFavoriteGroup} onClick={(event) => { event.stopPropagation(); setGroupMenuOpen((value) => !value); }}><FolderPlus size={14} /></button>{groupMenuOpen && <div className="card-group-menu" onClick={(event) => event.stopPropagation()}>{groups.length ? groups.map((group) => { const selected = group.postKeys.includes(`${post.source}:${post.id}`); return <button className={selected ? 'is-selected' : ''} key={group.id} onClick={() => { void toggleInGroup(group.id, post); setGroupMenuOpen(false); }}>{selected && <Check size={10} />}{group.name}</button>; }) : <span>{postMessages.card.noFavoriteGroups}</span>}</div>}</div>
          <DownloadMenu post={post} compact />
          <button className={isLocal ? 'is-local' : ''} title={isLocal ? postMessages.card.removeFromLocalFavorites : postMessages.card.saveToLocalFavorites} onClick={favorite}><Heart size={14} fill={isLocal ? 'currentColor' : 'none'} /></button>
        </div>
      </div>
      <div className="post-tooltip-tags" aria-label={postMessages.card.postTags}>{tags.map((tag) => <span className="tooltip-tag" data-category={tag.category} key={`${tag.category}:${tag.name}`}><button className="tooltip-tag-name" onClick={add(tag.name, 'include')}>{tag.name.replaceAll('_', ' ')}</button><span className="tooltip-tag-actions"><button title={postMessages.common.includeTag(tag.name)} onClick={add(tag.name, 'include')}><Plus size={10} /></button><button title={postMessages.common.excludeTag(tag.name)} onClick={add(tag.name, 'exclude')}><Minus size={10} /></button></span></span>)}</div>
    </div>, document.body) : null;

  return (
    <article className={`post-card thumbnail-container ${layout === 'list' ? 'post-card--list' : ''}`} data-post-id={post.id} data-post-url={postUrl} data-file-url={post.fileUrl} tabIndex={0} onMouseEnter={trackDwell} onMouseMove={trackDwell} onMouseLeave={scheduleClose} onClick={() => openDetail(post)} onKeyDown={(event) => event.key === 'Enter' && openDetail(post)}>
      <button className={`post-select ${selected ? 'is-selected' : ''}`} title={selected ? postMessages.card.removeFromBatch : postMessages.card.addToBatch} aria-label={selected ? postMessages.card.removeFromBatch : postMessages.card.addToBatch} onClick={(event) => { event.stopPropagation(); toggleSelected(post); }}><Check size={13} /></button>
      <button className={`post-copy ${copied ? 'is-copied' : ''}`} title={copied ? postMessages.card.tagsCopied : postMessages.card.copyFormattedTags} aria-label={copied ? postMessages.card.tagsCopied : postMessages.card.copyFormattedTags} onClick={copyTags}>{copied ? <ClipboardCheck size={13} /> : <Copy size={13} />}</button>
      {downloaded && <span className="downloaded-badge" title={postMessages.card.previouslyDownloaded}><CircleCheck size={12} /> {postMessages.card.downloaded}</span>}
      <a className="post-image-link" href={postUrl} aria-label={postMessages.card.openPostDetails} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openDetail(post); }}><MediaPreview post={post} /></a>
      {layout === 'list' && <div className="list-card-info"><div><span>{post.source}</span><strong>#{post.id}</strong><span className={`list-rating rating-${post.rating}`}>{post.rating.toUpperCase()}</span></div><p>{tags.slice(0, 8).map((tag) => <span data-category={tag.category} key={tag.name}>{tag.name.replaceAll('_', ' ')}</span>) || postMessages.card.noTagsAvailable}</p><dl><div><dt>{postMessages.card.scoreLabel}</dt><dd>{post.score}</dd></div><div><dt>{postMessages.card.favorites}</dt><dd>{post.favCount}</dd></div><div><dt>{postMessages.card.dimensions}</dt><dd>{post.imageWidth || '?'} × {post.imageHeight || '?'}</dd></div><div><dt>{postMessages.card.format}</dt><dd>{post.fileExt.toUpperCase() || postMessages.common.unknown}</dd></div><div><dt>{postMessages.card.uploader}</dt><dd>{post.uploader}</dd></div><div><dt>{postMessages.card.status}</dt><dd>{post.status ?? 'active'}</dd></div></dl></div>}
      <button className={`rating-badge rating-badge--${post.rating}`}>{post.rating}</button>
      {tooltip}
    </article>
  );
}
