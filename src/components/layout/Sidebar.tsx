import { Clock3, Compass, Download, Grid3X3, PanelLeftClose, Plus, Trash2, Upload, X } from 'lucide-react';
import { useFilterStore } from '../../stores/filter-store';
import { usePostStore } from '../../stores/post-store';
import { useUiStore } from '../../stores/ui-store';
import { useFavoriteStore } from '../../stores/favorite-store';
import { useSettingsStore } from '../../stores/settings-store';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { displayImageUrl } from '../../services/api/image-url';
import { FavoriteGroups } from '../favorites/FavoriteGroups';
import { CachedImage } from '../posts/CachedImage';
import { shellMessages } from '../../i18n/en-shell';
import { actionMessages } from '../../i18n/en-actions';
import { notify } from '../../services/notifications';
import { getBooruAdapter } from '../../services/booru-adapters';
import type { TagAutocompleteResult } from '../../types/api';
import { cacheSuggestions, getCachedSuggestions } from '../../services/booru-adapters/tag-suggestion-cache';
import { rememberTagMetadata, tagCategoryFor } from '../../services/booru-adapters/tag-categories';

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
  const credentials = useSettingsStore((state) => state.credentials[state.activeSource]);
  const favorites = useFavoriteStore((state) => state.favorites);
  const exportJson = useFavoriteStore((state) => state.exportJson);
  const importJson = useFavoriteStore((state) => state.importJson);
  const openDetail = useUiStore((state) => state.openDetail);
  const fileRef = useRef<HTMLInputElement>(null);
  const quickTagInputRef = useRef<HTMLInputElement>(null);
  const [quickTag, setQuickTag] = useState('');
  const [quickTagSuggestions, setQuickTagSuggestions] = useState<TagAutocompleteResult[]>([]);
  const [quickTagDropdownOpen, setQuickTagDropdownOpen] = useState(false);
  const submitQuickTag = (event: FormEvent) => { event.preventDefault(); addQuickTag(quickTag); setQuickTag(''); };

  useEffect(() => {
    const term = quickTag.trim();
    if (term.length < 2) { setQuickTagSuggestions([]); return; }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const cached = await getCachedSuggestions(source, term);
      if (cancelled) return;
      if (cached?.items.length) { setQuickTagSuggestions(cached.items); setQuickTagDropdownOpen(true); }
      if (cached && !cached.stale) return;
      try {
        const result = await getBooruAdapter(source).autocomplete(term, credentials?.username && credentials.apiKey ? credentials : undefined);
        await Promise.all([
          cacheSuggestions(source, term, result),
          rememberTagMetadata(source, result.map((item) => ({ name: item.name, category: item.category, postCount: item.postCount }))),
        ]);
        if (!cancelled) { setQuickTagSuggestions(result); setQuickTagDropdownOpen(true); }
      } catch {
        if (!cancelled && !cached) setQuickTagSuggestions([]);
      }
    }, 150);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [source, credentials, quickTag]);

  const selectQuickTagSuggestion = (name: string) => {
    setQuickTag(name);
    setQuickTagDropdownOpen(false);
  };
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
        <div className="quick-tag-form-wrapper">
          <form className="quick-tag-form" onSubmit={submitQuickTag}><input ref={quickTagInputRef} value={quickTag} placeholder={shellMessages.sidebar.addTagPlaceholder} aria-label={shellMessages.sidebar.newQuickTag} autoComplete="off" spellCheck={false} onChange={(event) => setQuickTag(event.target.value)} onFocus={() => setQuickTagDropdownOpen(quickTagSuggestions.length > 0)} onBlur={() => window.setTimeout(() => setQuickTagDropdownOpen(false), 120)} /><button title={shellMessages.sidebar.addQuickTag} disabled={!quickTag.trim()}><Plus size={12} /></button></form>
          {quickTagDropdownOpen && quickTagSuggestions.length > 0 && (
            <div className="quick-tag-suggestions" role="listbox">
              {quickTagSuggestions.map((suggestion) => (
                <button type="button" role="option" data-category={suggestion.category} key={suggestion.name} onMouseDown={() => selectQuickTagSuggestion(suggestion.name)}>
                  <span>{suggestion.name.replaceAll('_', ' ')}</span>
                  <small>{suggestion.postCount.toLocaleString()}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="quick-tag-list">{quickTags.map((tag) => { const category = tagCategoryFor(source, tag); return <span key={tag}><button data-category={category} onClick={() => addTag(tag, 'include')}><span className={`category-swatch category-${category}`} />{tag.replaceAll('_', ' ')}</button><button title={shellMessages.sidebar.removeQuickTag(tag)} onClick={() => removeQuickTag(tag)}><X size={11} /></button></span>; })}</div>
        {!quickTags.length && <p className="sidebar-empty">{shellMessages.sidebar.noQuickTags}</p>}
      </div>
      <div className="sidebar-section"><h2>{shellMessages.sidebar.filterPresets}</h2>{presets.filter((preset) => preset.sourceId === source).map((preset) => <div className="sidebar-list-item" key={preset.id}><button onClick={() => loadPreset(preset.id)}>{preset.name}</button><button title={shellMessages.sidebar.deletePreset(preset.name)} onClick={() => deletePreset(preset.id)}><Trash2 size={12} /></button></div>)}{!presets.some((preset) => preset.sourceId === source) && <p className="sidebar-empty">{shellMessages.sidebar.noSavedPresets}</p>}</div>
      <FavoriteGroups />
      <div className="sidebar-section favorite-library"><h2>{shellMessages.sidebar.recentSaves}</h2><div className="favorite-list">{favorites.slice(0, 5).map((post) => <button key={`${post.source}:${post.id}`} onClick={() => openDetail(post)}><CachedImage src={displayImageUrl(post.previewUrl)} alt="" /><span>#{post.id}<small>{post.source}</small></span></button>)}</div><div className="sidebar-file-actions"><button title={shellMessages.sidebar.exportFavorites} onClick={exportJson}><Download size={13} /> {shellMessages.sidebar.export}</button><button title={shellMessages.sidebar.importFavorites} onClick={() => fileRef.current?.click()}><Upload size={13} /> {shellMessages.sidebar.import}</button></div><input ref={fileRef} hidden type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFavorites(file); event.target.value = ''; }} /></div>
      <div className="sidebar-note"><span>{shellMessages.sidebar.phase}</span><p>{shellMessages.sidebar.note}</p></div>
    </aside>
  );
}
