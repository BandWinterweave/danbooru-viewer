import { ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react';
import { useFilterStore } from '../../stores/filter-store';
import type { Rating } from '../../types/post';
import { shellMessages } from '../../i18n/en-shell';

const ratings: { value: Rating; label: string; shortLabel: string; icon: typeof ShieldCheck }[] = [
  { value: 'g', label: shellMessages.rating.general, shortLabel: shellMessages.rating.general, icon: ShieldCheck },
  { value: 's', label: shellMessages.rating.sensitive, shortLabel: shellMessages.rating.sensitive, icon: ShieldAlert },
  { value: 'q', label: shellMessages.rating.questionable, shortLabel: shellMessages.rating.questionable, icon: ShieldQuestion },
  { value: 'e', label: shellMessages.rating.explicit, shortLabel: shellMessages.rating.explicit, icon: ShieldX },
];

export function RatingQuickToggle() {
  const active = useFilterStore((state) => state.ratings);
  const toggle = useFilterStore((state) => state.toggleRating);
  return (
    <div className="rating-toggle" aria-label={shellMessages.rating.filters}>
      {ratings.map(({ value, label, shortLabel, icon: Icon }) => (
        <button
          key={value}
          type="button"
          className={`rating-button rating-button--${value} ${active.includes(value) ? 'is-active' : ''}`}
          aria-pressed={active.includes(value)}
          title={label}
          onClick={() => toggle(value)}
        >
          <Icon size={16} /><span>{shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
