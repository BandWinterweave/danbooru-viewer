import type { FavoriteGroup } from '../stores/favorite-store';
import type { UnifiedPost } from '../types/post';
import { safeHttpUrl } from './safe-url';
import { getMessages } from '../i18n/runtime-core';

export const MAX_FAVORITE_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_FAVORITES = 10_000;
const MAX_GROUPS = 500;
const MAX_MEMBERSHIPS = 100_000;
const MAX_TAGS = 2_000;
const MAX_STRING = 4096;
const SOURCES = new Set(['danbooru', 'gelbooru', 'safebooru', 'yandere', 'rule34']);
const RATINGS = new Set(['g', 's', 'q', 'e']);
const CATEGORIES = new Set(['general', 'artist', 'copyright', 'character', 'meta']);
const STATUSES = new Set(['active', 'pending', 'flagged', 'deleted']);

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function string(value: unknown, max = MAX_STRING): value is string { return typeof value === 'string' && value.length <= max; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function nonNegative(value: unknown): value is number { return finite(value) && value >= 0; }
function safeId(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) > 0; }
function date(value: unknown) { return string(value, 64) && !Number.isNaN(Date.parse(value)); }
function url(value: unknown, optional = false) { return string(value) && (value === '' ? optional : Boolean(safeHttpUrl(value))); }

function validatePost(value: unknown): value is UnifiedPost {
  if (!record(value) || !safeId(value.id) || !SOURCES.has(String(value.source)) || !RATINGS.has(String(value.rating))) return false;
  if (!Array.isArray(value.tags) || value.tags.length > MAX_TAGS || !value.tags.every((tag) => record(tag) && string(tag.name, 256) && CATEGORIES.has(String(tag.category)))) return false;
  const strings = ['tagString', 'uploader', 'fileExt', 'md5', 'tagStringGeneral', 'tagStringArtist', 'tagStringCopyright', 'tagStringCharacter', 'tagStringMeta'];
  if (!strings.every((key) => string(value[key], key.startsWith('tagString') ? 262_144 : key === 'fileExt' ? 16 : 256))) return false;
  if (!url(value.sourceUrl, true) || !url(value.previewUrl, true) || !url(value.sampleUrl, true) || !url(value.fileUrl, true) || (value.playbackUrl !== undefined && !url(value.playbackUrl))) return false;
  if (!finite(value.score) || !finite(value.upScore) || !finite(value.downScore) || !nonNegative(value.favCount) || !nonNegative(value.imageWidth) || !nonNegative(value.imageHeight) || !nonNegative(value.fileSize)) return false;
  if (!date(value.createdAt) || !date(value.updatedAt) || !(value.parentId === null || safeId(value.parentId)) || typeof value.hasChildren !== 'boolean') return false;
  if (value.isFavorited !== undefined && typeof value.isFavorited !== 'boolean') return false;
  if (value.uploaderId !== undefined && !safeId(value.uploaderId)) return false;
  if (value.duration !== undefined && !nonNegative(value.duration)) return false;
  if (value.status !== undefined && !STATUSES.has(String(value.status))) return false;
  if (value.poolIds !== undefined && (!Array.isArray(value.poolIds) || value.poolIds.length > MAX_TAGS || !value.poolIds.every(safeId))) return false;
  return true;
}

export function parseFavoriteImport(value: unknown): { favorites: UnifiedPost[]; groups: FavoriteGroup[] } {
  const messages = getMessages().domainActions.import;
  if (!record(value) || value.version !== 1 || !Array.isArray(value.favorites) || !Array.isArray(value.groups)) throw new Error(messages.invalidFile);
  if (value.favorites.length > MAX_FAVORITES || value.groups.length > MAX_GROUPS || !value.favorites.every(validatePost)) throw new Error(messages.invalidPosts);
  const favorites = value.favorites as UnifiedPost[];
  const favoriteKeys = new Set<string>();
  for (const post of favorites) {
    const key = `${post.source}:${post.id}`;
    if (favoriteKeys.has(key)) throw new Error(messages.duplicatePosts);
    favoriteKeys.add(key);
  }
  const groupIds = new Set<string>();
  let memberships = 0;
  for (const group of value.groups) {
    if (!record(group) || !string(group.id, 128) || !group.id || !string(group.name, 100) || !group.name.trim() || !Array.isArray(group.postKeys)) throw new Error(messages.invalidGroup);
    if (groupIds.has(group.id)) throw new Error(messages.duplicateGroups);
    groupIds.add(group.id);
    const keys = new Set<string>();
    for (const key of group.postKeys) {
      if (!string(key, 160) || !favoriteKeys.has(key) || keys.has(key)) throw new Error(messages.invalidRelations);
      keys.add(key);
      memberships += 1;
      if (memberships > MAX_MEMBERSHIPS) throw new Error(messages.tooManyRelations);
    }
  }
  return { favorites, groups: value.groups as FavoriteGroup[] };
}

export type FavoriteData = ReturnType<typeof parseFavoriteImport>;
export type FavoriteImportMode = 'merge' | 'replace';

export interface FavoriteImportPreview {
  baseline: string;
  importedFavorites: number;
  importedGroups: number;
  addedFavorites: number;
  updatedFavorites: number;
  addedGroups: number;
  mergedGroups: number;
  resultFavorites: number;
  resultGroups: number;
  replacedFavorites: number;
  replacedGroups: number;
}

const keyFor = (post: UnifiedPost) => `${post.source}:${post.id}`;

export function favoriteDataRevision(data: FavoriteData): string {
  const canonical = JSON.stringify({
    favorites: data.favorites.map(keyFor),
    groups: data.groups.map((group) => ({ id: group.id, name: group.name, postKeys: group.postKeys })),
  });
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < canonical.length; index += 1) {
    const code = canonical.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

export function mergeFavoriteImports(current: FavoriteData, imported: FavoriteData): FavoriteData {
  const importedPosts = new Map(imported.favorites.map((post) => [keyFor(post), post]));
  const currentKeys = new Set(current.favorites.map(keyFor));
  const favorites = current.favorites.map((post) => importedPosts.get(keyFor(post)) ?? post);
  favorites.push(...imported.favorites.filter((post) => !currentKeys.has(keyFor(post))));

  const importedGroups = new Map(imported.groups.map((group) => [group.id, group]));
  const currentGroupIds = new Set(current.groups.map((group) => group.id));
  const groups = current.groups.map((group) => {
    const incoming = importedGroups.get(group.id);
    return incoming ? { ...group, postKeys: [...new Set([...group.postKeys, ...incoming.postKeys])] } : group;
  });
  groups.push(...imported.groups.filter((group) => !currentGroupIds.has(group.id)));
  return parseFavoriteImport({ version: 1, favorites, groups });
}

export function previewFavoriteImport(current: FavoriteData, imported: FavoriteData): FavoriteImportPreview {
  const currentKeys = new Set(current.favorites.map(keyFor));
  const currentGroupIds = new Set(current.groups.map((group) => group.id));
  const merged = mergeFavoriteImports(current, imported);
  return {
    baseline: favoriteDataRevision(current),
    importedFavorites: imported.favorites.length,
    importedGroups: imported.groups.length,
    addedFavorites: imported.favorites.filter((post) => !currentKeys.has(keyFor(post))).length,
    updatedFavorites: imported.favorites.filter((post) => currentKeys.has(keyFor(post))).length,
    addedGroups: imported.groups.filter((group) => !currentGroupIds.has(group.id)).length,
    mergedGroups: imported.groups.filter((group) => currentGroupIds.has(group.id)).length,
    resultFavorites: merged.favorites.length,
    resultGroups: merged.groups.length,
    replacedFavorites: current.favorites.length,
    replacedGroups: current.groups.length,
  };
}

export async function parseFavoriteImportFile(file: File): Promise<FavoriteData> {
  if (file.size > MAX_FAVORITE_IMPORT_BYTES) throw new Error(getMessages().domainActions.favorites.invalidFile);
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error(getMessages().domainActions.favorites.invalidFile); }
  return parseFavoriteImport(parsed);
}
