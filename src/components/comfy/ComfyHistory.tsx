import { ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ComfyHistoryRecord, ComfyOutputResponse } from '../../services/comfy/types';
import { useComfyStore } from '../../stores/comfy-store';
import { useI18n } from '../../i18n/runtime';
import { ComfyImageViewer, ComfyTaskOutputs, ComfyTaskThumbnail, historyThumbnail, type ComfyViewerImage } from './ComfyTaskMedia';

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ${seconds % 60}s`;
}

export function ComfyHistory() {
  const { messages: { comfy: messages } } = useI18n();
  const history = useComfyStore((state) => state.history);
  const loadHistory = useComfyStore((state) => state.loadHistory);
  const request = useComfyStore((state) => state.request);
  const [viewer, setViewer] = useState<ComfyViewerImage | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const viewRequest = useRef(0);
  useEffect(() => {
    void loadHistory();
    const timer = window.setInterval(() => void loadHistory(), 2000);
    return () => window.clearInterval(timer);
  }, [loadHistory]);
  useEffect(() => () => { viewRequest.current += 1; }, []);
  useEffect(() => () => { if (viewer?.revokeOnClose) URL.revokeObjectURL(viewer.url); }, [viewer]);
  const view = async (record: ComfyHistoryRecord, outputIndex: number) => {
    const id = ++viewRequest.current;
    try {
      const result = await request<ComfyOutputResponse>({ type: 'COMFY_GET_OUTPUT', payload: { historyId: record.id, outputIndex } });
      if (id !== viewRequest.current) return;
      const url = result.blob ? URL.createObjectURL(result.blob) : result.url;
      setViewer(url ? { url, label: result.output.nodeTitle || result.output.nodeId, revokeOnClose: Boolean(result.blob) } : null);
    } catch { /* The workbench-level alert reports request failures. */ }
  };
  const close = () => { viewRequest.current += 1; setViewer(null); };
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <section className="comfy-history" aria-labelledby="comfy-history-title"><header><div><span>{messages.localRecords}</span><h2 id="comfy-history-title">{messages.history}</h2></div>{history.length > 0 && <button className="secondary-button" onClick={() => { if (window.confirm('Clear local ComfyUI history and cached outputs?')) void request({ type: 'COMFY_CLEAR_HISTORY' }).then(loadHistory); }}><Trash2 size={14} /> {messages.clear}</button>}</header>
    <div className="comfy-history-list">{history.map((record) => { const open = expanded.has(record.id); const duration = record.task.startedAt ? formatDuration(record.completedAt - record.task.startedAt) : null; const outputs = record.outputs.map((output) => ({ ...output, nodeTitle: output.nodeTitle || record.task.workflow[output.nodeId]?._meta?.title || record.task.workflow[output.nodeId]?.class_type })); const failed = record.task.status === 'failed' || record.task.status === 'needs-confirmation'; const status = record.task.status === 'completed' ? messages.historyCompleted : record.task.status === 'cancelled' ? messages.historyCancelled : messages.historyFailed(record.task.error?.message); return <article className={open ? 'is-expanded' : ''} key={record.id}><div className="comfy-history-summary"><button className="comfy-history-toggle" aria-expanded={open} title={open ? 'Collapse outputs' : 'Expand outputs'} onClick={() => toggle(record.id)}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button><ComfyTaskThumbnail thumbnail={historyThumbnail(record.task)} label={record.task.sourceLabel} onOpen={setViewer} /><div><strong>{record.task.sourceLabel}</strong><span><b className={`comfy-history-status ${failed ? 'is-failed' : record.task.status === 'cancelled' ? 'is-cancelled' : 'is-completed'}`}>{status}</b> · {new Date(record.completedAt).toLocaleString()}{duration && ` · ${duration}`}</span></div><div className="comfy-icon-actions"><button title="Run again" onClick={() => void request({ type: 'COMFY_RETRY_TASK', payload: { taskId: record.task.id } })}><RotateCcw size={13} /></button><button title="Delete history" onClick={() => void request({ type: 'COMFY_DELETE_HISTORY', payload: { historyId: record.id } }).then(loadHistory)}><Trash2 size={13} /></button></div></div>{open && <ComfyTaskOutputs outputs={outputs} serverUrl={record.task.serverUrl} onOutputClick={(_, outputIndex) => void view(record, outputIndex)} />}</article>; })}{!history.length && <p className="comfy-empty">{messages.historyEmpty}</p>}</div>
    <ComfyImageViewer image={viewer} onClose={close} />
  </section>;
}
