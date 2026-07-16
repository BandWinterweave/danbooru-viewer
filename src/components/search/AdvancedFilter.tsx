import { useFilterStore } from '../../stores/filter-store';
import { shellMessages } from '../../i18n/en-shell';

export function AdvancedFilter({ open }: { open: boolean }) {
  const meta = useFilterStore((state) => state.meta);
  const setMeta = useFilterStore((state) => state.setMetaFilter);
  if (!open) return null;
  return <div className="advanced-filter" aria-label={shellMessages.advancedFilter.label}>
    <label>{shellMessages.advancedFilter.minimumScore}<input type="number" value={meta.scoreMin ?? ''} onChange={(event) => setMeta({ scoreMin: event.target.value ? Number(event.target.value) : undefined })} /></label>
    <label>{shellMessages.advancedFilter.order}<select value={meta.order ?? ''} onChange={(event) => setMeta({ order: event.target.value || undefined })}><option value="">{shellMessages.advancedFilter.newest}</option><option value="score">{shellMessages.advancedFilter.score}</option><option value="rank">{shellMessages.advancedFilter.trending}</option><option value="random">{shellMessages.advancedFilter.random}</option></select></label>
    <label>{shellMessages.advancedFilter.after}<input type="date" value={meta.dateAfter ?? ''} onChange={(event) => setMeta({ dateAfter: event.target.value || undefined })} /></label>
    <label>{shellMessages.advancedFilter.minWidth}<input type="number" min="0" value={meta.minWidth ?? ''} onChange={(event) => setMeta({ minWidth: event.target.value ? Number(event.target.value) : undefined })} /></label>
    <label>{shellMessages.advancedFilter.minHeight}<input type="number" min="0" value={meta.minHeight ?? ''} onChange={(event) => setMeta({ minHeight: event.target.value ? Number(event.target.value) : undefined })} /></label>
  </div>;
}
