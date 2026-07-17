import { ArrowDown, ArrowUp, Copy, Download, FileUp, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useComfyStore } from '../../stores/comfy-store';
import { parseApiWorkflowJson } from '../../services/comfy/workflow';
import type { ComfyOption } from '../../services/comfy/types';
import { useI18n } from '../../i18n/runtime';

export function WorkflowManager() {
  const { messages: { comfy: messages } } = useI18n();
  const workflows = useComfyStore((state) => state.workflows);
  const request = useComfyStore((state) => state.request);
  const busy = useComfyStore((state) => state.busy);
  const fileRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<ComfyOption[]>([]);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const active = workflows.find((workflow) => workflow.active);

  useEffect(() => {
    if (!active) { setOptions([]); return; }
    let cancelled = false;
    void request<{ name: string; apiJson: string }>({ type: 'COMFY_EXPORT_WORKFLOW', payload: { workflowId: active.id } }).then((data) => {
      if (!cancelled) { setOptions(parseApiWorkflowJson(data.apiJson, active.name).options); setValues(active.options); }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [active?.id, active?.updatedAt, request]);

  const importFile = async (file: File) => {
    await request({ type: 'COMFY_IMPORT_WORKFLOW', payload: { name: file.name.replace(/\.json$/i, ''), apiJson: await file.text() } });
  };
  const exportWorkflow = async (id: string) => {
    const data = await request<{ name: string; apiJson: string }>({ type: 'COMFY_EXPORT_WORKFLOW', payload: { workflowId: id } });
    const url = URL.createObjectURL(new Blob([data.apiJson], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = data.name; anchor.click(); URL.revokeObjectURL(url);
  };

  return <section className="comfy-workflows" aria-labelledby="comfy-workflows-title">
    <header><div><span>API JSON</span><h2 id="comfy-workflows-title">{messages.workflows}</h2></div><button className="primary-button" onClick={() => fileRef.current?.click()}><FileUp size={15} /> {messages.import}</button></header>
    <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''; }} />
    <div className="comfy-workflow-list">
      {workflows.map((workflow, index) => <div className={workflow.active ? 'is-active' : ''} key={workflow.id}>
        <button className="comfy-workflow-name" onClick={() => void request({ type: 'COMFY_ACTIVATE_WORKFLOW', payload: { workflowId: workflow.id } })}><span>{workflow.active ? messages.active : messages.preset}</span><strong>{workflow.name}</strong></button>
        <div className="comfy-icon-actions">
          <button disabled={index === 0} title="Move up" onClick={() => void request({ type: 'COMFY_MOVE_WORKFLOW', payload: { workflowId: workflow.id, direction: 'up' } })}><ArrowUp size={13} /></button>
          <button disabled={index === workflows.length - 1} title="Move down" onClick={() => void request({ type: 'COMFY_MOVE_WORKFLOW', payload: { workflowId: workflow.id, direction: 'down' } })}><ArrowDown size={13} /></button>
          <button title="Rename" onClick={() => { const name = window.prompt('Workflow name', workflow.name); if (name?.trim()) void request({ type: 'COMFY_RENAME_WORKFLOW', payload: { workflowId: workflow.id, name } }); }}><Pencil size={13} /></button>
          <button title="Duplicate" onClick={() => void request({ type: 'COMFY_DUPLICATE_WORKFLOW', payload: { workflowId: workflow.id, name: `${workflow.name} copy` } })}><Copy size={13} /></button>
          <button title="Export" onClick={() => void exportWorkflow(workflow.id)}><Download size={13} /></button>
          <button title="Delete" disabled={workflow.active && workflows.length > 1} onClick={() => { if (window.confirm(`Delete workflow “${workflow.name}”?`)) void request({ type: 'COMFY_DELETE_WORKFLOW', payload: { workflowId: workflow.id } }); }}><Trash2 size={13} /></button>
        </div>
      </div>)}
      {!workflows.length && <p className="comfy-empty">{messages.importEmpty}</p>}
    </div>
    {active && options.length > 0 && <form className="comfy-options" onSubmit={(event) => { event.preventDefault(); void request({ type: 'COMFY_SAVE_WORKFLOW_OPTIONS', payload: { workflowId: active.id, options: values } }); }}>
      <h3>{messages.workflowOptions}</h3>
      {options.map((option) => <label key={option.nodeId}>{option.title}<input type={option.kind === 'integer' ? 'number' : 'text'} step={option.kind === 'integer' ? 1 : undefined} value={values[option.nodeId] ?? option.value} onChange={(event) => setValues((current) => ({ ...current, [option.nodeId]: option.kind === 'integer' ? Number(event.target.value) : event.target.value }))} /></label>)}
      <button className="secondary-button" disabled={busy}>{messages.saveOptions}</button>
    </form>}
  </section>;
}
