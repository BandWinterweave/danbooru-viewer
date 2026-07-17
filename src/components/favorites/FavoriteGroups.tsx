import { ChevronDown, ChevronRight, Download, Heart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n/runtime';
import { displayImageUrl } from '../../services/api/image-url';
import { downloadPosts } from '../../services/download-service';
import { favoriteKey, useFavoriteStore } from '../../stores/favorite-store';
import { useUiStore } from '../../stores/ui-store';
import { CachedImage } from '../posts/CachedImage';
import { runAsync } from '../../services/notifications';

export function FavoriteGroups() {
  const { messages: { domainActions: actionMessages } } = useI18n();
  const favorites = useFavoriteStore((state) => state.favorites);
  const groups = useFavoriteStore((state) => state.groups);
  const createGroup = useFavoriteStore((state) => state.createGroup);
  const deleteGroup = useFavoriteStore((state) => state.deleteGroup);
  const toggleInGroup = useFavoriteStore((state) => state.toggleInGroup);
  const openDetail = useUiStore((state) => state.openDetail);
  const [expanded, setExpanded] = useState<string | null>(null);
  return <div className="sidebar-section favorite-groups"><h2>{actionMessages.favorites.title} <span>{favorites.length}</span></h2>
    <button onClick={() => { const name = window.prompt(actionMessages.favorites.groupNamePrompt); if (name) runAsync('storage', createGroup(name)); }}>{actionMessages.favorites.createGroup}</button>
    {groups.map((group) => {
      const posts = group.postKeys.map((key) => favorites.find((post) => favoriteKey(post) === key)).filter((post): post is NonNullable<typeof post> => Boolean(post));
      const open = expanded === group.id;
      return <div className="favorite-group-block" key={group.id}>
        <div className="favorite-group"><button title={actionMessages.favorites.toggleGroup(open, group.name)} onClick={() => setExpanded(open ? null : group.id)}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button><Heart size={12} />{group.name}<span>{posts.length}</span><button disabled={!posts.length} title={actionMessages.favorites.downloadGroup(group.name)} onClick={() => runAsync('download', downloadPosts(posts))}><Download size={11} /></button><button title={actionMessages.favorites.deleteGroup(group.name)} onClick={() => { if (window.confirm(actionMessages.favorites.confirmDeleteGroup(group.name))) runAsync('storage', deleteGroup(group.id)); }}><Trash2 size={11} /></button></div>
        {open && <div className="group-posts">{posts.length ? posts.map((post) => <div key={favoriteKey(post)}><button title={actionMessages.favorites.openPost(post.id)} onClick={() => openDetail(post, 'favorites')}><CachedImage src={displayImageUrl(post.previewUrl)} alt="" /></button><button title={actionMessages.favorites.removePostFromGroup(post.id, group.name)} onClick={() => runAsync('storage', toggleInGroup(group.id, post))}><Trash2 size={10} /></button></div>) : <p>{actionMessages.favorites.emptyGroup}</p>}</div>}
      </div>;
    })}
  </div>;
}
