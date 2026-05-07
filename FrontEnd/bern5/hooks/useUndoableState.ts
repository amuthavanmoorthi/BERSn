import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

interface Options {
  debounceMs?: number;   // coalesce rapid changes (e.g. drag pointermove) into one undo entry
  maxStack?: number;     // cap stack size to bound memory
}

/**
 * State container with undo/redo. Snapshot-based: every change pushes the
 * previous state onto a stack. To avoid flooding the stack with intermediate
 * values from drag/rotate gestures, consecutive setState calls within
 * `debounceMs` collapse into a single undo entry.
 */
export function useUndoableState<T>(initial: T, options?: Options) {
  const debounceMs = options?.debounceMs ?? 300;
  const maxStack = options?.maxStack ?? 50;

  const [present, setPresent] = useState<T>(initial);
  const presentRef = useRef(present);
  presentRef.current = present;

  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const pendingPrevRef = useRef<T | null>(null);
  const timerRef = useRef<number | null>(null);

  // Force re-render when the past/future ref counts change (so canUndo/canRedo update)
  const [, force] = useReducer((c: number) => c + 1, 0);

  const flushPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingPrevRef.current !== null) {
      const prev = pendingPrevRef.current;
      pendingPrevRef.current = null;
      const next = [...pastRef.current, prev];
      if (next.length > maxStack) next.shift();
      pastRef.current = next;
      futureRef.current = [];
      force();
    }
  }, [maxStack]);

  const setState = useCallback((updater: T | ((prev: T) => T)) => {
    // First change of a burst → capture pre-burst snapshot
    if (pendingPrevRef.current === null) {
      pendingPrevRef.current = presentRef.current;
    }
    setPresent(prev => (typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater));
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flushPending, debounceMs);
  }, [debounceMs, flushPending]);

  const undo = useCallback(() => {
    flushPending();
    if (pastRef.current.length === 0) return;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [presentRef.current, ...futureRef.current];
    setPresent(previous);
    force();
  }, [flushPending]);

  const redo = useCallback(() => {
    flushPending();
    if (futureRef.current.length === 0) return;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, presentRef.current];
    setPresent(next);
    force();
  }, [flushPending]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
