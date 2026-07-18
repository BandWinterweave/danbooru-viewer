import type { SearchQuery } from '../../types/api';
import type { BooruSource, Rating } from '../../types/post';

const ratingValues: Record<BooruSource, Partial<Record<Rating, string>>> = {
  danbooru: { g: 'g', s: 's', q: 'q', e: 'e' },
  gelbooru: { g: 'general', s: 'sensitive', q: 'questionable', e: 'explicit' },
  safebooru: { g: 'general', s: 'safe', q: 'questionable', e: 'explicit' },
  yandere: { g: 's', s: 's', q: 'q', e: 'e' },
  rule34: { g: 'general', s: 'sensitive', q: 'questionable', e: 'explicit' },
};

export function buildSourceTags(source: BooruSource, query: SearchQuery): string {
  const mappedRatings = [...new Set((query.ratings ?? []).map((rating) => ratingValues[source][rating]).filter((rating): rating is string => Boolean(rating)))];
  const availableRatings = new Set(Object.values(ratingValues[source]));
  const rating = mappedRatings.length && mappedRatings.length < availableRatings.size
    ? mappedRatings.map((value) => `rating:${value}`).join(' OR ')
    : '';
  const terms = [
    query.tags?.trim(),
    rating,
    query.scoreMin !== undefined
      ? `score:>=${query.scoreMin}`
      : source === 'danbooru' && query.order === 'score' && !query.tags?.trim() ? 'score:>50' : '',
    source === 'danbooru' && query.dateAfter ? `date:>=${query.dateAfter}` : '',
    query.minWidth ? `width:>=${query.minWidth}` : '',
    query.minHeight ? `height:>=${query.minHeight}` : '',
    source === 'danbooru' && query.order === 'random' ? 'age:<1month' : '',
  ];
  if (query.order) {
    terms.push(source === 'gelbooru' || source === 'safebooru' || source === 'rule34'
      ? `sort:${query.order === 'rank' ? 'updated' : query.order}:desc`
      : `order:${query.order}`);
  }
  return terms.filter(Boolean).join(' ');
}
