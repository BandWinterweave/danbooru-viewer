import { ChevronDown, ChevronRight, Download, Heart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { displayImageUrl } from '../../services/api/image-url';
import { downloadPosts } from '../../services/download-service';
import { favoriteKey, useFavoriteStore } from '../../stores/favorite-store';
import { useUiStore } from '../../stores/ui-store';

export function FavoriteGroups() {
  const favorites = useFavoriteStore((state) => state.favorites);
  const groups = useFavoriteStore((state) => state.groups);
  const createGroup = useFavoriteStore((state) => state.createGroup);
  const deleteGroup = useFavoriteStore((state) => state.deleteGroup);
  const toggleInGroup = useFavoriteStore((state) => state.toggleInGroup);
  const openDetail = useUiStore((state) => state.openDetail);
  const [expanded, setExpanded] = useState<string | null>(null);
  return <div className="sidebar-section favorite-groups"><h2>Local favorites <span>{favorites.length}</span></h2>
    <button onClick={() => { const name = window.prompt('Group name'); if (name) void createGroup(name); }}>+ Create group</button>
    {groups.map((group) => {
      const posts = group.postKeys.map((key) => favorites.find((post) => favoriteKey(post) === key)).filter((post): post is NonNullable<typeof post> => Boolean(post));
      const open = expanded === group.id;
      return <div className="favorite-group-block" key={group.id}>
        <div className="favorite-group"><button title={`${open ? 'Collapse' : 'Expand'} ${group.name}`} onClick={() => setExpanded(open ? null : group.id)}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button><Heart size={12} />{group.name}<span>{posts.length}</span><button disabled={!posts.length} title={`Download ${group.name}`} onClick={() => void downloadPosts(posts)}><Download size={11} /></button><button title={`Delete ${group.name}`} onClick={() => void deleteGroup(group.id)}><Trash2 size={11} /></button></div>
        {open && <div className="group-posts">{posts.length ? posts.map((post) => <div key={favoriteKey(post)}><button title={`Open ${post.id}`} onClick={() => openDetail(post)}><img src={displayImageUrl(post.previewUrl)} alt="" /></button><button title={`Remove ${post.id} from ${group.name}`} onClick={() => void toggleInGroup(group.id, post)}><Trash2 size={10} /></button></div>) : <p>No images in this group</p>}</div>}
      </div>;
    })}
  </div>;
}
