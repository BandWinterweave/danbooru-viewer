export type Rating = 'g' | 's' | 'q' | 'e';
export type BooruSource = 'danbooru' | 'gelbooru' | 'safebooru' | 'yandere' | 'rule34';

export type TagCategory = 'general' | 'artist' | 'copyright' | 'character' | 'meta';

export interface TagEntry {
  name: string;
  category: TagCategory;
}

export interface UnifiedPost {
  id: number;
  source: BooruSource;
  rating: Rating;
  tags: TagEntry[];
  tagString: string;
  score: number;
  upScore: number;
  downScore: number;
  favCount: number;
  isFavorited?: boolean;
  uploader: string;
  uploaderId?: number;
  sourceUrl: string;
  imageWidth: number;
  imageHeight: number;
  fileSize: number;
  fileExt: string;
  previewUrl: string;
  sampleUrl: string;
  fileUrl: string;
  playbackUrl?: string;
  duration?: number;
  md5: string;
  createdAt: string;
  updatedAt: string;
  parentId: number | null;
  hasChildren: boolean;
  status?: 'active' | 'pending' | 'flagged' | 'deleted';
  poolIds?: number[];
  tagStringGeneral: string;
  tagStringArtist: string;
  tagStringCopyright: string;
  tagStringCharacter: string;
  tagStringMeta: string;
}

export interface PoolRecord {
  id: number;
  name: string;
  postCount: number;
}
