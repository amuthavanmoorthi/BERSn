import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Responsive split-pane width hook.
 *
 * Stores the left-pane size as a *ratio* (0..1) of viewport width, so a user
 * who maximised their window once still gets the same proportional layout on
 * a smaller screen later. Returns the computed pixel width so consumers stay
 * pixel-based, plus a setter that accepts pixels (converted to ratio
 * internally).
 *
 * Persistence: ratio in localStorage, debounced 200ms during drag.
 *
 * Hard floor / ceiling: `MIN_PX` / `MAX_PX` keep the panel usable even on
 * extreme viewport sizes (e.g. ratio 0.15 on a 4K monitor would still leave
 * the panel readable).
 */

const STORAGE_KEY = 'bern5.splitRatio';

// Ratio bounds (fraction of viewport width)
const MIN_RATIO = 0.15;
const MAX_RATIO = 0.45;
const DEFAULT_RATIO = 0.22;

// Absolute pixel safety net
const MIN_PX = 220;
const MAX_PX = 720;

const PERSIST_DEBOUNCE_MS = 200;

function clampRatio(r: number): number {
  return Math.max(MIN_RATIO, Math.min(MAX_RATIO, r));
}

function readStored(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return clampRatio(n);
    }
  } catch { /* ignore */ }
  return DEFAULT_RATIO;
}

function getViewportWidth(): number {
  if (typeof window === 'undefined') return 1440; // SSR fallback
  return window.innerWidth;
}

function ratioToWidth(ratio: number, vw: number): number {
  const px = Math.round(ratio * vw);
  return Math.max(MIN_PX, Math.min(MAX_PX, px));
}

export function useSplitPaneWidth(): [number, (n: number) => void, { min: number; max: number }] {
  const [ratio, setRatioState] = useState<number>(readStored);
  const [vw, setVw] = useState<number>(getViewportWidth);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Capture latest vw in a ref so `setWidth` can stay stable. If we put `vw`
  // in setWidth's closure directly, every render would mint a new setWidth,
  // which downstream effects (e.g. SplitPane's pointer-listener binding)
  // would treat as "dependency changed" and tear down + rebind listeners.
  // That tear-down accidentally cancels in-progress drags.
  const vwRef = useRef(vw);
  vwRef.current = vw;

  // Listen for window resize to recompute the effective pixel width
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Stable setter — accepts pixel width (during drag) and converts to ratio
  const setWidth = useCallback((px: number) => {
    const v = vwRef.current;
    if (!Number.isFinite(px) || v <= 0) return;
    setRatioState(clampRatio(px / v));
  }, []);

  // Persist ratio on change (debounced)
  useEffect(() => {
    if (persistTimerRef.current !== null) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      try { localStorage.setItem(STORAGE_KEY, String(ratio)); } catch { /* ignore */ }
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [ratio]);

  const width = ratioToWidth(ratio, vw);
  const minPx = Math.max(MIN_PX, Math.round(MIN_RATIO * vw));
  const maxPx = Math.min(MAX_PX, Math.round(MAX_RATIO * vw));

  return [width, setWidth, { min: minPx, max: maxPx }];
}
