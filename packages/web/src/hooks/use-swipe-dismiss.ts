import { useRef, useCallback, type RefObject } from "react";

const DISMISS_THRESHOLD = 100;

/**
 * Adds swipe-down-to-dismiss to a bottom sheet element.
 * Returns a ref to attach to the sheet, and touch handlers for the drag handle.
 */
export function useSwipeDismiss(onDismiss: () => void): {
  sheetRef: RefObject<HTMLDivElement | null>;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
} {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    isDragging.current = true;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "none";
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    currentY.current = e.touches[0].clientY;
    const dy = Math.max(0, currentY.current - startY.current);
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const dy = currentY.current - startY.current;

    if (sheetRef.current) {
      if (dy > DISMISS_THRESHOLD) {
        sheetRef.current.style.transition = "transform 0.2s ease-out";
        sheetRef.current.style.transform = "translateY(100%)";
        setTimeout(onDismiss, 200);
      } else {
        sheetRef.current.style.transition = "transform 0.2s ease-out";
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
  }, [onDismiss]);

  return { sheetRef, handleTouchStart, handleTouchMove, handleTouchEnd };
}
