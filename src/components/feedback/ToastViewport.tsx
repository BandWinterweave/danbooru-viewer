import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { messages } from '../../i18n/en';
import { TOAST_EVENT, type ToastMessage } from '../../services/notifications';

const icons = { success: Check, error: AlertTriangle, warning: AlertTriangle, info: Info };

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const dismiss = (id: string) => setToasts((items) => items.filter((item) => item.id !== id));

  useEffect(() => {
    const receive = (event: Event) => {
      const toast = (event as CustomEvent<ToastMessage>).detail;
      setToasts((items) => [...(toast.tone === 'success' ? items.filter((item) => item.tone !== 'error' && item.tone !== 'warning') : items).slice(-3), toast]);
      window.setTimeout(() => dismiss(toast.id), toast.tone === 'error' ? 7000 : 4200);
    };
    window.addEventListener(TOAST_EVENT, receive);
    return () => window.removeEventListener(TOAST_EVENT, receive);
  }, []);

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = icons[toast.tone];
        return <article className={`toast toast--${toast.tone}`} key={toast.id} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <span className="toast-icon"><Icon size={15} /></span>
          <div><strong>{toast.title}</strong>{toast.description && <p>{toast.description}</p>}</div>
          <button title={messages.actions.dismiss} aria-label={messages.actions.dismiss} onClick={() => dismiss(toast.id)}><X size={14} /></button>
        </article>;
      })}
    </div>
  );
}
