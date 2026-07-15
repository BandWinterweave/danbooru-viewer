import { useFilterStore } from '../../stores/filter-store';

export function AdvancedFilter({ open }: { open: boolean }) {
  const meta = useFilterStore((state) => state.meta);
  const setMeta = useFilterStore((state) => state.setMetaFilter);
  if (!open) return null;
  return <div className="advanced-filter" aria-label="Advanced filters">
    <label>Minimum score<input type="number" value={meta.scoreMin ?? ''} onChange={(event) => setMeta({ scoreMin: event.target.value ? Number(event.target.value) : undefined })} /></label>
    <label>Order<select value={meta.order ?? ''} onChange={(event) => setMeta({ order: event.target.value || undefined })}><option value="">Newest</option><option value="score">Score</option><option value="rank">Trending</option><option value="random">Random</option></select></label>
    <label>After<input type="date" value={meta.dateAfter ?? ''} onChange={(event) => setMeta({ dateAfter: event.target.value || undefined })} /></label>
    <label>Min width<input type="number" min="0" value={meta.minWidth ?? ''} onChange={(event) => setMeta({ minWidth: event.target.value ? Number(event.target.value) : undefined })} /></label>
    <label>Min height<input type="number" min="0" value={meta.minHeight ?? ''} onChange={(event) => setMeta({ minHeight: event.target.value ? Number(event.target.value) : undefined })} /></label>
  </div>;
}
