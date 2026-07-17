import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { displayImageUrl } from '../../services/api/image-url';
import { ComfyClient } from '../../services/comfy/client';
import { ComfyStorage } from '../../services/comfy/storage';
import type { ComfyOutputReference, ComfyTaskSummary } from '../../services/comfy/types';
import { CachedImage } from '../posts/CachedImage';

export function historyThumbnail(task: { input: { kind: 'post'; post: { previewUrl: string; sampleUrl: string; fileUrl: string } } | { kind: 'blob'; blobKey: string } }): ComfyTaskSummary['thumbnail'] {
  return task.input.kind === 'post'
    ? { kind: 'url', url: task.input.post.previewUrl || task.input.post.sampleUrl || task.input.post.fileUrl }
    : { kind: 'blob', blobKey: task.input.blobKey };
}

export interface ComfyViewerImage { url: string; label: string; revokeOnClose?: boolean }

export function ComfyImageViewer({ image, onClose }: { image: ComfyViewerImage | null; onClose: () => void }) {
  useEffect(() => {
    if (!image) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [image, onClose]);
  if (!image) return null;
  return createPortal(<div className="comfy-output-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="comfy-output-viewer" role="dialog" aria-modal="true" aria-label={image.label}><button className="icon-button" title="Close" autoFocus onClick={onClose}><X size={17} /></button><img src={image.url} alt={image.label} /></section></div>, document.body);
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
  return <div className="comfy-task-thumbnail">{src ? <button title={`View ${label}`} onClick={() => onOpen?.({ url: src, label })}><CachedImage src={src} alt={label} /></button> : <span>NO PREVIEW</span>}</div>;
}

export function comfyOutputName(output: ComfyOutputReference) {
  const title = (output.nodeTitle || output.nodeId).trim();
  const suffix = title.replace(/^OUTPUT/i, '').trim();
  return suffix || output.nodeId;
}

const outputCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortOutputs(outputs: ComfyOutputReference[]) {
  return [...outputs].sort((left, right) => outputCollator.compare(comfyOutputName(left), comfyOutputName(right)) || left.nodeId.localeCompare(right.nodeId));
}

export async function resolveComfyOutputImage(output: ComfyOutputReference, serverUrl: string): Promise<ComfyViewerImage | null> {
  if (output.blobKey) {
    const cached = await new ComfyStorage().getBlob(output.blobKey, 'output');
    if (cached) return { url: URL.createObjectURL(cached.blob), label: comfyOutputName(output), revokeOnClose: true };
  }
  if (!output.filename) return null;
  return { url: new ComfyClient(serverUrl).getViewUrl({ filename: output.filename, subfolder: output.subfolder, type: output.type }).toString(), label: comfyOutputName(output) };
}

function OutputImage({ output, serverUrl, onClick }: { output: ComfyOutputReference; serverUrl: string; onClick?: (output: ComfyOutputReference) => void }) {
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
  return src ? <figure>{onClick ? <button title={`View output ${name}`} onClick={() => onClick(output)}><img src={src} alt={`ComfyUI output ${name}`} /></button> : <img src={src} alt={`ComfyUI output ${name}`} />}<figcaption>{name}</figcaption></figure> : null;
}

export function ComfyTaskOutputs({ outputs = [], serverUrl, onOutputClick }: { outputs?: ComfyOutputReference[]; serverUrl: string; onOutputClick?: (output: ComfyOutputReference) => void }) {
  const images = sortOutputs(outputs.filter((output) => output.kind === 'image'));
  const texts = sortOutputs(outputs.filter((output) => output.kind === 'text' && output.text));
  if (!images.length && !texts.length) return null;
  return <div className="comfy-task-outputs">
    {images.length > 0 && <div className="comfy-task-output-images">{images.map((output, index) => <OutputImage key={`${output.nodeId}:${output.filename}:${index}`} output={output} serverUrl={serverUrl} onClick={onOutputClick} />)}</div>}
    {texts.length > 0 && <div className="comfy-task-output-texts">{texts.map((output, index) => <div key={`${output.nodeId}:${index}`}><span>{comfyOutputName(output)}</span><pre>{output.text}</pre></div>)}</div>}
  </div>;
}
