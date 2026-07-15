import { useFilterStore } from '../../stores/filter-store';
import { useEffect } from 'react';
import { useSettingsStore } from '../../stores/settings-store';

export function AdvancedFilter({ open }: { open: boolean }) {
  const meta = useFilterStore((state) => state.meta);
  const setMeta = useFilterStore((state) => state.setMetaFilter);
  const source = useSettingsStore((state) => state.activeSource);
  const authenticated = useSettingsStore((state) => Boolean(state.credentials[state.activeSource]?.username && state.credentials[state.activeSource]?.apiKey));
  useEffect(() => { if (source === 'danbooru' && !authenticated && meta.order) setMeta({ order: undefined }); }, [authenticated, meta.order, setMeta, source]);
  if (!open) return null;
  return <div className="advanced-filter" aria-label="Advanced filters">
    <label>Minimum score<input type="number" value={meta.scoreMin ?? ''} onChange={(event) => setMeta({ scoreMin: event.target.value ? Number(event.target.value) : undefined })} /></label>
    <label>Order<select value={meta.order ?? ''} onChange={(event) => setMeta({ order: event.target.value || undefined })}><option value="">Newest</option><option value="score" disabled={source === 'danbooru' && !authenticated}>Score</option><option value="random" disabled={source === 'danbooru' && !authenticated}>Random</option></select></label>
    <label>After<input type="date" value={meta.dateAfter ?? ''} onChange={(event) => setMeta({ dateAfter: event.target.value || undefined })} /></label>
    <label>Min width<input type="number" min="0" value={meta.minWidth ?? ''} onChange={(event) => setMeta({ minWidth: event.target.value ? Number(event.target.value) : undefined })} /></label>
    <label>Min height<input type="number" min="0" value={meta.minHeight ?? ''} onChange={(event) => setMeta({ minHeight: event.target.value ? Number(event.target.value) : undefined })} /></label>
  </div>;
}
