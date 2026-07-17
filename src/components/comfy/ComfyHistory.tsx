import { ChevronDown, ChevronRight, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ComfyHistoryRecord, ComfyOutputReference } from '../../services/comfy/types';
import { useComfyStore } from '../../stores/comfy-store';
import { useI18n } from '../../i18n/runtime';
import { ComfyImageViewer, ComfyTaskOutputs, ComfyTaskThumbnail, historyThumbnail, resolveComfyOutputImage, type ComfyViewerImage } from './ComfyTaskMedia';

export function ComfyHistory() {
  const { messages: { comfy: messages } } = useI18n();
  const history = useComfyStore((state) => state.history);
  const loadHistory = useComfyStore((state) => state.loadHistory);
  const request = useComfyStore((state) => state.request);
  const [viewer, setViewer] = useState<ComfyViewerImage | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    void loadHistory();
    const timer = window.setInterval(() => void loadHistory(), 2000);
    return () => window.clearInterval(timer);
  }, [loadHistory]);
  const view = async (record: ComfyHistoryRecord, output: ComfyOutputReference) => {
    setViewer(await resolveComfyOutputImage(output, record.task.serverUrl));
  };
  const close = () => { if (viewer?.revokeOnClose) URL.revokeObjectURL(viewer.url); setViewer(null); };
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <section className="comfy-history" aria-labelledby="comfy-history-title"><header><div><span>{messages.localRecords}</span><h2 id="comfy-history-title">{messages.history}</h2></div>{history.length > 0 && <button className="secondary-button" onClick={() => { if (window.confirm('Clear local ComfyUI history and cached outputs?')) void request({ type: 'COMFY_CLEAR_HISTORY' }).then(loadHistory); }}><Trash2 size={14} /> {messages.clear}</button>}</header>
    <div className="comfy-history-list">{history.map((record) => { const open = expanded.has(record.id); const outputs = record.outputs.map((output) => ({ ...output, nodeTitle: output.nodeTitle || record.task.workflow[output.nodeId]?._meta?.title || record.task.workflow[output.nodeId]?.class_type })); return <article className={open ? 'is-expanded' : ''} key={record.id}><div className="comfy-history-summary"><button className="comfy-history-toggle" aria-expanded={open} title={open ? 'Collapse outputs' : 'Expand outputs'} onClick={() => toggle(record.id)}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button><ComfyTaskThumbnail thumbnail={historyThumbnail(record.task)} label={record.task.sourceLabel} onOpen={setViewer} /><div><strong>{record.task.sourceLabel}</strong><span>{record.task.status.replaceAll('-', ' ')} · {new Date(record.completedAt).toLocaleString()}</span></div><div className="comfy-icon-actions"><button title="Run again" onClick={() => void request({ type: 'COMFY_RETRY_TASK', payload: { taskId: record.task.id } })}><RotateCcw size={13} /></button><button title="Delete history" onClick={() => void request({ type: 'COMFY_DELETE_HISTORY', payload: { historyId: record.id } }).then(loadHistory)}><Trash2 size={13} /></button></div></div>{open && <ComfyTaskOutputs outputs={outputs} serverUrl={record.task.serverUrl} onOutputClick={(output) => void view(record, output)} />}</article>; })}{!history.length && <p className="comfy-empty">{messages.historyEmpty}</p>}</div>
    <ComfyImageViewer image={viewer} onClose={close} />
  </section>;
}
