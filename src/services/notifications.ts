export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

export const TOAST_EVENT = 'danbooru-viewer:toast';

export function notify(message: Omit<ToastMessage, 'id'>) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastMessage>(TOAST_EVENT, {
    detail: { ...message, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
  }));
}
