import { Download } from 'lucide-react';
import { useState } from 'react';
import { downloadPost, type DownloadSize } from '../../services/download-service';
import { useSettingsStore } from '../../stores/settings-store';
import type { UnifiedPost } from '../../types/post';

export function DownloadMenu({ post, compact = false }: { post: UnifiedPost; compact?: boolean }) {
  const rule = useSettingsStore((state) => state.downloadRule);
  const [open, setOpen] = useState(false);
  const sizes: Array<{ value: DownloadSize; label: string }> = [
    ...(post.playbackUrl ? [{ value: 'playback' as const, label: 'Playable video' }] : []),
    { value: 'full', label: post.fileExt === 'zip' ? 'Original frames (.zip)' : 'Original' },
    { value: 'sample', label: 'Large' },
    { value: 'preview', label: 'Thumbnail' },
  ];
  const run = (size: DownloadSize) => { setOpen(false); void downloadPost(post, size, rule); };
  return (
    <span className="download-menu" onClick={(event) => event.stopPropagation()}>
      <button title="Choose download size" onClick={() => setOpen((value) => !value)}><Download size={compact ? 14 : 15} />{!compact && ' Download'}</button>
      {open && <span className="download-menu-options">{sizes.map((size) => <button key={size.value} onClick={() => run(size.value)}>{size.label}</button>)}</span>}
    </span>
  );
}
