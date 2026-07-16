import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleOff, ExternalLink, Heart, LoaderCircle, Minus, Plus, Send, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useFavoriteStore } from '../../stores/favorite-store';
import { useFilterStore } from '../../stores/filter-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import type { CommentRecord } from '../../types/api';
import { displayImageUrl } from '../../services/api/image-url';
import type { TagCategory, UnifiedPost } from '../../types/post';
import { DownloadMenu } from '../downloads/DownloadMenu';
import { postPageUrl } from '../../services/post-media';
import { postMessages } from '../../i18n/en-posts';
import { usePostStore } from '../../stores/post-store';
import { runAsync } from '../../services/notifications';
import { safeHttpUrl } from '../../services/safe-url';
import { usePostDetailResources, type DetailResource } from '../../hooks/usePostDetailResources';
import { resolveSourceAccess } from '../../services/booru-adapters/source-access';
import { PostDetailMedia } from './PostDetailMedia';

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
  const sourceUrl = safeHttpUrl(post.sourceUrl);
  return <section className={`post-information post-information--${post.source}`}><h3>{postMessages.detail.information} <span>{post.source}</span></h3><dl>
    <div><dt>{postMessages.detail.id}</dt><dd><a href={postPageUrl(post)} target="_blank" rel="noreferrer">{post.id}</a></dd></div>
    <div><dt>{postMessages.detail.sourceLabels[post.source]}</dt><dd>{uploaderUrl ? <a href={uploaderUrl} target="_blank" rel="noreferrer">{post.uploader}</a> : post.uploader}</dd></div>
    <div><dt>{postMessages.detail.date}</dt><dd title={new Date(post.createdAt).toLocaleString()}>{postMessages.detail.relativeDate(post.createdAt)}</dd></div>
    <div><dt>{postMessages.detail.size}</dt><dd>{post.fileSize ? `${formatBytes(post.fileSize)} · ` : ''}{post.fileExt ? `.${post.fileExt}` : postMessages.common.unknown} <span>({post.imageWidth || '?'} × {post.imageHeight || '?'})</span></dd></div>
    {sourceUrl && <div><dt>{postMessages.detail.source}</dt><dd><a href={sourceUrl} target="_blank" rel="noreferrer">{sourceUrl.replace(/^https?:\/\//, '')}</a></dd></div>}
    <div><dt>{postMessages.detail.rating}</dt><dd>{postMessages.detail.ratings[post.rating]}</dd></div>
    <div><dt>{postMessages.detail.score}</dt><dd>{post.score} {isDanbooru && <span>({postMessages.detail.voteSummary(post.upScore, post.downScore)})</span>}</dd></div>
    {isDanbooru && <div><dt>{postMessages.detail.favorites}</dt><dd>{post.favCount}</dd></div>}
    <div><dt>{postMessages.detail.status}</dt><dd className={`status-${post.status ?? 'active'}`}>{(post.status ?? 'active').replace(/^./, (letter) => letter.toUpperCase())}</dd></div>
    {post.duration !== undefined && <div><dt>{postMessages.detail.durationLabel}</dt><dd>{postMessages.detail.duration(post.duration)}</dd></div>}
  </dl></section>;
}

function ResourceFeedback({ resource }: { resource: DetailResource<unknown[]> }) {
  if (resource.status === 'loading') return <p className="detail-resource-state"><LoaderCircle className="spin" size={13} />{postMessages.detail.loadingResource}</p>;
  if (resource.status === 'error') return <p className="detail-resource-state detail-resource-state--error"><span>{resource.error}</span><button onClick={resource.retry}>{postMessages.detail.retryResource}</button></p>;
  return null;
}

export function PostDetail() {
  const open = useUiStore((state) => state.detailOpen);
  const post = useUiStore((state) => state.currentPost);
  const close = useUiStore((state) => state.closeDetail);
  const addTag = useFilterStore((state) => state.addTagFilter);
  const credential = useSettingsStore((state) => state.credentials[post?.source ?? state.activeSource]);
  const detailImageQuality = useSettingsStore((state) => state.detailImageQuality);
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
  const [submittedComments, setSubmittedComments] = useState<{ postKey: string; items: CommentRecord[] }>({ postKey: '', items: [] });
  const [commentBody, setCommentBody] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const access = post ? resolveSourceAccess(post.source, credential) : null;
  const adapter = access?.adapter ?? null;
  const authenticated = access?.authenticated ?? false;
  const resources = usePostDetailResources(open, post, adapter, credential);
  const currentPostKey = post ? `${post.source}:${post.id}` : '';
  const pendingComments = submittedComments.postKey === currentPostKey ? submittedComments.items : [];
  const comments = [...resources.comments.data, ...pendingComments.filter((item) => !resources.comments.data.some((loaded) => loaded.id === item.id))];
  const relatedTags = resources.relatedTags.data;
  const pools = resources.pools.data;
  const relations = resources.relations.data;
  const postIndex = post ? posts.findIndex((item) => item.source === post.source && item.id === post.id) : -1;
  const canPrevious = postIndex > 0;
  const canNext = postIndex >= 0 && (postIndex < posts.length - 1 || hasMore);

  useEffect(() => {
    if (!open) return;
    const rootOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open && post) runAsync('api', enrichTags(post).then((enriched) => {
      const current = useUiStore.getState().currentPost;
      if (current?.source === enriched.source && current.id === enriched.id) useUiStore.getState().setCurrentPost(enriched);
    }));
  }, [enrichTags, open, post?.id, post?.source]);

  const runAction = async (action: () => Promise<void>) => { setBusy(true); setActionError(''); try { await action(); } catch (error) { setActionError(error instanceof Error ? error.message : postMessages.detail.actionFailed); } finally { setBusy(false); } };
  const navigate = async (direction: -1 | 1) => { if (!post) return; const next = await navigateDetail(post, direction); if (next) useUiStore.getState().setCurrentPost(next); };
  const submitComment = (event: FormEvent) => { event.preventDefault(); if (!post || !adapter?.createComment || !credential || !commentBody.trim()) return; void runAction(async () => { const comment = await adapter.createComment!(post.id, commentBody.trim(), credential); setSubmittedComments((current) => ({ postKey: currentPostKey, items: current.postKey === currentPostKey ? [...current.items, comment] : [comment] })); setCommentBody(''); }); };
  if (!post) return null;

  return (
    <>
      <button className={`detail-scrim ${open ? 'is-open' : ''}`} aria-label={postMessages.detail.closeDetails} onClick={close} />
      <div className={`detail-workspace ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open}>
        <section className="detail-media-stage" aria-label={postMessages.detail.postRecord}>
          <PostDetailMedia key={`${post.source}:${post.id}:${detailImageQuality}`} post={post} quality={detailImageQuality} />
          <button className="detail-nav detail-nav--previous" disabled={!canPrevious} title="Previous post" aria-label="Previous post" onClick={() => void navigate(-1)}><ArrowLeft size={20} /></button>
          <button className="detail-nav detail-nav--next" disabled={!canNext || isLoadingMore} title="Next post" aria-label="Next post" onClick={() => void navigate(1)}><ArrowRight size={20} /></button>
        </section>
      <aside className="detail-panel">
        <div className="detail-header">
          <div><span>{postMessages.detail.postRecord}</span><h2>#{post.id}</h2></div>
          <button className="icon-button" title={postMessages.detail.closeDetails} onClick={close}><X size={18} /></button>
        </div>
        <div className="detail-actions">
          <button className={isLocal ? 'is-active' : ''} onClick={() => void runAction(() => toggleLocal(post))}><Heart size={15} fill={isLocal ? 'currentColor' : 'none'} />{isLocal ? postMessages.detail.savedLocally : postMessages.detail.saveLocally}</button>
          <button className={isRemote ? 'is-active' : ''} disabled={busy || !authenticated || !(isRemote ? access?.capabilities.removeFavorite : access?.capabilities.addFavorite)} title={!authenticated ? postMessages.detail.apiCredentialsRequired : !(isRemote ? access?.capabilities.removeFavorite : access?.capabilities.addFavorite) ? postMessages.detail.remoteFavoritesUnsupported : postMessages.detail.toggleRemoteFavorite} onClick={() => void runAction(() => toggleRemote(post, access?.credentials))}><Heart size={15} fill={isRemote ? 'currentColor' : 'none'} /> {postMessages.detail.remote}</button>
          <DownloadMenu post={post} />
          <button disabled={busy || !authenticated || !adapter?.vote} title={!authenticated ? postMessages.detail.apiCredentialsRequired : postMessages.detail.upvote} onClick={() => void runAction(() => adapter!.vote!(post.id, 1, credential!))}><ArrowUp size={15} /></button>
          <button disabled={busy || !authenticated || !adapter?.vote} title={!authenticated ? postMessages.detail.apiCredentialsRequired : postMessages.detail.downvote} onClick={() => void runAction(() => adapter!.vote!(post.id, -1, credential!))}><ArrowDown size={15} /></button>
          <button disabled={busy || !authenticated || !adapter?.unvote} title={!authenticated ? postMessages.detail.apiCredentialsRequired : postMessages.detail.removeVote} onClick={() => void runAction(() => adapter!.unvote!(post.id, credential!))}><CircleOff size={15} /></button>
          <a href={postPageUrl(post)} target="_blank" rel="noreferrer" title={postMessages.detail.openOriginalPost}><ExternalLink size={15} /></a>
        </div>
        {actionError && <p className="action-error">{actionError}</p>}
        {isLocal && groups.length > 0 && <div className="group-picker"><span>{postMessages.detail.addToGroup}</span>{groups.map((group) => { const key = `${post.source}:${post.id}`; const selected = group.postKeys.includes(key); return <button className={selected ? 'is-active' : ''} key={group.id} onClick={() => void runAction(() => toggleInGroup(group.id, post))}>{group.name}</button>; })}</div>}
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
        {(resources.relatedTags.status !== 'unavailable' || resources.pools.status !== 'unavailable' || resources.relations.status !== 'unavailable') && <div className="related-content">
          {resources.relatedTags.status !== 'unavailable' && <section><h3>{postMessages.detail.relatedTags}</h3><ResourceFeedback resource={resources.relatedTags} />{relatedTags.length > 0 && <div className="related-tags">{relatedTags.map((tag) => <button data-category={tag.category === 1 ? 'artist' : tag.category === 3 ? 'copyright' : tag.category === 4 ? 'character' : tag.category === 5 ? 'meta' : 'general'} key={tag.name} onClick={() => addTag(tag.name, 'include')}>{tag.name.replaceAll('_', ' ')}</button>)}</div>}</section>}
          {resources.pools.status !== 'unavailable' && <section><h3>{postMessages.detail.pools}</h3><ResourceFeedback resource={resources.pools} />{pools.map((pool) => <a key={pool.id} href={`https://danbooru.donmai.us/pools/${pool.id}`} target="_blank" rel="noreferrer">{pool.name.replaceAll('_', ' ')} <span>{pool.postCount}</span></a>)}</section>}
          {resources.relations.status !== 'unavailable' && <section><h3>{postMessages.detail.parentAndChildren}</h3><ResourceFeedback resource={resources.relations} />{relations.length > 0 && <div className="relation-posts">{relations.map((item) => <button key={`${item.source}:${item.id}`} title={postMessages.detail.openPost(item.id)} onClick={() => useUiStore.getState().openDetail(item)}><img src={displayImageUrl(item.previewUrl)} alt={postMessages.detail.relatedPostAlt(item.id)} /><span>#{item.id}</span></button>)}</div>}</section>}
        </div>}
        {adapter?.getComments && <section className="comments-section"><h3>{postMessages.detail.comments} <span>{comments.length}</span></h3><ResourceFeedback resource={resources.comments} />{resources.comments.status === 'success' && comments.length === 0 && <p>{postMessages.detail.noComments}</p>}{comments.map((comment) => <article key={comment.id}><header><strong>{comment.creator}</strong><time>{new Date(comment.createdAt).toLocaleDateString()}</time></header><p>{comment.body}</p></article>)}<form onSubmit={submitComment}><textarea value={commentBody} disabled={!authenticated} placeholder={authenticated ? postMessages.detail.writeComment : postMessages.detail.credentialsRequiredToComment} onChange={(event) => setCommentBody(event.target.value)} /><button title={postMessages.detail.postComment} disabled={!authenticated || !commentBody.trim() || busy}><Send size={15} /> {postMessages.detail.post}</button></form></section>}
      </aside>
      </div>
    </>
  );
}
