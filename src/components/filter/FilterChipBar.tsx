import { BookmarkPlus, Plus, RotateCcw, X } from 'lucide-react';
import { useFilterStore } from '../../stores/filter-store';
import { useSettingsStore } from '../../stores/settings-store';
import { shellMessages } from '../../i18n/en-shell';

interface FilterChipBarProps { onAddFilter: () => void }

export function FilterChipBar({ onAddFilter }: FilterChipBarProps) {
  const filters = useFilterStore((state) => state.activeFilters);
  const ratings = useFilterStore((state) => state.ratings);
  const meta = useFilterStore((state) => state.meta);
  const setMeta = useFilterStore((state) => state.setMetaFilter);
  const remove = useFilterStore((state) => state.removeFilter);
  const toggleMode = useFilterStore((state) => state.toggleFilterMode);
  const toggleRating = useFilterStore((state) => state.toggleRating);
  const clearAll = useFilterStore((state) => state.clearAll);
  const savePreset = useFilterStore((state) => state.savePreset);
  const source = useSettingsStore((state) => state.activeSource);
  const metaEntries = Object.entries(meta).filter(([, value]) => value !== undefined && value !== '');
  const total = filters.length + ratings.length + metaEntries.length;

  return (
    <div className="filter-row">
      <div className="filter-scroll" aria-label={shellMessages.filterBar.activeFilters}>
        {!total && <span className="filter-empty">{shellMessages.filterBar.noActiveFilters}</span>}
        {filters.map((chip) => (
          <span className={`filter-chip filter-chip--${chip.mode}`} key={chip.id}>
            <button title={shellMessages.filterBar.toggleMode} onClick={() => toggleMode(chip.id)}>
              <span className="chip-sign">{chip.mode === 'include' ? '+' : '-'}</span>{chip.label}
            </button>
            <button className="chip-remove" title={shellMessages.filterBar.removeFilter(chip.label)} onClick={() => remove(chip.id)}><X size={13} /></button>
          </span>
        ))}
        {ratings.map((rating) => (
          <span className={`filter-chip filter-chip--rating-${rating}`} key={rating}>
            {shellMessages.filterBar.rating(rating === 'g' ? shellMessages.rating.safe : rating === 'q' ? shellMessages.rating.questionable : shellMessages.rating.explicit)}
            <button className="chip-remove" title={shellMessages.filterBar.removeRating} onClick={() => toggleRating(rating)}><X size={13} /></button>
          </span>
        ))}
        {metaEntries.map(([key, value]) => <span className="filter-chip filter-chip--meta" key={key}>{key}: {String(value)}<button className="chip-remove" title={shellMessages.filterBar.removeMeta(key)} onClick={() => setMeta({ [key]: undefined })}><X size={13} /></button></span>)}
      </div>
      <div className="filter-actions">
        <button className="quiet-button" onClick={onAddFilter}><Plus size={15} /> {shellMessages.filterBar.addFilter}</button>
        <button className="icon-button" disabled={!total} title={shellMessages.filterBar.clearAll} onClick={clearAll}><RotateCcw size={16} /></button>
        <button className="icon-button" disabled={!total} title={shellMessages.filterBar.saveCurrent} onClick={() => { const name = window.prompt(shellMessages.filterBar.presetName); if (name?.trim()) savePreset(name, source); }}><BookmarkPlus size={16} /></button>
      </div>
    </div>
  );
}
