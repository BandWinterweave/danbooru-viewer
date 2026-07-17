import { FolderOpen, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { ComfyStorage } from '../../services/comfy/storage';
import { useComfyStore } from '../../stores/comfy-store';
import { useI18n } from '../../i18n/runtime';
import { normalizeComfyMedia } from '../../services/comfy/media';

const supported = /\.(png|jpe?g|webp|gif|bmp|avif|mp4|webm|mov|mkv|zip)$/i;

interface EntryLike { isFile: boolean; isDirectory: boolean; name: string; file?: (callback: (file: File) => void, error?: () => void) => void; createReader?: () => { readEntries: (callback: (entries: EntryLike[]) => void) => void } }

async function filesFromEntry(entry: EntryLike): Promise<File[]> {
  if (entry.isFile && entry.file) return new Promise((resolve) => entry.file!((file) => resolve([file]), () => resolve([])));
  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const entries: EntryLike[] = [];
  while (true) {
    const page = await new Promise<EntryLike[]>((resolve) => reader.readEntries(resolve));
    if (!page.length) break;
    entries.push(...page);
  }
  return (await Promise.all(entries.map(filesFromEntry))).flat();
}

export function LocalInputDropzone() {
  const { messages: { comfy: messages } } = useI18n();
  const request = useComfyStore((state) => state.request);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [scan, setScan] = useState('');
  const processFiles = async (files: File[]) => {
    const accepted = files.filter((file) => supported.test(file.name) || file.type.startsWith('image/') || file.type.startsWith('video/'));
    const skipped = files.length - accepted.length;
    setScan(`Staging ${accepted.length} file${accepted.length === 1 ? '' : 's'}${skipped ? `, skipping ${skipped} unsupported` : ''}…`);
    const storage = new ComfyStorage();
    await storage.initialize();
    const inputs = [];
    for (const file of accepted) {
      try {
        const normalized = await normalizeComfyMedia(file, file.name);
        const record = await storage.putInputBlob(normalized.blob, normalized.filename, normalized.mediaType);
        inputs.push({ kind: 'blob' as const, blobKey: record.key, name: normalized.filename, mediaType: normalized.mediaType });
      } catch {
        // Keep scanning the remaining selection and report the skipped total below.
      }
    }
    if (inputs.length) await request({ type: 'COMFY_ENQUEUE_FILES', payload: { inputs, batchId: crypto.randomUUID() } });
    const failed = files.length - inputs.length;
    setScan(`${inputs.length} queued${failed ? ` · ${failed} skipped (unsupported or unreadable)` : ''}`);
  };
  const drop = async (event: React.DragEvent) => {
    event.preventDefault(); setDragging(false);
    const entries = [...event.dataTransfer.items].map((item) => (item as unknown as { webkitGetAsEntry?: () => EntryLike | null }).webkitGetAsEntry?.() ?? null).filter((entry): entry is EntryLike => entry !== null);
    await processFiles(entries.length ? (await Promise.all(entries.map(filesFromEntry))).flat() : [...event.dataTransfer.files]);
  };
  return <section className={`comfy-dropzone ${dragging ? 'is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => void drop(event)}>
    <Upload size={24} /><div><strong>{messages.localMedia}</strong><span>{messages.dropFiles}</span></div>
    <button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={14} /> {messages.files}</button>
    <button className="secondary-button" onClick={() => folderRef.current?.click()}><FolderOpen size={14} /> {messages.folder}</button>
    <input ref={fileRef} hidden multiple type="file" accept="image/*,video/*,.zip" onChange={(event) => { void processFiles([...event.target.files ?? []]); event.target.value = ''; }} />
    <input ref={folderRef} hidden multiple type="file" {...{ webkitdirectory: '', directory: '' }} onChange={(event) => { void processFiles([...event.target.files ?? []]); event.target.value = ''; }} />
    {scan && <p role="status">{scan}</p>}
  </section>;
}
