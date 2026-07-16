import { describe, expect, it, vi } from 'vitest';
import { runAsync, TOAST_EVENT, type ToastMessage } from '../../src/services/notifications';

describe('async error reporting', () => {
  it('handles rejected critical operations without an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const toasts: ToastMessage[] = [];
    const onUnhandled = (event: PromiseRejectionEvent) => unhandled.push(event.reason);
    const onToast = (event: Event) => toasts.push((event as CustomEvent<ToastMessage>).detail);
    window.addEventListener('unhandledrejection', onUnhandled);
    window.addEventListener(TOAST_EVENT, onToast);

    runAsync('storage', Promise.reject(new Error('database unavailable')));
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(unhandled).toEqual([]);
    expect(toasts).toEqual([expect.objectContaining({ tone: 'error', title: 'Local data could not be saved', description: 'database unavailable' })]);
    window.removeEventListener('unhandledrejection', onUnhandled);
    window.removeEventListener(TOAST_EVENT, onToast);
  });

  it('reports clipboard permission failures consistently', async () => {
    const listener = vi.fn();
    window.addEventListener(TOAST_EVENT, listener);
    runAsync('permission', Promise.reject(new DOMException('Write permission denied', 'NotAllowedError')));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.objectContaining({ title: 'Permission denied' }) }));
    window.removeEventListener(TOAST_EVENT, listener);
  });
});
