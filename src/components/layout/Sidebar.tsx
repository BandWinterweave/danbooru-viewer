import { Clock3, Compass, Download, Grid3X3, PanelLeftClose, Plus, Trash2, Upload, X } from 'lucide-react';
import { useFilterStore } from '../../stores/filter-store';
import { usePostStore } from '../../stores/post-store';
import { useUiStore } from '../../stores/ui-store';
import { useFavoriteStore } from '../../stores/favorite-store';
import { useSettingsStore } from '../../stores/settings-store';
import { FormEvent, useRef, useState } from 'react';
import { displayImageUrl } from '../../services/api/image-url';
import { FavoriteGroups } from '../favorites/FavoriteGroups';
import { CachedImage } from '../posts/CachedImage';
import { shellMessages } from '../../i18n/en-shell';
import { actionMessages } from '../../i18n/en-actions';
import { notify } from '../../services/notifications';

export function Sidebar() {
  const open = useUiStore((state) => state.sidebarOpen);
  const toggle = useUiStore((state) => state.toggleSidebar);
  const postCount = usePostStore((state) => state.posts.length);
  const addTag = useFilterStore((state) => state.addTagFilter);
  const setMeta = useFilterStore((state) => state.setMetaFilter);
  const presets = useFilterStore((state) => state.presets);
  const loadPreset = useFilterStore((state) => state.loadPreset);
  const deletePreset = useFilterStore((state) => state.deletePreset);
  const source = useSettingsStore((state) => state.activeSource);
  const quickTags = useSettingsStore((state) => state.quickTags);
  const addQuickTag = useSettingsStore((state) => state.addQuickTag);
  const removeQuickTag = useSettingsStore((state) => state.removeQuickTag);
  const favorites = useFavoriteStore((state) => state.favorites);
  const exportJson = useFavoriteStore((state) => state.exportJson);
  const importJson = useFavoriteStore((state) => state.importJson);
  const openDetail = useUiStore((state) => state.openDetail);
  const fileRef = useRef<HTMLInputElement>(null);
  const [quickTag, setQuickTag] = useState('');
  const submitQuickTag = (event: FormEvent) => { event.preventDefault(); addQuickTag(quickTag); setQuickTag(''); };
  const importFavorites = async (file: File) => {
    try {
      await importJson(file);
      notify({ tone: 'success', title: actionMessages.favorites.importComplete });
    } catch (error) {
      notify({ tone: 'error', title: actionMessages.favorites.importFailed, description: error instanceof Error ? error.message : undefined });
    }
  };
  if (!open) return null;
  return (
    <aside className="sidebar">
      <div className="sidebar-heading"><span>{shellMessages.sidebar.browse}</span><button title={shellMessages.sidebar.collapse} onClick={toggle}><PanelLeftClose size={16} /></button></div>
      <nav className="side-nav">
        <button className="is-current"><Compass size={16} /> {shellMessages.sidebar.discover} <span>{postCount || '—'}</span></button>
        <button onClick={() => setMeta({ order: 'score' })}><Grid3X3 size={16} /> {shellMessages.sidebar.topScored}</button>
        <button onClick={() => setMeta({ order: 'rank' })}><Clock3 size={16} /> {shellMessages.sidebar.trending}</button>
      </nav>
      <div className="sidebar-section">
        <h2>{shellMessages.sidebar.quickTags}</h2>
        <form className="quick-tag-form" onSubmit={submitQuickTag}><input value={quickTag} placeholder={shellMessages.sidebar.addTagPlaceholder} aria-label={shellMessages.sidebar.newQuickTag} onChange={(event) => setQuickTag(event.target.value)} /><button title={shellMessages.sidebar.addQuickTag} disabled={!quickTag.trim()}><Plus size={12} /></button></form>
        <div className="quick-tag-list">{quickTags.map((tag) => <span key={tag}><button onClick={() => addTag(tag, 'include')}>{tag.replaceAll('_', ' ')}</button><button title={shellMessages.sidebar.removeQuickTag(tag)} onClick={() => removeQuickTag(tag)}><X size={11} /></button></span>)}</div>
        {!quickTags.length && <p className="sidebar-empty">{shellMessages.sidebar.noQuickTags}</p>}
      </div>
      <div className="sidebar-section"><h2>{shellMessages.sidebar.filterPresets}</h2>{presets.filter((preset) => preset.sourceId === source).map((preset) => <div className="sidebar-list-item" key={preset.id}><button onClick={() => loadPreset(preset.id)}>{preset.name}</button><button title={shellMessages.sidebar.deletePreset(preset.name)} onClick={() => deletePreset(preset.id)}><Trash2 size={12} /></button></div>)}{!presets.some((preset) => preset.sourceId === source) && <p className="sidebar-empty">{shellMessages.sidebar.noSavedPresets}</p>}</div>
      <FavoriteGroups />
      <div className="sidebar-section favorite-library"><h2>{shellMessages.sidebar.recentSaves}</h2><div className="favorite-list">{favorites.slice(0, 5).map((post) => <button key={`${post.source}:${post.id}`} onClick={() => openDetail(post)}><CachedImage src={displayImageUrl(post.previewUrl)} alt="" /><span>#{post.id}<small>{post.source}</small></span></button>)}</div><div className="sidebar-file-actions"><button title={shellMessages.sidebar.exportFavorites} onClick={exportJson}><Download size={13} /> {shellMessages.sidebar.export}</button><button title={shellMessages.sidebar.importFavorites} onClick={() => fileRef.current?.click()}><Upload size={13} /> {shellMessages.sidebar.import}</button></div><input ref={fileRef} hidden type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFavorites(file); event.target.value = ''; }} /></div>
      <div className="sidebar-note"><span>{shellMessages.sidebar.phase}</span><p>{shellMessages.sidebar.note}</p></div>
    </aside>
  );
}
