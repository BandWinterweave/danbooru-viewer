import { create } from 'zustand';
import { del, get, set } from 'idb-keyval';
import { getBooruAdapter } from '../services/booru-adapters';
import type { Credentials } from '../types/api';
import type { UnifiedPost } from '../types/post';
import { useSettingsStore } from './settings-store';
import { actionMessages } from '../i18n/en-actions';

export interface FavoriteGroup { id: string; name: string; postKeys: string[] }
export const favoriteKey = (post: UnifiedPost) => `${post.source}:${post.id}`;
interface FavoriteStore {
  favorites: UnifiedPost[]; groups: FavoriteGroup[]; hydrated: boolean; remoteOverrides: Record<string, boolean>;
  hydrate: () => Promise<void>; toggleLocal: (post: UnifiedPost) => Promise<void>; isLocal: (post: UnifiedPost) => boolean; isRemote: (post: UnifiedPost) => boolean;
  toggleRemote: (post: UnifiedPost) => Promise<void>; createGroup: (name: string) => Promise<void>; deleteGroup: (id: string) => Promise<void>;
  toggleInGroup: (groupId: string, post: UnifiedPost) => Promise<void>; exportJson: () => void; importJson: (file: File) => Promise<void>;
}
const FAVORITES_KEY = 'danbooru-viewer:favorites'; const GROUPS_KEY = 'danbooru-viewer:favorite-groups';
async function persist(favorites: UnifiedPost[], groups: FavoriteGroup[]) { await Promise.all([set(FAVORITES_KEY, favorites), set(GROUPS_KEY, groups)]); }
function credentialsFor(post: UnifiedPost): Credentials | undefined { return useSettingsStore.getState().credentials[post.source]; }
export const useFavoriteStore = create<FavoriteStore>((setState, getState) => ({
  favorites: [], groups: [], hydrated: false, remoteOverrides: {},
  hydrate: async () => setState({ favorites: await get<UnifiedPost[]>(FAVORITES_KEY) ?? [], groups: await get<FavoriteGroup[]>(GROUPS_KEY) ?? [], hydrated: true }),
  isLocal: (post) => getState().favorites.some((item) => favoriteKey(item) === favoriteKey(post)),
  isRemote: (post) => getState().remoteOverrides[favoriteKey(post)] ?? Boolean(post.isFavorited),
  toggleLocal: async (post) => { const state = getState(); const key = favoriteKey(post); const removing = state.favorites.some((item) => favoriteKey(item) === key); const favorites = removing ? state.favorites.filter((item) => favoriteKey(item) !== key) : [post, ...state.favorites]; const groups = removing ? state.groups.map((group) => ({ ...group, postKeys: group.postKeys.filter((item) => item !== key) })) : state.groups; setState({ favorites, groups }); await persist(favorites, groups); },
  toggleRemote: async (post) => { const adapter = getBooruAdapter(post.source); const credentials = credentialsFor(post); if (!credentials?.username || !credentials.apiKey || !adapter.addFavorite) throw new Error(actionMessages.favorites.remoteUnavailable); const favorited = getState().isRemote(post); if (favorited) { if (!adapter.removeFavorite) throw new Error(actionMessages.favorites.remoteRemoveUnavailable); await adapter.removeFavorite(post.id, credentials); } else await adapter.addFavorite(post.id, credentials); setState((state) => ({ remoteOverrides: { ...state.remoteOverrides, [favoriteKey(post)]: !favorited } })); },
  createGroup: async (name) => { const state = getState(); if (!name.trim()) return; const groups = [...state.groups, { id: crypto.randomUUID(), name: name.trim(), postKeys: [] }]; setState({ groups }); await persist(state.favorites, groups); },
  deleteGroup: async (id) => { const state = getState(); const groups = state.groups.filter((group) => group.id !== id); setState({ groups }); await persist(state.favorites, groups); },
  toggleInGroup: async (groupId, post) => { const state = getState(); const key = favoriteKey(post); const adding = !state.groups.find((group) => group.id === groupId)?.postKeys.includes(key); const favorites = adding && !state.favorites.some((item) => favoriteKey(item) === key) ? [post, ...state.favorites] : state.favorites; const groups = state.groups.map((group) => group.id !== groupId ? group : { ...group, postKeys: adding ? [...group.postKeys, key] : group.postKeys.filter((item) => item !== key) }); setState({ favorites, groups }); await persist(favorites, groups); },
  exportJson: () => { const state = getState(); const blob = new Blob([JSON.stringify({ version: 1, favorites: state.favorites, groups: state.groups }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'danbooru-viewer-favorites.json'; anchor.click(); URL.revokeObjectURL(url); },
  importJson: async (file) => { const data = JSON.parse(await file.text()) as { favorites?: UnifiedPost[]; groups?: FavoriteGroup[] }; if (!Array.isArray(data.favorites) || !Array.isArray(data.groups)) throw new Error(actionMessages.favorites.invalidFile); await Promise.all([del(FAVORITES_KEY), del(GROUPS_KEY)]); await persist(data.favorites, data.groups); setState({ favorites: data.favorites, groups: data.groups }); },
}));
