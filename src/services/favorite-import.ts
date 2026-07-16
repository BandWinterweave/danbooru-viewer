import type { FavoriteGroup } from '../stores/favorite-store';
import type { UnifiedPost } from '../types/post';
import { safeHttpUrl } from './safe-url';

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
  if (!record(value) || value.version !== 1 || !Array.isArray(value.favorites) || !Array.isArray(value.groups)) throw new Error('Invalid favorites file');
  if (value.favorites.length > MAX_FAVORITES || value.groups.length > MAX_GROUPS || !value.favorites.every(validatePost)) throw new Error('Favorites file exceeds limits or contains invalid posts');
  const favorites = value.favorites as UnifiedPost[];
  const favoriteKeys = new Set<string>();
  for (const post of favorites) {
    const key = `${post.source}:${post.id}`;
    if (favoriteKeys.has(key)) throw new Error('Favorites file contains duplicate posts');
    favoriteKeys.add(key);
  }
  const groupIds = new Set<string>();
  let memberships = 0;
  for (const group of value.groups) {
    if (!record(group) || !string(group.id, 128) || !group.id || !string(group.name, 100) || !group.name.trim() || !Array.isArray(group.postKeys)) throw new Error('Favorites file contains an invalid group');
    if (groupIds.has(group.id)) throw new Error('Favorites file contains duplicate groups');
    groupIds.add(group.id);
    const keys = new Set<string>();
    for (const key of group.postKeys) {
      if (!string(key, 160) || !favoriteKeys.has(key) || keys.has(key)) throw new Error('Favorites file contains invalid group relations');
      keys.add(key);
      memberships += 1;
      if (memberships > MAX_MEMBERSHIPS) throw new Error('Favorites file contains too many group relations');
    }
  }
  return { favorites, groups: value.groups as FavoriteGroup[] };
}
