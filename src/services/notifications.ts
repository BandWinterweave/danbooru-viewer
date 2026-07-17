import { getMessages } from '../i18n/runtime-core';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';
export type ErrorOperation = 'api' | 'storage' | 'download' | 'permission';

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

export function reportOperationError(operation: ErrorOperation, error: unknown) {
  const actionMessages = getMessages().domainActions;
  const description = error instanceof Error && error.message ? error.message.slice(0, 300) : actionMessages.errors.fallback;
  notify({ tone: 'error', title: actionMessages.errors[operation], description });
}

export function runAsync(operation: ErrorOperation, promise: Promise<unknown>) {
  void promise.catch((error) => reportOperationError(operation, error));
}
