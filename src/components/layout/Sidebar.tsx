import { ArrowDown, ArrowUp, Clock3, Compass, Download, Grid3X3, Heart, PanelLeftClose, Pencil, Plus, RefreshCw, Shuffle, Trash2, Upload, X } from 'lucide-react';
import { useFilterStore } from '../../stores/filter-store';
import { usePostStore } from '../../stores/post-store';
import { useUiStore } from '../../stores/ui-store';
import { useFavoriteStore } from '../../stores/favorite-store';
import { useSettingsStore } from '../../stores/settings-store';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { displayImageUrl } from '../../services/api/image-url';
import { FavoriteGroups } from '../favorites/FavoriteGroups';
import { CachedImage } from '../posts/CachedImage';
import { useI18n } from '../../i18n/runtime';
import { getBooruAdapter } from '../../services/booru-adapters';
import type { TagAutocompleteResult } from '../../types/api';
import { cacheSuggestions, getCachedSuggestions } from '../../services/booru-adapters/tag-suggestion-cache';
import { hydrateTagMetadata, rememberTagMetadata, tagCategoryFor } from '../../services/booru-adapters/tag-categories';
import { applyKnownSuggestionCategories, ensureCanonicalTagMetadata } from '../../services/booru-adapters/tag-enrichment';

export function Sidebar() {
  const { locale, messages: { shell: shellMessages, domainActions: actionMessages } } = useI18n();
  const open = useUiStore((state) => state.sidebarOpen);
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);
  const toggle = useUiStore((state) => state.toggleSidebar);
  const setOpen = useUiStore((state) => state.setSidebarOpen);
  const postCount = usePostStore((state) => state.posts.length);
  const addTag = useFilterStore((state) => state.addTagFilter);
  const setMeta = useFilterStore((state) => state.setMetaFilter);
  const presets = useFilterStore((state) => state.presets);
  const loadPreset = useFilterStore((state) => state.loadPreset);
  const deletePreset = useFilterStore((state) => state.deletePreset);
  const renamePreset = useFilterStore((state) => state.renamePreset);
  const updatePreset = useFilterStore((state) => state.updatePreset);
  const movePreset = useFilterStore((state) => state.movePreset);
  const source = useSettingsStore((state) => state.activeSource);
  const quickTags = useSettingsStore((state) => state.quickTags);
  const addQuickTag = useSettingsStore((state) => state.addQuickTag);
  const removeQuickTag = useSettingsStore((state) => state.removeQuickTag);
  const credentials = useSettingsStore((state) => state.credentials.danbooru);
  const favorites = useFavoriteStore((state) => state.favorites);
  const favoritesHydrated = useFavoriteStore((state) => state.hydrated);
  const exportJson = useFavoriteStore((state) => state.exportJson);
  const openDetail = useUiStore((state) => state.openDetail);
  const quickTagInputRef = useRef<HTMLInputElement>(null);
  const [quickTag, setQuickTag] = useState('');
  const [quickTagSuggestions, setQuickTagSuggestions] = useState<TagAutocompleteResult[]>([]);
  const [quickTagDropdownOpen, setQuickTagDropdownOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [, setQuickTagCategoryRevision] = useState(0);
  const suggestionListId = 'quick-tag-suggestions';
  const submitQuickTag = (event: FormEvent) => { event.preventDefault(); addQuickTag(quickTag); setQuickTag(''); };
  const openView = (next: 'browse' | 'favorites') => {
    setView(next);
    if (window.matchMedia?.('(max-width: 720px)').matches) setOpen(false);
  };

  useEffect(() => {
    if (window.matchMedia?.('(max-width: 720px)').matches) setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !quickTagDropdownOpen) setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, quickTagDropdownOpen, setOpen]);

  useEffect(() => {
    const term = quickTag.trim();
    if (term.length < 2) { setQuickTagSuggestions([]); return; }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      const cached = await getCachedSuggestions('danbooru', term);
      if (cancelled) return;
      if (cached?.items.length) {
        await ensureCanonicalTagMetadata('danbooru', cached.items.map((item) => item.name)).catch(() => undefined);
        setQuickTagSuggestions(applyKnownSuggestionCategories('danbooru', cached.items)); setQuickTagDropdownOpen(true); setActiveSuggestion(0);
      }
      if (cached && !cached.stale) return;
      try {
        const result = await getBooruAdapter('danbooru').autocomplete(term, credentials?.username && credentials.apiKey ? credentials : undefined);
        await ensureCanonicalTagMetadata('danbooru', result.map((item) => item.name)).catch(() => undefined);
        const categorized = applyKnownSuggestionCategories('danbooru', result);
        await Promise.all([
          cacheSuggestions('danbooru', term, categorized),
          rememberTagMetadata('danbooru', result.map((item) => ({ name: item.name, category: item.category, postCount: item.postCount }))),
        ]);
        if (!cancelled) { setQuickTagSuggestions(categorized); setQuickTagDropdownOpen(true); setActiveSuggestion(categorized.length ? 0 : -1); }
      } catch {
        if (!cancelled && !cached) setQuickTagSuggestions([]);
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [source, credentials, quickTag]);

  useEffect(() => {
    let cancelled = false;
    void ensureCanonicalTagMetadata(source, quickTags).catch(() => hydrateTagMetadata(source, quickTags)).then(() => {
      if (!cancelled) setQuickTagCategoryRevision((revision) => revision + 1);
    });
    return () => { cancelled = true; };
  }, [source, quickTags]);

  const selectQuickTagSuggestion = (name: string) => {
    setQuickTag(name);
    setQuickTagDropdownOpen(false);
    setActiveSuggestion(-1);
  };
  const navigateQuickTagSuggestions = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setQuickTagDropdownOpen(false); setActiveSuggestion(-1); return; }
    if (!quickTagDropdownOpen || !quickTagSuggestions.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveSuggestion((current) => (current + direction + quickTagSuggestions.length) % quickTagSuggestions.length);
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      selectQuickTagSuggestion(quickTagSuggestions[activeSuggestion].name);
    }
  };
  if (!open) return null;
  return (
    <>
    <button className="sidebar-scrim" aria-label={shellMessages.sidebar.close} onClick={() => setOpen(false)} />
    <aside className="sidebar" aria-label={shellMessages.sidebar.browse}>
      <div className="sidebar-heading"><span>{shellMessages.sidebar.browse}</span><button title={shellMessages.sidebar.collapse} aria-label={shellMessages.sidebar.close} onClick={toggle}><PanelLeftClose size={16} /></button></div>
      <nav className="side-nav">
         <button className={view === 'browse' ? 'is-current' : ''} onClick={() => openView('browse')}><Compass size={16} /> {shellMessages.sidebar.discover} <span>{postCount || '—'}</span></button>
          <button className={view === 'favorites' ? 'is-current' : ''} onClick={() => openView('favorites')}><Heart size={16} /> {actionMessages.favorites.library} <span>{favorites.length}</span></button>
         <button onClick={() => { openView('browse'); setMeta({ order: 'score' }); }}><Grid3X3 size={16} /> {shellMessages.sidebar.topScored}</button>
         <button onClick={() => { openView('browse'); setMeta({ order: 'rank' }); }}><Clock3 size={16} /> {shellMessages.sidebar.trending}</button>
         <button onClick={() => { openView('browse'); setMeta({ order: 'random' }); }}><Shuffle size={16} /> {shellMessages.sidebar.random}</button>
      </nav>
      <div className="sidebar-section">
        <h2>{shellMessages.sidebar.quickTags}</h2>
        <div className="quick-tag-form-wrapper">
          <form className="quick-tag-form" onSubmit={submitQuickTag}><input ref={quickTagInputRef} value={quickTag} placeholder={shellMessages.sidebar.addTagPlaceholder} aria-label={shellMessages.sidebar.newQuickTag} autoComplete="off" spellCheck={false} role="combobox" aria-autocomplete="list" aria-expanded={quickTagDropdownOpen && quickTagSuggestions.length > 0} aria-controls={suggestionListId} aria-activedescendant={quickTagDropdownOpen && activeSuggestion >= 0 ? `${suggestionListId}-${activeSuggestion}` : undefined} onKeyDown={navigateQuickTagSuggestions} onChange={(event) => setQuickTag(event.target.value)} onFocus={() => setQuickTagDropdownOpen(quickTagSuggestions.length > 0)} onBlur={() => window.setTimeout(() => setQuickTagDropdownOpen(false), 120)} /><button title={shellMessages.sidebar.addQuickTag} disabled={!quickTag.trim()}><Plus size={12} /></button></form>
          {quickTagDropdownOpen && quickTagSuggestions.length > 0 && (
            <div className="quick-tag-suggestions" id={suggestionListId} role="listbox">
              {quickTagSuggestions.map((suggestion, index) => (
                <button type="button" id={`${suggestionListId}-${index}`} role="option" aria-selected={activeSuggestion === index} className={activeSuggestion === index ? 'is-active' : ''} data-category={suggestion.category} key={suggestion.name} onMouseEnter={() => setActiveSuggestion(index)} onMouseDown={() => selectQuickTagSuggestion(suggestion.name)}>
                  <span>{suggestion.name.replaceAll('_', ' ')}</span>
                   <small>{suggestion.postCount.toLocaleString(locale)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="quick-tag-list">{quickTags.map((tag) => { const category = tagCategoryFor(source, tag); return <span key={tag}><button data-category={category} onClick={() => addTag(tag, 'include')}><span className={`category-swatch category-${category}`} />{tag.replaceAll('_', ' ')}</button><button title={shellMessages.sidebar.removeQuickTag(tag)} onClick={() => removeQuickTag(tag)}><X size={11} /></button></span>; })}</div>
        {!quickTags.length && <p className="sidebar-empty">{shellMessages.sidebar.noQuickTags}</p>}
      </div>
       <div className="sidebar-section"><h2>{shellMessages.sidebar.filterPresets}</h2>{presets.filter((preset) => preset.sourceId === source).map((preset, index, sourcePresets) => <div className="sidebar-list-item preset-list-item" key={preset.id}><button className="preset-load" onClick={() => loadPreset(preset.id)}>{preset.name}</button><div className="preset-actions"><button title={shellMessages.sidebar.renamePreset(preset.name)} onClick={() => { const name = window.prompt(shellMessages.sidebar.renamePresetPrompt(preset.name), preset.name); if (name?.trim()) renamePreset(preset.id, name); }}><Pencil size={12} /></button><button title={shellMessages.sidebar.updatePreset(preset.name)} onClick={() => { if (window.confirm(shellMessages.sidebar.confirmUpdatePreset(preset.name))) updatePreset(preset.id); }}><RefreshCw size={12} /></button><button disabled={index === 0} title={shellMessages.sidebar.movePresetUp(preset.name)} onClick={() => movePreset(preset.id, -1)}><ArrowUp size={12} /></button><button disabled={index === sourcePresets.length - 1} title={shellMessages.sidebar.movePresetDown(preset.name)} onClick={() => movePreset(preset.id, 1)}><ArrowDown size={12} /></button><button title={shellMessages.sidebar.deletePreset(preset.name)} onClick={() => deletePreset(preset.id)}><Trash2 size={12} /></button></div></div>)}{!presets.some((preset) => preset.sourceId === source) && <p className="sidebar-empty">{shellMessages.sidebar.noSavedPresets}</p>}</div>
      <FavoriteGroups />
       <div className="sidebar-section favorite-library"><h2>{shellMessages.sidebar.recentSaves}</h2><div className="favorite-list">{favorites.slice(0, 5).map((post) => <button key={`${post.source}:${post.id}`} onClick={() => openDetail(post, 'favorites')}><CachedImage src={displayImageUrl(post.previewUrl)} alt="" /><span>#{post.id}<small>{post.source}</small></span></button>)}</div><div className="sidebar-file-actions"><button disabled={!favoritesHydrated} aria-describedby={!favoritesHydrated ? 'sidebar-favorites-not-ready' : undefined} title={favoritesHydrated ? shellMessages.sidebar.exportFavorites : actionMessages.favorites.notReady} onClick={exportJson}><Download size={13} /> {shellMessages.sidebar.export}</button><button disabled={!favoritesHydrated} aria-describedby={!favoritesHydrated ? 'sidebar-favorites-not-ready' : undefined} title={favoritesHydrated ? shellMessages.sidebar.importFavorites : actionMessages.favorites.notReady} onClick={() => openView('favorites')}><Upload size={13} /> {shellMessages.sidebar.import}</button><span id="sidebar-favorites-not-ready" className="sr-only">{!favoritesHydrated && actionMessages.favorites.notReady}</span></div></div>
    </aside>
    </>
  );
}
