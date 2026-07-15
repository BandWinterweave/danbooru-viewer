import type { Rating } from './post';

export interface FilterChip {
  id: string;
  type: 'tag' | 'rating';
  label: string;
  value: string;
  mode: 'include' | 'exclude';
}

export interface FilterState {
  searchText: string;
  activeFilters: FilterChip[];
  ratings: Rating[];
}

export interface MetaFilter { scoreMin?: number; order?: string; dateAfter?: string; minWidth?: number; minHeight?: number }
export interface FilterPreset { id: string; name: string; sourceId: string; filters: FilterChip[]; ratings: Rating[]; meta: MetaFilter; createdAt: string }
