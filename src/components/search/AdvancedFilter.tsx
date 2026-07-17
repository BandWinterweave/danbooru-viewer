import { useLayoutEffect, useRef, useState } from 'react';
import type { MetaFilter } from '../../types/filter';
import { useFilterStore } from '../../stores/filter-store';
import { useUiStore } from '../../stores/ui-store';
import { useI18n } from '../../i18n/runtime';
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer';

export function AdvancedFilter({ open }: { open: boolean }) {
  const { messages: { shell: shellMessages } } = useI18n();
  const meta = useFilterStore((state) => state.meta);
  const setMeta = useFilterStore((state) => state.setMetaFilter);
  const close = useUiStore((state) => state.closeAdvancedFilters);
  const [draft, setDraft] = useState<MetaFilter>(meta);
  const ref = useRef<HTMLFormElement>(null);
  useLayoutEffect(() => { if (open) setDraft(meta); }, [meta, open]);
  useDismissibleLayer(ref, open, close);
  if (!open) return null;
  const numberValue = (value: string) => value ? Number(value) : undefined;
  return <form ref={ref} id="advanced-filters" className="advanced-filter" aria-label={shellMessages.advancedFilter.label} onSubmit={(event) => { event.preventDefault(); setMeta(draft); close(); }}>
    <label>{shellMessages.advancedFilter.minimumScore}<input type="number" value={draft.scoreMin ?? ''} onChange={(event) => setDraft((current) => ({ ...current, scoreMin: numberValue(event.target.value) }))} /></label>
    <label>{shellMessages.advancedFilter.order}<select value={draft.order ?? ''} onChange={(event) => setDraft((current) => ({ ...current, order: event.target.value || undefined }))}><option value="">{shellMessages.advancedFilter.newest}</option><option value="score">{shellMessages.advancedFilter.score}</option><option value="rank">{shellMessages.advancedFilter.trending}</option><option value="random">{shellMessages.advancedFilter.random}</option></select></label>
    <label>{shellMessages.advancedFilter.after}<input type="date" value={draft.dateAfter ?? ''} onChange={(event) => setDraft((current) => ({ ...current, dateAfter: event.target.value || undefined }))} /></label>
    <label>{shellMessages.advancedFilter.minWidth}<input type="number" min="0" value={draft.minWidth ?? ''} onChange={(event) => setDraft((current) => ({ ...current, minWidth: numberValue(event.target.value) }))} /></label>
    <label>{shellMessages.advancedFilter.minHeight}<input type="number" min="0" value={draft.minHeight ?? ''} onChange={(event) => setDraft((current) => ({ ...current, minHeight: numberValue(event.target.value) }))} /></label>
    <div className="advanced-filter-actions"><button type="button" onClick={close}>{shellMessages.advancedFilter.cancel}</button><button type="submit">{shellMessages.advancedFilter.apply}</button></div>
  </form>;
}
