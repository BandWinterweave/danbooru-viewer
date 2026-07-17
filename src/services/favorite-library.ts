import type { FavoriteGroup } from '../stores/favorite-store';
import type { UnifiedPost } from '../types/post';

export type FavoriteSort = 'saved' | 'date' | 'score' | 'id';

export interface FavoriteLibraryQuery {
  search?: string;
  groupId?: string;
  source?: UnifiedPost['source'];
  rating?: UnifiedPost['rating'];
  sort?: FavoriteSort;
  direction?: 'asc' | 'desc';
}

export interface FavoriteLibraryIndex {
  groupIdsByPostKey: Map<string, Set<string>>;
  groupNamesByPostKey: Map<string, string[]>;
  ungroupedKeys: Set<string>;
}

const postKey = (post: UnifiedPost) => `${post.source}:${post.id}`;

export function indexFavoriteLibrary(favorites: UnifiedPost[], groups: FavoriteGroup[]): FavoriteLibraryIndex {
  const groupIdsByPostKey = new Map<string, Set<string>>();
  const groupNamesByPostKey = new Map<string, string[]>();
  for (const group of groups) {
    for (const key of group.postKeys) {
      const ids = groupIdsByPostKey.get(key) ?? new Set<string>();
      ids.add(group.id);
      groupIdsByPostKey.set(key, ids);
      groupNamesByPostKey.set(key, [...(groupNamesByPostKey.get(key) ?? []), group.name]);
    }
  }
  return {
    groupIdsByPostKey,
    groupNamesByPostKey,
    ungroupedKeys: new Set(favorites.map(postKey).filter((key) => !groupIdsByPostKey.has(key))),
  };
}

export function queryFavoriteLibrary(favorites: UnifiedPost[], groups: FavoriteGroup[], query: FavoriteLibraryQuery): UnifiedPost[] {
  const index = indexFavoriteLibrary(favorites, groups);
  const term = query.search?.trim().toLocaleLowerCase() ?? '';
  const filtered = favorites.filter((post) => {
    const key = postKey(post);
    if (query.groupId === 'ungrouped' && !index.ungroupedKeys.has(key)) return false;
    if (query.groupId && query.groupId !== 'all' && query.groupId !== 'ungrouped' && !index.groupIdsByPostKey.get(key)?.has(query.groupId)) return false;
    if (query.source && post.source !== query.source) return false;
    if (query.rating && post.rating !== query.rating) return false;
    if (!term) return true;
    return [post.tagString, String(post.id), post.uploader, post.sourceUrl, post.source, ...(index.groupNamesByPostKey.get(key) ?? [])]
      .some((value) => value.toLocaleLowerCase().includes(term));
  });
  if (!query.sort || query.sort === 'saved') return query.direction === 'asc' ? [...filtered].reverse() : filtered;
  const direction = query.direction === 'asc' ? 1 : -1;
  return [...filtered].sort((left, right) => {
    const difference = query.sort === 'date'
      ? Date.parse(left.createdAt) - Date.parse(right.createdAt)
      : query.sort === 'score' ? left.score - right.score : left.id - right.id;
    return difference * direction;
  });
}
