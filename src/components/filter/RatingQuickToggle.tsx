import { ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react';
import { useFilterStore } from '../../stores/filter-store';
import type { Rating } from '../../types/post';

const ratings: { value: Rating; label: string; shortLabel: string; icon: typeof ShieldCheck }[] = [
  { value: 'g', label: 'General / Safe', shortLabel: 'Safe', icon: ShieldCheck },
  { value: 'q', label: 'Questionable', shortLabel: 'Questionable', icon: ShieldQuestion },
  { value: 'e', label: 'Explicit', shortLabel: 'Explicit', icon: ShieldX },
];

export function RatingQuickToggle() {
  const active = useFilterStore((state) => state.ratings);
  const toggle = useFilterStore((state) => state.toggleRating);
  return (
    <div className="rating-toggle" aria-label="Rating filters">
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
