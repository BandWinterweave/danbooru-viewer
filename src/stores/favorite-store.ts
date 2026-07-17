import { create } from 'zustand';
import { get, setMany } from 'idb-keyval';
import { getBooruAdapter } from '../services/booru-adapters';
import type { Credentials } from '../types/api';
import type { UnifiedPost } from '../types/post';
import { getMessages } from '../i18n/runtime-core';
import { favoriteDataRevision, mergeFavoriteImports, parseFavoriteImportFile, type FavoriteData, type FavoriteImportMode } from '../services/favorite-import';

export interface FavoriteGroup { id: string; name: string; postKeys: string[] }
export const favoriteKey = (post: UnifiedPost) => `${post.source}:${post.id}`;
const actionMessages = () => getMessages().domainActions;
interface FavoriteStore {
  favorites: UnifiedPost[]; groups: FavoriteGroup[]; hydrated: boolean; remoteOverrides: Record<string, boolean>;
  hydrate: () => Promise<void>; toggleLocal: (post: UnifiedPost) => Promise<void>; isLocal: (post: UnifiedPost) => boolean; isRemote: (post: UnifiedPost) => boolean;
  toggleRemote: (post: UnifiedPost, credentials?: Credentials) => Promise<void>; createGroup: (name: string) => Promise<void>; deleteGroup: (id: string) => Promise<void>;
  renameGroup: (id: string, name: string) => Promise<void>; reorderGroup: (id: string, direction: -1 | 1) => Promise<void>;
  toggleInGroup: (groupId: string, post: UnifiedPost) => Promise<void>; addManyToGroup: (groupId: string, keys: string[]) => Promise<void>;
  removeManyFromGroup: (groupId: string, keys: string[]) => Promise<void>; removeManyFavorites: (keys: string[]) => Promise<void>;
  exportJson: () => void; importJson: (file: File, mode?: FavoriteImportMode) => Promise<void>; applyImport: (data: FavoriteData, mode: FavoriteImportMode, baseline: string) => Promise<void>;
}
const FAVORITES_KEY = 'danbooru-viewer:favorites'; const GROUPS_KEY = 'danbooru-viewer:favorite-groups';
const FAVORITES_LOCK = 'danbooru-viewer:favorites-write';
let favoriteOperation = Promise.resolve();
function enqueueFavoriteOperation(operation: () => Promise<void>) {
  const result = favoriteOperation.then(operation, operation);
  favoriteOperation = result.catch(() => undefined);
  return result;
}
async function persist(favorites: UnifiedPost[], groups: FavoriteGroup[]) { await setMany([[FAVORITES_KEY, favorites], [GROUPS_KEY, groups]]); }
function cleanPersistedData(rawFavorites: unknown, rawGroups: unknown): FavoriteData {
  const favorites: UnifiedPost[] = [];
  const keys = new Set<string>();
  if (Array.isArray(rawFavorites)) for (const value of rawFavorites) {
    if (!value || typeof value !== 'object') continue;
    const post = value as UnifiedPost;
    if (!Number.isSafeInteger(post.id) || post.id <= 0 || typeof post.source !== 'string') continue;
    const key = favoriteKey(post);
    if (!keys.has(key)) { keys.add(key); favorites.push(post); }
  }
  const groupIds = new Set<string>();
  const groups: FavoriteGroup[] = [];
  if (Array.isArray(rawGroups)) for (const value of rawGroups) {
    if (!value || typeof value !== 'object') continue;
    const group = value as FavoriteGroup;
    if (typeof group.id !== 'string' || !group.id || groupIds.has(group.id) || typeof group.name !== 'string' || !group.name.trim() || !Array.isArray(group.postKeys)) continue;
    groupIds.add(group.id);
    groups.push({ id: group.id, name: group.name, postKeys: [...new Set(group.postKeys.filter((key): key is string => typeof key === 'string' && keys.has(key)))] });
  }
  return { favorites, groups };
}
async function readPersisted(): Promise<FavoriteData> {
  return cleanPersistedData(await get<unknown>(FAVORITES_KEY), await get<unknown>(GROUPS_KEY));
}
type FavoriteMutation = (current: FavoriteData) => FavoriteData | null;
function mutateFavorites(getState: () => FavoriteStore, setState: (state: Partial<FavoriteStore>) => void, mutation: FavoriteMutation) {
  return enqueueFavoriteOperation(async () => {
    if (!getState().hydrated) throw new Error(actionMessages().favorites.notReady);
    const execute = async (current: FavoriteData) => {
      let next: FavoriteData | null;
      try { next = mutation(current); } catch (error) { setState(current); throw error; }
      if (!next) { setState(current); return; }
      await persist(next.favorites, next.groups);
      setState(next);
    };
    if (typeof navigator !== 'undefined' && navigator.locks) {
      await navigator.locks.request(FAVORITES_LOCK, async () => execute(await readPersisted()));
    } else {
      const state = getState();
      await execute({ favorites: state.favorites, groups: state.groups });
    }
  });
}
export const useFavoriteStore = create<FavoriteStore>((setState, getState) => ({
  favorites: [], groups: [], hydrated: false, remoteOverrides: {},
  hydrate: () => enqueueFavoriteOperation(async () => setState({ ...await readPersisted(), hydrated: true })),
  isLocal: (post) => getState().favorites.some((item) => favoriteKey(item) === favoriteKey(post)),
  isRemote: (post) => getState().remoteOverrides[favoriteKey(post)] ?? Boolean(post.isFavorited),
  toggleLocal: (post) => mutateFavorites(getState, setState, (state) => { const key = favoriteKey(post); const removing = state.favorites.some((item) => favoriteKey(item) === key); return { favorites: removing ? state.favorites.filter((item) => favoriteKey(item) !== key) : [post, ...state.favorites], groups: removing ? state.groups.map((group) => ({ ...group, postKeys: group.postKeys.filter((item) => item !== key) })) : state.groups }; }),
  toggleRemote: async (post, credentials) => { const adapter = getBooruAdapter(post.source); if (!credentials?.username || !credentials.apiKey || !adapter.addFavorite) throw new Error(actionMessages().favorites.remoteUnavailable); const favorited = getState().isRemote(post); if (favorited) { if (!adapter.removeFavorite) throw new Error(actionMessages().favorites.remoteRemoveUnavailable); await adapter.removeFavorite(post.id, credentials); } else await adapter.addFavorite(post.id, credentials); setState((state) => ({ remoteOverrides: { ...state.remoteOverrides, [favoriteKey(post)]: !favorited } })); },
  createGroup: (name) => mutateFavorites(getState, setState, (state) => !name.trim() ? null : ({ ...state, groups: [...state.groups, { id: crypto.randomUUID(), name: name.trim(), postKeys: [] }] })),
  deleteGroup: (id) => mutateFavorites(getState, setState, (state) => ({ ...state, groups: state.groups.filter((group) => group.id !== id) })),
  renameGroup: (id, name) => mutateFavorites(getState, setState, (state) => !name.trim() || !state.groups.some((group) => group.id === id) ? null : ({ ...state, groups: state.groups.map((group) => group.id === id ? { ...group, name: name.trim() } : group) })),
  reorderGroup: (id, direction) => mutateFavorites(getState, setState, (state) => { const index = state.groups.findIndex((group) => group.id === id); const target = index + direction; if (index < 0 || target < 0 || target >= state.groups.length) return null; const groups = [...state.groups]; [groups[index], groups[target]] = [groups[target], groups[index]]; return { ...state, groups }; }),
  toggleInGroup: (groupId, post) => mutateFavorites(getState, setState, (state) => { const group = state.groups.find((item) => item.id === groupId); if (!group) return null; const key = favoriteKey(post); const adding = !group.postKeys.includes(key); return { favorites: adding && !state.favorites.some((item) => favoriteKey(item) === key) ? [post, ...state.favorites] : state.favorites, groups: state.groups.map((item) => item.id !== groupId ? item : { ...item, postKeys: adding ? [...item.postKeys, key] : item.postKeys.filter((entry) => entry !== key) }) }; }),
  addManyToGroup: (groupId, keys) => mutateFavorites(getState, setState, (state) => { if (!state.groups.some((item) => item.id === groupId)) return null; const favoriteKeys = new Set(state.favorites.map(favoriteKey)); const additions = keys.filter((key) => favoriteKeys.has(key)); return { ...state, groups: state.groups.map((item) => item.id === groupId ? { ...item, postKeys: [...new Set([...item.postKeys, ...additions])] } : item) }; }),
  removeManyFromGroup: (groupId, keys) => mutateFavorites(getState, setState, (state) => { if (!state.groups.some((group) => group.id === groupId)) return null; const removing = new Set(keys); return { ...state, groups: state.groups.map((group) => group.id === groupId ? { ...group, postKeys: group.postKeys.filter((key) => !removing.has(key)) } : group) }; }),
  removeManyFavorites: (keys) => mutateFavorites(getState, setState, (state) => { const removing = new Set(keys); return { favorites: state.favorites.filter((post) => !removing.has(favoriteKey(post))), groups: state.groups.map((group) => ({ ...group, postKeys: group.postKeys.filter((key) => !removing.has(key)) })) }; }),
  exportJson: () => { const state = getState(); if (!state.hydrated) throw new Error(actionMessages().favorites.notReady); const blob = new Blob([JSON.stringify({ version: 1, favorites: state.favorites, groups: state.groups }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'danbooru-viewer-favorites.json'; anchor.click(); URL.revokeObjectURL(url); },
  applyImport: (data, mode, baseline) => mutateFavorites(getState, setState, (state) => { if (favoriteDataRevision(state) !== baseline) throw new Error(actionMessages().favorites.importChanged); return mode === 'merge' ? mergeFavoriteImports(state, data) : data; }),
  importJson: async (file, mode = 'replace') => { const data = await parseFavoriteImportFile(file); const state = getState(); await state.applyImport(data, mode, favoriteDataRevision(state)); },
}));
