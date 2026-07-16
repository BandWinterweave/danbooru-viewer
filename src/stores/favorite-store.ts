import { create } from 'zustand';
import { get, setMany } from 'idb-keyval';
import { getBooruAdapter } from '../services/booru-adapters';
import type { Credentials } from '../types/api';
import type { UnifiedPost } from '../types/post';
import { useSettingsStore } from './settings-store';
import { actionMessages } from '../i18n/en-actions';
import { MAX_FAVORITE_IMPORT_BYTES, parseFavoriteImport } from '../services/favorite-import';

export interface FavoriteGroup { id: string; name: string; postKeys: string[] }
export const favoriteKey = (post: UnifiedPost) => `${post.source}:${post.id}`;
interface FavoriteStore {
  favorites: UnifiedPost[]; groups: FavoriteGroup[]; hydrated: boolean; remoteOverrides: Record<string, boolean>;
  hydrate: () => Promise<void>; toggleLocal: (post: UnifiedPost) => Promise<void>; isLocal: (post: UnifiedPost) => boolean; isRemote: (post: UnifiedPost) => boolean;
  toggleRemote: (post: UnifiedPost) => Promise<void>; createGroup: (name: string) => Promise<void>; deleteGroup: (id: string) => Promise<void>;
  toggleInGroup: (groupId: string, post: UnifiedPost) => Promise<void>; exportJson: () => void; importJson: (file: File) => Promise<void>;
}
const FAVORITES_KEY = 'danbooru-viewer:favorites'; const GROUPS_KEY = 'danbooru-viewer:favorite-groups';
let favoriteOperation = Promise.resolve();
function enqueueFavoriteOperation(operation: () => Promise<void>) {
  const result = favoriteOperation.then(operation, operation);
  favoriteOperation = result.catch(() => undefined);
  return result;
}
async function persist(favorites: UnifiedPost[], groups: FavoriteGroup[]) { await setMany([[FAVORITES_KEY, favorites], [GROUPS_KEY, groups]]); }
function credentialsFor(post: UnifiedPost): Credentials | undefined { return useSettingsStore.getState().credentials[post.source]; }
export const useFavoriteStore = create<FavoriteStore>((setState, getState) => ({
  favorites: [], groups: [], hydrated: false, remoteOverrides: {},
  hydrate: () => enqueueFavoriteOperation(async () => setState({ favorites: await get<UnifiedPost[]>(FAVORITES_KEY) ?? [], groups: await get<FavoriteGroup[]>(GROUPS_KEY) ?? [], hydrated: true })),
  isLocal: (post) => getState().favorites.some((item) => favoriteKey(item) === favoriteKey(post)),
  isRemote: (post) => getState().remoteOverrides[favoriteKey(post)] ?? Boolean(post.isFavorited),
  toggleLocal: (post) => enqueueFavoriteOperation(async () => { const state = getState(); if (!state.hydrated) throw new Error(actionMessages.favorites.notReady); const key = favoriteKey(post); const removing = state.favorites.some((item) => favoriteKey(item) === key); const favorites = removing ? state.favorites.filter((item) => favoriteKey(item) !== key) : [post, ...state.favorites]; const groups = removing ? state.groups.map((group) => ({ ...group, postKeys: group.postKeys.filter((item) => item !== key) })) : state.groups; await persist(favorites, groups); setState({ favorites, groups }); }),
  toggleRemote: async (post) => { const adapter = getBooruAdapter(post.source); const credentials = credentialsFor(post); if (!credentials?.username || !credentials.apiKey || !adapter.addFavorite) throw new Error(actionMessages.favorites.remoteUnavailable); const favorited = getState().isRemote(post); if (favorited) { if (!adapter.removeFavorite) throw new Error(actionMessages.favorites.remoteRemoveUnavailable); await adapter.removeFavorite(post.id, credentials); } else await adapter.addFavorite(post.id, credentials); setState((state) => ({ remoteOverrides: { ...state.remoteOverrides, [favoriteKey(post)]: !favorited } })); },
  createGroup: (name) => enqueueFavoriteOperation(async () => { const state = getState(); if (!state.hydrated) throw new Error(actionMessages.favorites.notReady); if (!name.trim()) return; const groups = [...state.groups, { id: crypto.randomUUID(), name: name.trim(), postKeys: [] }]; await persist(state.favorites, groups); setState({ groups }); }),
  deleteGroup: (id) => enqueueFavoriteOperation(async () => { const state = getState(); if (!state.hydrated) throw new Error(actionMessages.favorites.notReady); const groups = state.groups.filter((group) => group.id !== id); await persist(state.favorites, groups); setState({ groups }); }),
  toggleInGroup: (groupId, post) => enqueueFavoriteOperation(async () => { const state = getState(); if (!state.hydrated) throw new Error(actionMessages.favorites.notReady); const key = favoriteKey(post); const adding = !state.groups.find((group) => group.id === groupId)?.postKeys.includes(key); const favorites = adding && !state.favorites.some((item) => favoriteKey(item) === key) ? [post, ...state.favorites] : state.favorites; const groups = state.groups.map((group) => group.id !== groupId ? group : { ...group, postKeys: adding ? [...group.postKeys, key] : group.postKeys.filter((item) => item !== key) }); await persist(favorites, groups); setState({ favorites, groups }); }),
  exportJson: () => { const state = getState(); const blob = new Blob([JSON.stringify({ version: 1, favorites: state.favorites, groups: state.groups }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'danbooru-viewer-favorites.json'; anchor.click(); URL.revokeObjectURL(url); },
  importJson: (file) => enqueueFavoriteOperation(async () => { if (!getState().hydrated) throw new Error(actionMessages.favorites.notReady); if (file.size > MAX_FAVORITE_IMPORT_BYTES) throw new Error(actionMessages.favorites.invalidFile); let parsed: unknown; try { parsed = JSON.parse(await file.text()); } catch { throw new Error(actionMessages.favorites.invalidFile); } const data = parseFavoriteImport(parsed); await persist(data.favorites, data.groups); setState(data); }),
}));
