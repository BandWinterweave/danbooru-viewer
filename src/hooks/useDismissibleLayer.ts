import { useEffect, type RefObject } from 'react';

export function useDismissibleLayer<T extends HTMLElement>(
  ref: RefObject<T>,
  open: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const layer = ref.current;
      const target = event.target as Element;
      const controller = target.closest('[aria-controls]');
      if (!layer?.contains(target) && (!layer?.id || controller?.getAttribute('aria-controls') !== layer.id)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss, open, ref]);
}
