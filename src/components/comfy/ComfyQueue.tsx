import { ArrowDown, ArrowUp, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useComfyStore } from '../../stores/comfy-store';
import { useI18n } from '../../i18n/runtime';
import { ComfyImageViewer, ComfyTaskOutputs, ComfyTaskThumbnail, resolveComfyOutputImage, type ComfyViewerImage } from './ComfyTaskMedia';

const terminal = new Set(['completed', 'failed', 'cancelled', 'needs-confirmation']);

export function ComfyQueue() {
  const { messages: { comfy: messages } } = useI18n();
  const tasks = useComfyStore((state) => state.tasks);
  const request = useComfyStore((state) => state.request);
  const [, tick] = useState(0);
  const [viewer, setViewer] = useState<ComfyViewerImage | null>(null);
  useEffect(() => { const timer = window.setInterval(() => tick((value) => value + 1), 1000); return () => window.clearInterval(timer); }, []);
  const closeViewer = () => { if (viewer?.revokeOnClose) URL.revokeObjectURL(viewer.url); setViewer(null); };
  const openOutput = async (task: (typeof tasks)[number], output: NonNullable<(typeof tasks)[number]['outputs']>[number]) => setViewer(await resolveComfyOutputImage(output, task.serverUrl));
  return <section className="comfy-queue" aria-labelledby="comfy-queue-title"><header><div><span>{messages.serialExecution}</span><h2 id="comfy-queue-title">{messages.queue}</h2></div><strong>{messages.activeTasks(tasks.filter((task) => !terminal.has(task.status)).length)}</strong></header>
    <div className="comfy-task-list">{tasks.map((task, index) => { const waiting = task.status === 'queued' || task.status === 'waiting-for-service'; const elapsed = task.startedAt ? Math.max(0, Math.floor(((task.completedAt ?? Date.now()) - task.startedAt) / 1000)) : 0; return <article key={task.id} data-status={task.status}>
      <div className="comfy-task-index">{String(index + 1).padStart(2, '0')}</div><ComfyTaskThumbnail thumbnail={task.thumbnail} label={task.sourceLabel} onOpen={setViewer} /><div className="comfy-task-main"><div><strong>{task.sourceLabel}</strong><span>{task.status.replaceAll('-', ' ')}</span></div>
      {task.progress && <><div className="comfy-progress-label"><span>{task.progress.nodeLabel ?? task.progress.nodeId ?? task.status}</span><span>{task.progress.value} / {task.progress.max}</span></div><progress value={task.progress.value} max={task.progress.max} /></>}
      <small>{elapsed}s{task.error ? ` · ${task.error.message}` : ''}</small></div>
      <div className="comfy-icon-actions">
        <button disabled={!waiting || index === 0} title="Move up" onClick={() => void request({ type: 'COMFY_MOVE_TASK', payload: { taskId: task.id, direction: 'up' } })}><ArrowUp size={13} /></button>
        <button disabled={!waiting || index === tasks.length - 1} title="Move down" onClick={() => void request({ type: 'COMFY_MOVE_TASK', payload: { taskId: task.id, direction: 'down' } })}><ArrowDown size={13} /></button>
        {waiting ? <button title="Remove" onClick={() => void request({ type: 'COMFY_REMOVE_TASK', payload: { taskId: task.id } })}><Trash2 size={13} /></button> : !terminal.has(task.status) ? <button title="Cancel" onClick={() => { const global = Boolean(task.promptId); if (!global || window.confirm('This calls ComfyUI /interrupt and may stop other work on this instance. Continue?')) void request({ type: 'COMFY_CANCEL_TASK', payload: { taskId: task.id, allowGlobalInterrupt: global } }); }}><Square size={13} /></button> : ['failed', 'cancelled', 'needs-confirmation'].includes(task.status) && <button title="Retry frozen task" onClick={() => void request({ type: 'COMFY_RETRY_TASK', payload: { taskId: task.id } })}><RotateCcw size={13} /></button>}
      </div><ComfyTaskOutputs outputs={task.outputs} serverUrl={task.serverUrl} onOutputClick={(output) => void openOutput(task, output)} />
    </article>; })}{!tasks.length && <p className="comfy-empty">{messages.queueEmpty}</p>}</div>
    <ComfyImageViewer image={viewer} onClose={closeViewer} />
  </section>;
}
