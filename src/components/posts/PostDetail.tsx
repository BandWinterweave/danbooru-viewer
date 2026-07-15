import { ArrowDown, ArrowUp, CircleOff, ExternalLink, Heart, Image, Minus, Plus, Send, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { getBooruAdapter } from '../../services/booru-adapters';
import { useFavoriteStore } from '../../stores/favorite-store';
import { useFilterStore } from '../../stores/filter-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useUiStore } from '../../stores/ui-store';
import type { CommentRecord, RelatedTagRecord } from '../../types/api';
import { displayImageUrl } from '../../services/api/image-url';
import type { PoolRecord, TagCategory, UnifiedPost } from '../../types/post';
import { DownloadMenu } from '../downloads/DownloadMenu';

const categories: { key: TagCategory; label: string }[] = [
  { key: 'artist', label: 'Artist' },
  { key: 'character', label: 'Characters' },
  { key: 'copyright', label: 'Copyright' },
  { key: 'general', label: 'General' },
  { key: 'meta', label: 'Meta' },
];

function formatBytes(bytes: number) {
  if (!bytes) return 'Unknown';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PostDetail() {
  const open = useUiStore((state) => state.detailOpen);
  const post = useUiStore((state) => state.currentPost);
  const close = useUiStore((state) => state.closeDetail);
  const openViewer = useUiStore((state) => state.openViewer);
  const addTag = useFilterStore((state) => state.addTagFilter);
  const credential = useSettingsStore((state) => state.credentials[post?.source ?? state.activeSource]);
  const isLocal = useFavoriteStore((state) => post ? state.isLocal(post) : false);
  const toggleLocal = useFavoriteStore((state) => state.toggleLocal);
  const toggleRemote = useFavoriteStore((state) => state.toggleRemote);
  const isRemote = useFavoriteStore((state) => post ? state.isRemote(post) : false);
  const groups = useFavoriteStore((state) => state.groups);
  const toggleInGroup = useFavoriteStore((state) => state.toggleInGroup);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [relatedTags, setRelatedTags] = useState<RelatedTagRecord[]>([]);
  const [pools, setPools] = useState<PoolRecord[]>([]);
  const [relations, setRelations] = useState<UnifiedPost[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const adapter = post ? getBooruAdapter(post.source) : null;
  const authenticated = Boolean(credential?.username && credential.apiKey);

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

  const runAction = async (action: () => Promise<void>) => { setBusy(true); setActionError(''); try { await action(); } catch (error) { setActionError(error instanceof Error ? error.message : 'Action failed'); } finally { setBusy(false); } };
  const submitComment = (event: FormEvent) => { event.preventDefault(); if (!post || !adapter?.createComment || !credential || !commentBody.trim()) return; void runAction(async () => { const comment = await adapter.createComment!(post.id, commentBody.trim(), credential); setComments((items) => [...items, comment]); setCommentBody(''); }); };
  if (!post) return null;

  return (
    <>
      <button className={`detail-scrim ${open ? 'is-open' : ''}`} aria-label="Close details" onClick={close} />
      <aside className={`detail-panel ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="detail-header">
          <div><span>POST RECORD</span><h2>#{post.id}</h2></div>
          <button className="icon-button" title="Close details" onClick={close}><X size={18} /></button>
        </div>
         <button className="detail-image" onClick={() => openViewer(post)} title="Open image viewer">
           <img src={displayImageUrl(post.sampleUrl || post.previewUrl)} alt={`${post.source} post ${post.id}`} />
           <span><Image size={14} /> Open viewer</span>
         </button>
        <div className="detail-actions">
          <button className={isLocal ? 'is-active' : ''} onClick={() => void toggleLocal(post)}><Heart size={15} fill={isLocal ? 'currentColor' : 'none'} />{isLocal ? 'Saved locally' : 'Save locally'}</button>
          <button className={isRemote ? 'is-active' : ''} disabled={busy || !authenticated || !adapter?.addFavorite} title={!authenticated ? 'API credentials required' : !adapter?.addFavorite ? 'Remote favorites are not supported by this source' : 'Toggle remote favorite'} onClick={() => void runAction(() => toggleRemote(post))}><Heart size={15} fill={isRemote ? 'currentColor' : 'none'} /> Remote</button>
          <DownloadMenu post={post} />
          <button disabled={busy || !authenticated || !adapter?.vote} title={!authenticated ? 'API credentials required' : 'Upvote'} onClick={() => void runAction(() => adapter!.vote!(post.id, 1, credential!))}><ArrowUp size={15} /></button>
          <button disabled={busy || !authenticated || !adapter?.vote} title={!authenticated ? 'API credentials required' : 'Downvote'} onClick={() => void runAction(() => adapter!.vote!(post.id, -1, credential!))}><ArrowDown size={15} /></button>
          <button disabled={busy || !authenticated || !adapter?.unvote} title={!authenticated ? 'API credentials required' : 'Remove vote'} onClick={() => void runAction(() => adapter!.unvote!(post.id, credential!))}><CircleOff size={15} /></button>
          <a href={post.fileUrl || post.sampleUrl} target="_blank" rel="noreferrer" title="Open original"><ExternalLink size={15} /></a>
        </div>
        {actionError && <p className="action-error">{actionError}</p>}
        {isLocal && groups.length > 0 && <div className="group-picker"><span>Add to group</span>{groups.map((group) => { const key = `${post.source}:${post.id}`; const selected = group.postKeys.includes(key); return <button className={selected ? 'is-active' : ''} key={group.id} onClick={() => void toggleInGroup(group.id, post)}>{group.name}</button>; })}</div>}
        <div className="detail-stats">
          <div><span>Score</span><strong>{post.score}</strong></div>
          <div><span>Favorites</span><strong><Heart size={14} /> {post.favCount}</strong></div>
          <div><span>Rating</span><strong>{post.rating.toUpperCase()}</strong></div>
          <div><span>Dimensions</span><strong>{post.imageWidth} × {post.imageHeight}</strong></div>
          <div><span>Format</span><strong>{post.fileExt.toUpperCase()} · {formatBytes(post.fileSize)}</strong></div>
          <div><span>Uploaded</span><strong>{new Date(post.createdAt).toLocaleDateString()}</strong></div>
        </div>
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
                    <button title={`Include ${tag.name}`} onClick={() => addTag(tag.name, 'include')}><Plus size={12} /></button>
                    <button title={`Exclude ${tag.name}`} onClick={() => addTag(tag.name, 'exclude')}><Minus size={12} /></button>
                  </span>
                ))}</div>
              </section>
            );
          })}
        </div>
        {(relatedTags.length > 0 || pools.length > 0 || relations.length > 0) && <div className="related-content">
          {relatedTags.length > 0 && <section><h3>Related tags</h3><div className="related-tags">{relatedTags.map((tag) => <button key={tag.name} onClick={() => addTag(tag.name, 'include')}>{tag.name.replaceAll('_', ' ')}</button>)}</div></section>}
          {pools.length > 0 && <section><h3>Pools</h3>{pools.map((pool) => <a key={pool.id} href={`https://danbooru.donmai.us/pools/${pool.id}`} target="_blank" rel="noreferrer">{pool.name.replaceAll('_', ' ')} <span>{pool.postCount}</span></a>)}</section>}
          {relations.length > 0 && <section><h3>Parent and children</h3><div className="relation-posts">{relations.map((item) => <button key={item.id} title={`Open post ${item.id}`} onClick={() => useUiStore.getState().openDetail(item)}><img src={displayImageUrl(item.previewUrl)} alt={`Related post ${item.id}`} /><span>#{item.id}</span></button>)}</div></section>}
        </div>}
        {adapter?.getComments && <section className="comments-section"><h3>Comments <span>{comments.length}</span></h3>{comments.length === 0 && <p>No comments yet.</p>}{comments.map((comment) => <article key={comment.id}><header><strong>{comment.creator}</strong><time>{new Date(comment.createdAt).toLocaleDateString()}</time></header><p>{comment.body}</p></article>)}<form onSubmit={submitComment}><textarea value={commentBody} disabled={!authenticated} placeholder={authenticated ? 'Write a comment' : 'API credentials required to comment'} onChange={(event) => setCommentBody(event.target.value)} /><button title="Post comment" disabled={!authenticated || !commentBody.trim() || busy}><Send size={15} /> Post</button></form></section>}
      </aside>
    </>
  );
}
