import { ArrowDown, ArrowUp, Check, Download, FolderPlus, Import, Pencil, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/runtime';
import { queryFavoriteLibrary, type FavoriteSort } from '../../services/favorite-library';
import { parseFavoriteImportFile, previewFavoriteImport, type FavoriteData, type FavoriteImportPreview } from '../../services/favorite-import';
import { notify, runAsync } from '../../services/notifications';
import { favoriteKey, useFavoriteStore } from '../../stores/favorite-store';
import { useUiStore } from '../../stores/ui-store';
import type { BooruSource, Rating } from '../../types/post';
import { MediaPreview } from '../posts/MediaPreview';

export function FavoriteLibrary() {
  const { messages: { domainActions: { favorites: messages }, posts } } = useI18n();
  const favorites = useFavoriteStore((state) => state.favorites);
  const groups = useFavoriteStore((state) => state.groups);
  const hydrated = useFavoriteStore((state) => state.hydrated);
  const store = useFavoriteStore();
  const openDetail = useUiStore((state) => state.openDetail);
  const setHoveredPost = useUiStore((state) => state.setHoveredPost);
  const clearHoveredPost = useUiStore((state) => state.clearHoveredPost);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('all');
  const [source, setSource] = useState('');
  const [rating, setRating] = useState('');
  const [sort, setSort] = useState<FavoriteSort>('saved');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<string[]>([]);
  const [targetGroup, setTargetGroup] = useState('');
  const [importData, setImportData] = useState<FavoriteData | null>(null);
  const [preview, setPreview] = useState<FavoriteImportPreview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const importSequence = useRef(0);
  const visible = useMemo(() => queryFavoriteLibrary(favorites, groups, { search, groupId, source: source as BooruSource || undefined, rating: rating as Rating || undefined, sort, direction }), [favorites, groups, search, groupId, source, rating, sort, direction]);
  const selectedSet = new Set(selected);
  const selectedGroup = groups.find((group) => group.id === groupId);
  const runStorage = (operation: Promise<void>) => runAsync('storage', operation.then(() => setSelected([])));
  const closeImport = () => { setImportData(null); setPreview(null); };
  useEffect(() => { setSelected([]); }, [search, groupId, source, rating]);
  useEffect(() => () => { useUiStore.setState({ hoveredPost: null }); }, []);
  useEffect(() => {
    if (!importData || !preview) return;
    const background = document.querySelector<HTMLElement>('.app-background');
    const wasInert = background?.inert ?? false;
    if (background) background.inert = true;
    initialFocusRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeImport(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (background) background.inert = wasInert;
      importButtonRef.current?.focus();
    };
  }, [importData, preview]);
  const readImport = async (file: File) => {
    const sequence = ++importSequence.current;
    try {
      const data = await parseFavoriteImportFile(file);
      if (sequence !== importSequence.current) return;
      setImportData(data);
      setPreview(previewFavoriteImport({ favorites, groups }, data));
    } catch (error) {
      if (sequence !== importSequence.current) return;
      notify({ tone: 'error', title: messages.importFailed, description: error instanceof Error ? error.message : undefined });
    }
  };
  const applyImport = (mode: 'merge' | 'replace') => {
    if (!importData || !preview) return;
    if (mode === 'replace' && !window.confirm(messages.confirmReplace(preview.replacedFavorites, preview.replacedGroups))) return;
    runAsync('storage', store.applyImport(importData, mode, preview.baseline).then(() => { closeImport(); notify({ tone: 'success', title: messages.importComplete }); }));
  };

  return <section className="favorite-library-view" aria-labelledby="favorite-library-title">
    <header className="favorite-library-header"><div><h1 id="favorite-library-title">{messages.library}</h1><span>{messages.results(visible.length, favorites.length)}</span></div><div><button ref={importButtonRef} disabled={!hydrated} aria-describedby={!hydrated ? 'favorite-storage-not-ready' : undefined} title={hydrated ? messages.importFile : messages.notReady} onClick={() => fileRef.current?.click()}><Import size={15} />{messages.importFile}</button><button disabled={!hydrated} aria-describedby={!hydrated ? 'favorite-storage-not-ready' : undefined} title={hydrated ? messages.exportFavorites : messages.notReady} onClick={store.exportJson}><Download size={15} />{messages.export}</button><span id="favorite-storage-not-ready" className="sr-only">{!hydrated && messages.notReady}</span></div></header>
    <div className="favorite-library-controls">
      <label className="favorite-search"><Search size={15} /><span className="sr-only">{messages.searchLabel}</span><input aria-label={messages.searchLabel} placeholder={messages.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <select aria-label={messages.allGroups} value={groupId} onChange={(event) => { setGroupId(event.target.value); setSelected([]); }}><option value="all">{messages.allGroups}</option><option value="ungrouped">{messages.ungrouped}</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select>
      <select aria-label={messages.allSources} value={source} onChange={(event) => setSource(event.target.value)}><option value="">{messages.allSources}</option>{[...new Set(favorites.map((post) => post.source))].map((value) => <option key={value}>{value}</option>)}</select>
      <select aria-label={messages.allRatings} value={rating} onChange={(event) => setRating(event.target.value)}><option value="">{messages.allRatings}</option>{(['g', 's', 'q', 'e'] as const).map((value) => <option value={value} key={value}>{posts.detail.ratings[value]}</option>)}</select>
      <select aria-label={messages.sortSaved} value={sort} onChange={(event) => setSort(event.target.value as FavoriteSort)}><option value="saved">{messages.sortSaved}</option><option value="date">{messages.sortDate}</option><option value="score">{messages.sortScore}</option><option value="id">{messages.sortId}</option></select>
      <button className="icon-button" aria-label={direction === 'desc' ? messages.descending : messages.ascending} title={direction === 'desc' ? messages.descending : messages.ascending} onClick={() => setDirection((value) => value === 'desc' ? 'asc' : 'desc')}>{direction === 'desc' ? <ArrowDown size={15} /> : <ArrowUp size={15} />}</button>
    </div>
    <div className="favorite-group-organizer" aria-label={messages.groupManagement}>{groups.map((group, index) => <div key={group.id}><span>{group.name}<small>{group.postKeys.length}</small></span><button disabled={index === 0} title={messages.moveGroupUp(group.name)} onClick={() => runStorage(store.reorderGroup(group.id, -1))}><ArrowUp size={13} /></button><button disabled={index === groups.length - 1} title={messages.moveGroupDown(group.name)} onClick={() => runStorage(store.reorderGroup(group.id, 1))}><ArrowDown size={13} /></button><button title={messages.renameGroup(group.name)} onClick={() => { const name = window.prompt(messages.renamePrompt(group.name), group.name); if (name) runStorage(store.renameGroup(group.id, name)); }}><Pencil size={13} /></button><button title={messages.deleteGroup(group.name)} onClick={() => { if (window.confirm(messages.confirmDeleteGroup(group.name))) runStorage(store.deleteGroup(group.id)); }}><Trash2 size={13} /></button></div>)}</div>
    <div className="favorite-batch-bar"><button onClick={() => setSelected(visible.map(favoriteKey))}><Check size={14} />{messages.selectVisible}</button>{selected.length > 0 && <><strong>{messages.selectedCount(selected.length)}</strong><select aria-label={messages.chooseGroup} value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)}><option value="">{messages.chooseGroup}</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select><button disabled={!targetGroup} onClick={() => runStorage(store.addManyToGroup(targetGroup, selected))}><FolderPlus size={14} />{messages.addToGroup}</button><button disabled={!selectedGroup} onClick={() => { if (selectedGroup && window.confirm(messages.confirmRemoveFromGroup(selected.length, selectedGroup.name))) runStorage(store.removeManyFromGroup(selectedGroup.id, selected)); }}><X size={14} />{messages.removeFromGroup}</button><button className="is-destructive" onClick={() => { if (window.confirm(messages.confirmRemoveFavorites(selected.length))) runStorage(store.removeManyFavorites(selected)); }}><Trash2 size={14} />{messages.removeFavorites}</button><button className="icon-button" title={messages.clearSelection} onClick={() => setSelected([])}><X size={14} /></button></>}</div>
    {visible.length ? <div className="favorite-result-grid">{visible.map((post) => { const key = favoriteKey(post); const checked = selectedSet.has(key); return <article key={key} className={checked ? 'is-selected' : ''} onMouseEnter={() => setHoveredPost(post)} onMouseMove={() => setHoveredPost(post)} onMouseLeave={() => clearHoveredPost(post)}><button className="favorite-select" aria-label={messages.selectPost(post.id)} aria-pressed={checked} onClick={() => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}><Check size={14} /></button><button className="favorite-open" title={messages.openPost(post.id)} onClick={() => openDetail(post, 'favorites')}><MediaPreview post={post} /></button><footer><span>{post.source} #{post.id}</span><strong>{post.score}</strong></footer></article>; })}</div> : <p className="favorite-library-empty">{messages.emptyLibrary}</p>}
    <input ref={fileRef} hidden type="file" accept="application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImport(file); event.target.value = ''; }} />
    {importData && preview && createPortal(<div className="favorite-import-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeImport(); }}><section ref={dialogRef} className="favorite-import-dialog" role="dialog" aria-modal="true" aria-labelledby="favorite-import-title"><h2 id="favorite-import-title">{messages.importPreview}</h2><p>{messages.importSummary(preview.importedFavorites, preview.importedGroups)}</p><p>{messages.mergeSummary(preview.addedFavorites, preview.updatedFavorites, preview.addedGroups, preview.mergedGroups)}</p><p>{messages.replaceSummary(preview.replacedFavorites, preview.replacedGroups)}</p><div><button ref={initialFocusRef} onClick={() => applyImport('merge')}>{messages.merge}</button><button className="is-destructive" onClick={() => applyImport('replace')}>{messages.replace}</button><button onClick={closeImport}>{messages.cancelImport}</button></div></section></div>, document.body)}
  </section>;
}
