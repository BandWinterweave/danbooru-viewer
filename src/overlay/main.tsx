import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import '../styles.css';
import { ComfyWorkbench } from '../components/comfy/ComfyWorkbench';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary';
import { I18nProvider } from '../i18n/runtime';
import { useTheme } from '../hooks/useTheme';
import { useUiStore } from '../stores/ui-store';

function OverlayWorkbench() {
  useTheme();
  const [authorized, setAuthorized] = useState(false);
  const open = useUiStore((state) => state.comfyOpen);
  const openComfy = useUiStore((state) => state.openComfy);
  const opened = useRef(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    let active = true;
    void chrome.runtime.sendMessage({ type: 'PAGE_VALIDATE_WORKBENCH', payload: { token } }).then((response: { ok?: boolean }) => {
      if (active && response?.ok) { setAuthorized(true); openComfy(); }
    }).catch(() => undefined);
    const receive = (event: MessageEvent) => { if (event.data?.type === 'DV_COMFY_OVERLAY_OPEN') openComfy(); };
    window.addEventListener('message', receive);
    return () => { active = false; window.removeEventListener('message', receive); void chrome.runtime.sendMessage({ type: 'PAGE_REVOKE_WORKBENCH' }).catch(() => undefined); };
  }, [openComfy]);
  useEffect(() => {
    if (open) opened.current = true;
    else if (opened.current) void chrome.runtime.sendMessage({ type: 'PAGE_REVOKE_WORKBENCH' }).catch(() => undefined).finally(() => window.parent.postMessage({ type: 'DV_COMFY_OVERLAY_CLOSE' }, '*'));
  }, [open]);
  return authorized ? <ComfyWorkbench toggleWithKeyboard={false} /> : null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider page="viewer"><ErrorBoundary><OverlayWorkbench /></ErrorBoundary></I18nProvider></React.StrictMode>);
