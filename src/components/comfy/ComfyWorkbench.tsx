import { AlertTriangle, History, ListOrdered, Workflow, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useComfyStore } from '../../stores/comfy-store';
import { ComfyHistory } from './ComfyHistory';
import { ComfyQueue } from './ComfyQueue';
import { LocalInputDropzone } from './LocalInputDropzone';
import { WorkflowManager } from './WorkflowManager';
import { useI18n } from '../../i18n/runtime';
import { useUiStore } from '../../stores/ui-store';

export function ComfyWorkbench() {
  const { messages: { comfy: messages } } = useI18n();
  const hydrate = useComfyStore((state) => state.hydrate);
  const hydrated = useComfyStore((state) => state.hydrated);
  const serviceOnline = useComfyStore((state) => state.serviceOnline);
  const error = useComfyStore((state) => state.error);
  const workflows = useComfyStore((state) => state.workflows);
  const refresh = useComfyStore((state) => state.refresh);
  const open = useUiStore((state) => state.comfyOpen);
  const close = useUiStore((state) => state.closeComfy);
  const [tab, setTab] = useState<'queue' | 'workflows' | 'history'>('queue');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) void hydrate(); }, [hydrate, open]);
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => window.clearInterval(timer);
  }, [open, refresh]);
  useEffect(() => { if (open && workflows.length === 0) setTab('workflows'); }, [open, workflows.length]);
  useEffect(() => {
    if (!open) return;
    const trigger = useUiStore.getState().comfyTrigger;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    window.addEventListener('keydown', escape);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('keydown', escape); window.requestAnimationFrame(() => trigger?.focus()); };
  }, [close, open]);
  if (!open) return null;
  return <><button className="comfy-workbench-scrim" aria-label="Close ComfyUI workbench" onClick={close} /><section className="comfy-workbench-dialog" role="dialog" aria-modal="true" aria-labelledby="comfy-workbench-title">
    <div className="comfy-workbench">
    <header className="comfy-workbench-header"><div><span>LOCAL PIPELINE / 127.0.0.1</span><h1 id="comfy-workbench-title">{messages.workbench}</h1></div><div className="comfy-workbench-status"><div className={`comfy-service-state ${serviceOnline ? 'is-online' : ''}`}><span />{serviceOnline === null ? messages.checking : serviceOnline ? messages.connected : messages.waiting}</div><button ref={closeRef} className="icon-button" title="Close" onClick={close}><X size={17} /></button></div></header>
    {error && <div className="comfy-alert" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}
    <nav className="comfy-tabs" aria-label={messages.workbench}><button className={tab === 'queue' ? 'is-active' : ''} onClick={() => setTab('queue')}><ListOrdered size={15} /> {messages.queue}</button><button className={tab === 'workflows' ? 'is-active' : ''} onClick={() => setTab('workflows')}><Workflow size={15} /> {messages.workflows}</button><button className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}><History size={15} /> {messages.history}</button></nav>
    {!hydrated && <p className="comfy-loading-state">{messages.loading}</p>}
    {tab === 'queue' ? <><LocalInputDropzone /><ComfyQueue /></> : tab === 'workflows' ? <WorkflowManager /> : <ComfyHistory />}
  </div></section></>;
}
