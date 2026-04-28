import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { PopupEvent } from 'leaflet';

/**
 * Rendered inside a MapContainer — makes drags on open popups
 * pan the map instead of doing nothing.
 *
 * Leaflet calls `L.DomEvent.disableClickPropagation` on the popup
 * container, which stops `pointerdown` from bubbling to the map's
 * drag handler. We intercept in the capture phase (before stopPropagation
 * takes effect) and manually drive `map.panBy()`.
 */
export function MapDragThroughPopup(): null {
  const map = useMap();

  useEffect(() => {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (dx !== 0 || dy !== 0) {
        map.panBy([-dx, -dy] as [number, number], { animate: false });
      }
    }

    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    }

    function onPopupPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      // Let clicks on interactive elements behave normally
      if (target.closest('button, a, input, select, textarea')) return;
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    }

    // We keep track of cleanup fns per popup element to avoid leaks
    const cleanupByEl = new Map<HTMLElement, () => void>();

    function onPopupOpen(evt: PopupEvent) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const popupEl = (evt.popup as any)._container as HTMLElement | undefined;
      if (!popupEl || cleanupByEl.has(popupEl)) return;

      // Capture phase fires before Leaflet's stopPropagation
      popupEl.addEventListener('pointerdown', onPopupPointerDown as EventListener, true);

      cleanupByEl.set(popupEl, () => {
        popupEl.removeEventListener('pointerdown', onPopupPointerDown as EventListener, true);
      });
    }

    function onPopupClose(evt: PopupEvent) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const popupEl = (evt.popup as any)._container as HTMLElement | undefined;
      if (!popupEl) return;
      cleanupByEl.get(popupEl)?.();
      cleanupByEl.delete(popupEl);
    }

    map.on('popupopen', onPopupOpen as (e: PopupEvent) => void);
    map.on('popupclose', onPopupClose as (e: PopupEvent) => void);

    return () => {
      map.off('popupopen', onPopupOpen as (e: PopupEvent) => void);
      map.off('popupclose', onPopupClose as (e: PopupEvent) => void);
      cleanupByEl.forEach((cleanup) => cleanup());
      cleanupByEl.clear();
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [map]);

  return null;
}
