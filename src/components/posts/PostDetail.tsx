import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleOff, ExternalLink, Heart, Minus, Plus, Send, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { getBooruAdapter } from '../../services/booru-adapters';
import { useFavoriteStore } from '../../stores/favorite-store';
import { useFilterStore } from '../../stores/filter-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import type { CommentRecord, RelatedTagRecord } from '../../types/api';
import { displayImageUrl } from '../../services/api/image-url';
import type { PoolRecord, TagCategory, UnifiedPost } from '../../types/post';
import { DownloadMenu } from '../downloads/DownloadMenu';
import { isVideoPost, postPageUrl } from '../../services/post-media';
import { MediaPreview } from './MediaPreview';
import { postMessages } from '../../i18n/en-posts';
import { usePostStore } from '../../stores/post-store';

const categories: { key: TagCategory; label: string }[] = [
  { key: 'artist', label: postMessages.detail.categories.artist },
  { key: 'character', label: postMessages.detail.categories.character },
  { key: 'copyright', label: postMessages.detail.categories.copyright },
  { key: 'general', label: postMessages.detail.categories.general },
  { key: 'meta', label: postMessages.detail.categories.meta },
];

function formatBytes(bytes: number) {
  if (!bytes) return postMessages.common.unknown;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function PostInformation({ post }: { post: UnifiedPost }) {
  const isDanbooru = post.source === 'danbooru';
  const uploaderUrl = post.source === 'danbooru' && post.uploaderId ? `https://danbooru.donmai.us/users/${post.uploaderId}` : undefined;
  return <section className={`post-information post-information--${post.source}`}><h3>{postMessages.detail.information} <span>{post.source}</span></h3><dl>
    <div><dt>{postMessages.detail.id}</dt><dd><a href={postPageUrl(post)} target="_blank" rel="noreferrer">{post.id}</a></dd></div>
    <div><dt>{postMessages.detail.sourceLabels[post.source]}</dt><dd>{uploaderUrl ? <a href={uploaderUrl} target="_blank" rel="noreferrer">{post.uploader}</a> : post.uploader}</dd></div>
    <div><dt>{postMessages.detail.date}</dt><dd title={new Date(post.createdAt).toLocaleString()}>{postMessages.detail.relativeDate(post.createdAt)}</dd></div>
    <div><dt>{postMessages.detail.size}</dt><dd>{post.fileSize ? `${formatBytes(post.fileSize)} · ` : ''}{post.fileExt ? `.${post.fileExt}` : postMessages.common.unknown} <span>({post.imageWidth || '?'} × {post.imageHeight || '?'})</span></dd></div>
    {post.sourceUrl && <div><dt>{postMessages.detail.source}</dt><dd><a href={post.sourceUrl} target="_blank" rel="noreferrer">{post.sourceUrl.replace(/^https?:\/\//, '')}</a></dd></div>}
    <div><dt>{postMessages.detail.rating}</dt><dd>{postMessages.detail.ratings[post.rating]}</dd></div>
    <div><dt>{postMessages.detail.score}</dt><dd>{post.score} {isDanbooru && <span>({postMessages.detail.voteSummary(post.upScore, post.downScore)})</span>}</dd></div>
    {isDanbooru && <div><dt>{postMessages.detail.favorites}</dt><dd>{post.favCount}</dd></div>}
    <div><dt>{postMessages.detail.status}</dt><dd className={`status-${post.status ?? 'active'}`}>{(post.status ?? 'active').replace(/^./, (letter) => letter.toUpperCase())}</dd></div>
    {post.duration !== undefined && <div><dt>{postMessages.detail.durationLabel}</dt><dd>{postMessages.detail.duration(post.duration)}</dd></div>}
  </dl></section>;
}

function ZoomableMedia({ post }: { post: UnifiedPost }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const dragging = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });
  const source = post.fileUrl || post.sampleUrl || post.previewUrl;

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setFailed(false);
  }, [post.source, post.id]);

  if (isVideoPost(post) || !source || failed) return <MediaPreview key={`${post.source}:${post.id}`} post={post} eager />;

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };
  const zoom = (event: React.WheelEvent) => {
    event.preventDefault();
    setScale((current) => Math.min(8, Math.max(1, current * Math.exp(-event.deltaY * .0015))));
  };
  const startDrag = (event: React.PointerEvent) => {
    if (scale <= 1) return;
    dragging.current = true;
    lastPoint.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const drag = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = event.clientX - lastPoint.current.x;
    const dy = event.clientY - lastPoint.current.y;
    lastPoint.current = { x: event.clientX, y: event.clientY };
    setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
  };
  const endDrag = () => { dragging.current = false; };

  return (
    <div className="detail-media-zoom" onWheel={zoom} onDoubleClick={reset} onPointerDown={startDrag} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <img src={displayImageUrl(source)} alt={postMessages.common.postAlt(post.source, post.id)} draggable={false} onError={() => setFailed(true)} style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }} />
    </div>
  );
}

export function PostDetail() {
  const open = useUiStore((state) => state.detailOpen);
  const post = useUiStore((state) => state.currentPost);
  const close = useUiStore((state) => state.closeDetail);
  const addTag = useFilterStore((state) => state.addTagFilter);
  const credential = useSettingsStore((state) => state.credentials[post?.source ?? state.activeSource]);
  const isLocal = useFavoriteStore((state) => post ? state.isLocal(post) : false);
  const toggleLocal = useFavoriteStore((state) => state.toggleLocal);
  const toggleRemote = useFavoriteStore((state) => state.toggleRemote);
  const isRemote = useFavoriteStore((state) => post ? state.isRemote(post) : false);
  const groups = useFavoriteStore((state) => state.groups);
  const toggleInGroup = useFavoriteStore((state) => state.toggleInGroup);
  const enrichTags = usePostStore((state) => state.enrichTags);
  const posts = usePostStore((state) => state.posts);
  const hasMore = usePostStore((state) => state.hasMore);
  const isLoadingMore = usePostStore((state) => state.isLoadingMore);
  const navigateDetail = usePostStore((state) => state.navigateDetail);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [relatedTags, setRelatedTags] = useState<RelatedTagRecord[]>([]);
  const [pools, setPools] = useState<PoolRecord[]>([]);
  const [relations, setRelations] = useState<UnifiedPost[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const adapter = post ? getBooruAdapter(post.source) : null;
  const authenticated = Boolean(credential?.username && credential.apiKey);
  const postIndex = post ? posts.findIndex((item) => item.source === post.source && item.id === post.id) : -1;
  const canPrevious = postIndex > 0;
  const canNext = postIndex >= 0 && (postIndex < posts.length - 1 || hasMore);

  useEffect(() => {
    if (open && post) void enrichTags(post);
  }, [enrichTags, open, post?.id, post?.source]);

  useEffect(() => {
    if (!open || !post || !adapter?.getComments) { setComments([]); return; }
    let cancelled = false;
    adapter.getComments(post.id, credential).then((items) => { if (!cancelled) setComments(items); }).catch(() => { if (!cancelled) setComments([]); });
    return () => { cancelled = true; };
  }, [adapter, credential, open, post]);

  useEffect(() => {
    if (!open || !post || !adapter) { setRelatedTags([]); setPools([]); setRelations([]); return; }
    let cancelled = false;
    const leadTag = post.tags.find((tag) => tag.category === 'artist')?.name ?? post.tags.find((tag) => tag.category === 'general')?.name;
    const requests: Promise<void>[] = [];
    if (leadTag && adapter.getRelatedTags) requests.push(adapter.getRelatedTags(leadTag, credential).then((items) => { if (!cancelled) setRelatedTags(items); })); else setRelatedTags([]);
    if (post.poolIds?.length && adapter.getPools) requests.push(adapter.getPools(post.poolIds, credential).then((items) => { if (!cancelled) setPools(items); })); else setPools([]);
    const relationRequests: Promise<UnifiedPost | UnifiedPost[]>[] = [];
    if (post.parentId) relationRequests.push(adapter.getPost(post.parentId, credential));
    if (post.hasChildren && adapter.getChildren) relationRequests.push(adapter.getChildren(post.id, credential));
    if (relationRequests.length) requests.push(Promise.all(relationRequests).then((items) => { if (!cancelled) setRelations(items.flat()); })); else setRelations([]);
    Promise.all(requests).catch(() => { if (!cancelled) { setRelatedTags([]); setPools([]); setRelations([]); } });
    return () => { cancelled = true; };
  }, [adapter, credential, open, post]);

  const runAction = async (action: () => Promise<void>) => { setBusy(true); setActionError(''); try { await action(); } catch (error) { setActionError(error instanceof Error ? error.message : postMessages.detail.actionFailed); } finally { setBusy(false); } };
  const submitComment = (event: FormEvent) => { event.preventDefault(); if (!post || !adapter?.createComment || !credential || !commentBody.trim()) return; void runAction(async () => { const comment = await adapter.createComment!(post.id, commentBody.trim(), credential); setComments((items) => [...items, comment]); setCommentBody(''); }); };
  if (!post) return null;

  return (
    <>
      <button className={`detail-scrim ${open ? 'is-open' : ''}`} aria-label={postMessages.detail.closeDetails} onClick={close} />
      <div className={`detail-workspace ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        <section className="detail-media-stage" aria-label={postMessages.detail.postRecord}>
          <ZoomableMedia post={post} />
          <button className="detail-nav detail-nav--previous" disabled={!canPrevious} title="Previous post" aria-label="Previous post" onClick={() => void navigateDetail(-1)}><ArrowLeft size={20} /></button>
          <button className="detail-nav detail-nav--next" disabled={!canNext || isLoadingMore} title="Next post" aria-label="Next post" onClick={() => void navigateDetail(1)}><ArrowRight size={20} /></button>
        </section>
      <aside className="detail-panel">
        <div className="detail-header">
          <div><span>{postMessages.detail.postRecord}</span><h2>#{post.id}</h2></div>
          <button className="icon-button" title={postMessages.detail.closeDetails} onClick={close}><X size={18} /></button>
        </div>
        <div className="detail-actions">
          <button className={isLocal ? 'is-active' : ''} onClick={() => void toggleLocal(post)}><Heart size={15} fill={isLocal ? 'currentColor' : 'none'} />{isLocal ? postMessages.detail.savedLocally : postMessages.detail.saveLocally}</button>
          <button className={isRemote ? 'is-active' : ''} disabled={busy || !authenticated || !adapter?.addFavorite} title={!authenticated ? postMessages.detail.apiCredentialsRequired : !adapter?.addFavorite ? postMessages.detail.remoteFavoritesUnsupported : postMessages.detail.toggleRemoteFavorite} onClick={() => void runAction(() => toggleRemote(post))}><Heart size={15} fill={isRemote ? 'currentColor' : 'none'} /> {postMessages.detail.remote}</button>
          <DownloadMenu post={post} />
          <button disabled={busy || !authenticated || !adapter?.vote} title={!authenticated ? postMessages.detail.apiCredentialsRequired : postMessages.detail.upvote} onClick={() => void runAction(() => adapter!.vote!(post.id, 1, credential!))}><ArrowUp size={15} /></button>
          <button disabled={busy || !authenticated || !adapter?.vote} title={!authenticated ? postMessages.detail.apiCredentialsRequired : postMessages.detail.downvote} onClick={() => void runAction(() => adapter!.vote!(post.id, -1, credential!))}><ArrowDown size={15} /></button>
          <button disabled={busy || !authenticated || !adapter?.unvote} title={!authenticated ? postMessages.detail.apiCredentialsRequired : postMessages.detail.removeVote} onClick={() => void runAction(() => adapter!.unvote!(post.id, credential!))}><CircleOff size={15} /></button>
          <a href={postPageUrl(post)} target="_blank" rel="noreferrer" title={postMessages.detail.openOriginalPost}><ExternalLink size={15} /></a>
        </div>
        {actionError && <p className="action-error">{actionError}</p>}
        {isLocal && groups.length > 0 && <div className="group-picker"><span>{postMessages.detail.addToGroup}</span>{groups.map((group) => { const key = `${post.source}:${post.id}`; const selected = group.postKeys.includes(key); return <button className={selected ? 'is-active' : ''} key={group.id} onClick={() => void toggleInGroup(group.id, post)}>{group.name}</button>; })}</div>}
        <div className="detail-stats">
          <div><span>{postMessages.detail.score}</span><strong>{post.score}</strong></div>
          <div><span>{post.source === 'danbooru' ? postMessages.detail.favorites : post.source === 'yandere' ? postMessages.detail.author : postMessages.detail.owner}</span><strong>{post.source === 'danbooru' && <Heart size={14} />}{post.source === 'danbooru' ? post.favCount : post.uploader}</strong></div>
          <div><span>{postMessages.detail.rating}</span><strong>{post.rating.toUpperCase()}</strong></div>
          <div><span>{postMessages.detail.dimensions}</span><strong>{post.imageWidth} × {post.imageHeight}</strong></div>
          <div><span>{postMessages.detail.format}</span><strong>{post.fileExt.toUpperCase()} · {formatBytes(post.fileSize)}</strong></div>
          <div><span>{postMessages.detail.uploaded}</span><strong>{new Date(post.createdAt).toLocaleDateString()}</strong></div>
        </div>
        <PostInformation post={post} />
        <div className="tag-groups">
          {categories.map(({ key, label }) => {
            const tags = post.tags.filter((tag) => tag.category === key);
            if (!tags.length) return null;
            return (
              <section className={`tag-group tag-group--${key}`} key={key}>
                <h3>{label}<span>{tags.length}</span></h3>
                <div>{tags.map((tag) => (
                  <span className="detail-tag" key={tag.name}>
                    <button className="tag-name" onClick={() => addTag(tag.name, 'include')}>{tag.name.replaceAll('_', ' ')}</button>
                    <button title={postMessages.common.includeTag(tag.name)} onClick={() => addTag(tag.name, 'include')}><Plus size={12} /></button>
                    <button title={postMessages.common.excludeTag(tag.name)} onClick={() => addTag(tag.name, 'exclude')}><Minus size={12} /></button>
                  </span>
                ))}</div>
              </section>
            );
          })}
        </div>
        {(relatedTags.length > 0 || pools.length > 0 || relations.length > 0) && <div className="related-content">
          {relatedTags.length > 0 && <section><h3>{postMessages.detail.relatedTags}</h3><div className="related-tags">{relatedTags.map((tag) => <button data-category={tag.category === 1 ? 'artist' : tag.category === 3 ? 'copyright' : tag.category === 4 ? 'character' : tag.category === 5 ? 'meta' : 'general'} key={tag.name} onClick={() => addTag(tag.name, 'include')}>{tag.name.replaceAll('_', ' ')}</button>)}</div></section>}
          {pools.length > 0 && <section><h3>{postMessages.detail.pools}</h3>{pools.map((pool) => <a key={pool.id} href={`https://danbooru.donmai.us/pools/${pool.id}`} target="_blank" rel="noreferrer">{pool.name.replaceAll('_', ' ')} <span>{pool.postCount}</span></a>)}</section>}
          {relations.length > 0 && <section><h3>{postMessages.detail.parentAndChildren}</h3><div className="relation-posts">{relations.map((item) => <button key={item.id} title={postMessages.detail.openPost(item.id)} onClick={() => useUiStore.getState().openDetail(item)}><img src={displayImageUrl(item.previewUrl)} alt={postMessages.detail.relatedPostAlt(item.id)} /><span>#{item.id}</span></button>)}</div></section>}
        </div>}
        {adapter?.getComments && <section className="comments-section"><h3>{postMessages.detail.comments} <span>{comments.length}</span></h3>{comments.length === 0 && <p>{postMessages.detail.noComments}</p>}{comments.map((comment) => <article key={comment.id}><header><strong>{comment.creator}</strong><time>{new Date(comment.createdAt).toLocaleDateString()}</time></header><p>{comment.body}</p></article>)}<form onSubmit={submitComment}><textarea value={commentBody} disabled={!authenticated} placeholder={authenticated ? postMessages.detail.writeComment : postMessages.detail.credentialsRequiredToComment} onChange={(event) => setCommentBody(event.target.value)} /><button title={postMessages.detail.postComment} disabled={!authenticated || !commentBody.trim() || busy}><Send size={15} /> {postMessages.detail.post}</button></form></section>}
      </aside>
      </div>
    </>
  );
}
