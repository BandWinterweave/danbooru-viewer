import { Download } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { downloadPost, type DownloadSize } from '../../services/download-service';
import { useSettingsStore } from '../../stores/settings-store';
import type { UnifiedPost } from '../../types/post';
import { notify } from '../../services/notifications';
import { actionMessages } from '../../i18n/en-actions';
import { useDismissibleLayer } from '../../hooks/useDismissibleLayer';

export function DownloadMenu({ post, compact = false }: { post: UnifiedPost; compact?: boolean }) {
  const rule = useSettingsStore((state) => state.downloadRule);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const menuId = useId();
  useDismissibleLayer(ref, open, () => setOpen(false));
  const sizes: Array<{ value: DownloadSize; label: string }> = [
    ...(post.playbackUrl ? [{ value: 'playback' as const, label: actionMessages.download.playableVideo }] : []),
    { value: 'full', label: post.fileExt === 'zip' ? actionMessages.download.originalFrames : actionMessages.download.original },
    { value: 'sample', label: actionMessages.download.large },
    { value: 'preview', label: actionMessages.download.thumbnail },
  ];
  const run = async (size: DownloadSize) => {
    setOpen(false);
    try {
      await downloadPost(post, size, rule);
      notify({ tone: 'success', title: actionMessages.download.started, description: actionMessages.download.postDescription(post.source, post.id) });
    } catch (error) {
      notify({ tone: 'error', title: actionMessages.download.failed, description: error instanceof Error ? error.message : undefined });
    }
  };
  return (
    <span ref={ref} className="download-menu" onClick={(event) => event.stopPropagation()}>
      <button title={actionMessages.download.chooseSize} aria-expanded={open} aria-controls={menuId} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}><Download size={compact ? 14 : 15} />{!compact && ` ${actionMessages.download.action}`}</button>
      {open && <span id={menuId} className="download-menu-options" role="menu">{sizes.map((size) => <button role="menuitem" key={size.value} onClick={() => void run(size.value)}>{size.label}</button>)}</span>}
    </span>
  );
}
