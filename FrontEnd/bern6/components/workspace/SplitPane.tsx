import React, { useCallback, useEffect, useRef } from 'react';
import { useSplitPaneWidth } from '../../hooks/useSplitPaneWidth';

interface Props {
  left: React.ReactNode;
  right: React.ReactNode;
}

/**
 * Two-column layout with a draggable vertical divider.
 * Left pane width is persisted to localStorage via useSplitPaneWidth.
 *
 * Assumption: this component wraps the full viewport, so `e.clientX` (viewport-
 * relative) maps directly to the left pane's width. If this is ever nested
 * inside a non-fullscreen container, switch to a container-offset measurement.
 */
const SplitPane: React.FC<Props> = ({ left, right }) => {
  const [width, setWidth] = useSplitPaneWidth();
  const draggingRef = useRef(false);
  const rafRef = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  // Note: `setWidth` isn't memoized, so this effect re-binds listeners on
  // each render. That's fine — rAF coalescing means at most one setWidth
  // per frame, and removeEventListener/addEventListener is cheap.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        setWidth(e.clientX);
      });
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, [setWidth]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div style={{ width, flexShrink: 0 }} className="overflow-hidden">
        {left}
      </div>
      <div
        onPointerDown={onPointerDown}
        title="拖曳改變寬度"
        className="w-[6px] cursor-col-resize transition-colors"
        style={{ background: 'var(--color-handle)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-handle-hover)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--color-handle)'; }}
      />
      <div className="flex-1 min-w-0 overflow-hidden">
        {right}
      </div>
    </div>
  );
};

export default SplitPane;
