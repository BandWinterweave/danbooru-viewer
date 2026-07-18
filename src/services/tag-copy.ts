import type { TagCategory, TagEntry, UnifiedPost } from '../types/post';

const categoryOrder: TagCategory[] = ['artist', 'character', 'copyright', 'general', 'meta'];

export interface TagCopyOptions {
  categories: TagCategory[];
  useUnderscores: boolean;
  escapeParentheses: boolean;
}

export function formatTagForCopy(tag: TagEntry, options: Pick<TagCopyOptions, 'useUnderscores' | 'escapeParentheses'> & Partial<Pick<TagCopyOptions, 'categories'>>) {
  let value = options.useUnderscores ? tag.name : tag.name.replaceAll('_', ' ');
  if (options.escapeParentheses) value = value.replace(/[()]/g, (character) => `\\${character}`);
  return value;
}

export function formatTagsForCopy(post: UnifiedPost, options: TagCopyOptions) {
  return categoryOrder.flatMap((category) => post.tags
    .filter((tag) => tag.category === category && options.categories.includes(category))
    .map((tag) => formatTagForCopy(tag, options)!)).join(', ');
}
