import { useCallback, useEffect, useRef, useState } from 'react';

const KEY_PREFIX = 'bern5.activeStep.';
export const MIN_STEP = 1;
export const MAX_STEP = 4;
const DEFAULT_STEP = MIN_STEP;

function clampStep(n: number): number {
  return Math.max(MIN_STEP, Math.min(MAX_STEP, Math.round(n)));
}

function readStored(projectId: string): number {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + projectId);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) return clampStep(n);
    }
  } catch { /* ignore */ }
  return DEFAULT_STEP;
}

function pickInitial(projectId: string, initialStep: number | undefined): number {
  if (typeof initialStep === 'number') return clampStep(initialStep);
  return readStored(projectId);
}

/**
 * Active step (1..5) for the StepWizard. Persisted per-project in sessionStorage
 * so reload keeps the user on the same step but switching projects starts fresh.
 *
 * The reconciliation logic uses render-time setState (React's documented
 * "storing information from previous renders" pattern) so that all of:
 *   - persist-on-change
 *   - project switch reload
 *   - external initialStep override
 * see a consistent active value within the same render commit and no effect
 * can overwrite a sibling effect's state.
 *
 * Behavior when projectId AND initialStep change in the same render:
 *   project change wins (reload that project's slot), but if initialStep is
 *   provided, it overrides the stored value. So deep-linking to "project P2,
 *   step 4" works as expected.
 *
 * `initialStep` is honored both on project switch and as a standalone override
 * (e.g. TopNav shortcut "能效分析" while already on a project).
 */
export function useActiveStep(
  projectId: string,
  initialStep?: number,
): [number, (n: number) => void] {
  const [active, setActiveRaw] = useState<number>(() => pickInitial(projectId, initialStep));
  const prevProjectIdRef = useRef(projectId);
  const prevInitialStepRef = useRef(initialStep);

  // Render-time reconciliation
  if (prevProjectIdRef.current !== projectId) {
    // Project switch — reset based on new slot, honor initialStep if provided
    prevProjectIdRef.current = projectId;
    prevInitialStepRef.current = initialStep;
    setActiveRaw(pickInitial(projectId, initialStep));
  } else if (
    typeof initialStep === 'number' &&
    prevInitialStepRef.current !== initialStep
  ) {
    // initialStep changed within the same project — apply override
    prevInitialStepRef.current = initialStep;
    setActiveRaw(clampStep(initialStep));
  }

  // Persist on every change (safe — render-time reconciliation already
  // committed the right value before this effect runs)
  useEffect(() => {
    try { sessionStorage.setItem(KEY_PREFIX + projectId, String(active)); }
    catch { /* ignore */ }
  }, [active, projectId]);

  const setActive = useCallback((n: number) => setActiveRaw(clampStep(n)), []);
  return [active, setActive];
}
