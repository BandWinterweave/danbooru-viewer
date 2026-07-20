import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { displayImageUrl } from '../../services/api/image-url';
import { ComfyClient } from '../../services/comfy/client';
import { ComfyStorage } from '../../services/comfy/storage';
import type { ComfyOutputReference, ComfyTaskSummary } from '../../services/comfy/types';
import { CachedImage } from '../posts/CachedImage';

export function historyThumbnail(task: { input: { kind: 'post'; post: { previewUrl: string; sampleUrl: string; fileUrl: string } } | { kind: 'blob'; blobKey: string } }): ComfyTaskSummary['thumbnail'] {
  return task.input.kind === 'post'
    ? {
        kind: 'url',
        url: task.input.post.previewUrl || task.input.post.sampleUrl || task.input.post.fileUrl,
        viewUrl: task.input.post.fileUrl || task.input.post.sampleUrl || task.input.post.previewUrl,
      }
    : { kind: 'blob', blobKey: task.input.blobKey };
}

export interface ComfyViewerImage { url: string; label: string; previewUrl?: string; revokeOnClose?: boolean }

export function ComfyImageViewer({ image, onClose }: { image: ComfyViewerImage | null; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const lastPoint = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!image) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [image, onClose]);
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setLoaded(false);
    setDragging(false);
  }, [image?.url]);
  if (!image) return null;
  const transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };
  return createPortal(<div className="comfy-output-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`comfy-output-viewer${dragging ? ' is-dragging' : ''}`} role="dialog" aria-modal="true" aria-label={image.label} onWheel={(event) => setScale((current) => Math.min(20, Math.max(.1, current * Math.exp(-event.deltaY * .0015))))} onDoubleClick={reset} onPointerDown={(event) => { if ((event.target as HTMLElement).closest('button')) return; setDragging(true); lastPoint.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!dragging) return; const dx = event.clientX - lastPoint.current.x; const dy = event.clientY - lastPoint.current.y; lastPoint.current = { x: event.clientX, y: event.clientY }; setOffset((current) => ({ x: current.x + dx, y: current.y + dy })); }} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}><button className="icon-button" title="Close" autoFocus onClick={onClose}><X size={17} /></button>{!loaded && <span className="comfy-viewer-loading"><LoaderCircle className="spin" size={24} /></span>}{image.previewUrl && image.previewUrl !== image.url && <img className={`comfy-viewer-preview${loaded ? ' is-replaced' : ''}`} src={image.previewUrl} alt="" aria-hidden="true" draggable={false} style={{ transform }} />}<CachedImage className={`comfy-viewer-full${loaded ? ' is-loaded' : ''}`} src={image.url} alt={image.label} draggable={false} onLoad={() => setLoaded(true)} style={{ transform }} /></section></div>, document.body);
}

export function ComfyTaskThumbnail({ thumbnail, label, onOpen }: { thumbnail?: ComfyTaskSummary['thumbnail']; label: string; onOpen?: (image: ComfyViewerImage) => void }) {
  const [blobUrl, setBlobUrl] = useState('');
  const blobKey = thumbnail?.kind === 'blob' ? thumbnail.blobKey : '';
  useEffect(() => {
    if (!blobKey) { setBlobUrl(''); return; }
    let active = true;
    let url = '';
    void new ComfyStorage().getBlob(blobKey, 'input').then((record) => {
      if (!active || !record) return;
      url = URL.createObjectURL(record.blob);
      setBlobUrl(url);
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [blobKey]);
  const src = thumbnail?.kind === 'url' ? displayImageUrl(thumbnail.url) : blobUrl;
  const viewUrl = thumbnail?.kind === 'url' ? displayImageUrl(thumbnail.viewUrl || thumbnail.url) : src;
  return <div className="comfy-task-thumbnail">{src ? <button title={`View ${label}`} onClick={() => onOpen?.({ url: viewUrl, previewUrl: src, label })}><CachedImage src={src} alt={label} /></button> : <span>NO PREVIEW</span>}</div>;
}

export function comfyOutputName(output: ComfyOutputReference) {
  const title = (output.nodeTitle || output.nodeId).trim();
  const suffix = title.replace(/^OUTPUT/i, '').trim();
  return suffix || output.nodeId;
}

const outputCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortOutputs(outputs: Array<{ output: ComfyOutputReference; index: number }>) {
  return [...outputs].sort((left, right) => outputCollator.compare(comfyOutputName(left.output), comfyOutputName(right.output)) || left.output.nodeId.localeCompare(right.output.nodeId));
}

export async function resolveComfyOutputImage(output: ComfyOutputReference, serverUrl: string): Promise<ComfyViewerImage | null> {
  if (output.blobKey) {
    const cached = await new ComfyStorage().getBlob(output.blobKey, 'output');
    if (cached) return { url: URL.createObjectURL(cached.blob), label: comfyOutputName(output), revokeOnClose: true };
  }
  if (!output.filename) return null;
  return { url: new ComfyClient(serverUrl).getViewUrl({ filename: output.filename, subfolder: output.subfolder, type: output.type }).toString(), label: comfyOutputName(output) };
}

function OutputImage({ output, outputIndex, serverUrl, onClick }: { output: ComfyOutputReference; outputIndex: number; serverUrl: string; onClick?: (output: ComfyOutputReference, outputIndex: number) => void }) {
  const [blobUrl, setBlobUrl] = useState('');
  useEffect(() => {
    if (!output.blobKey) { setBlobUrl(''); return; }
    let active = true;
    let url = '';
    void new ComfyStorage().getBlob(output.blobKey, 'output').then((record) => {
      if (!active || !record) return;
      url = URL.createObjectURL(record.blob);
      setBlobUrl(url);
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [output.blobKey]);
  const remoteUrl = output.filename ? new ComfyClient(serverUrl).getViewUrl({ filename: output.filename, subfolder: output.subfolder, type: output.type }).toString() : '';
  const src = blobUrl || remoteUrl;
  const name = comfyOutputName(output);
  return src ? <figure>{onClick ? <button title={`View output ${name}`} onClick={() => onClick(output, outputIndex)}><img src={src} alt={`ComfyUI output ${name}`} /></button> : <img src={src} alt={`ComfyUI output ${name}`} />}<figcaption>{name}</figcaption></figure> : null;
}

export function ComfyTaskOutputs({ outputs = [], serverUrl, onOutputClick }: { outputs?: ComfyOutputReference[]; serverUrl: string; onOutputClick?: (output: ComfyOutputReference, outputIndex: number) => void }) {
  const indexed = outputs.map((output, index) => ({ output, index }));
  const images = sortOutputs(indexed.filter(({ output }) => output.kind === 'image'));
  const texts = sortOutputs(indexed.filter(({ output }) => output.kind === 'text' && output.text));
  if (!images.length && !texts.length) return null;
  return <div className="comfy-task-outputs">
    {images.length > 0 && <div className="comfy-task-output-images">{images.map(({ output, index }) => <OutputImage key={`${output.nodeId}:${output.filename}:${index}`} output={output} outputIndex={index} serverUrl={serverUrl} onClick={onOutputClick} />)}</div>}
    {texts.length > 0 && <div className="comfy-task-output-texts">{texts.map(({ output, index }) => <div key={`${output.nodeId}:${index}`}><span>{comfyOutputName(output)}</span><pre>{output.text}</pre></div>)}</div>}
  </div>;
}
