import React, { useEffect, useRef, useState } from 'react';
import { ToolKind } from '../../hooks/useDrawingTool';

export type ParamSpec = { key: string; label: string; value: number; unit?: string };

interface Props {
  tool: ToolKind;
  active: boolean;            // true while in 'placing' with first anchor set
  specs: ParamSpec[];          // live values from cursor
  onCommit: (values: Record<string, number>) => void;
  onErase?: () => void;        // for polyline: remove last placed point
  lang: 'zh' | 'en';
  /** CAD-style polar tracking: 0 = off; >0 = snap cursor angle to multiples of this step (deg). */
  angleSnapDeg?: number;
  /** Toggle / set the angle-snap step. Passing 0 clears it. */
  onAngleSnapChange?: (deg: number) => void;
  /** Optional live preview: when angle is locked, typing a length updates the cursor along the locked direction. */
  onLengthPreview?: (len: number) => void;
  /** Pause mouse-driven cursor updates while the user is typing in the paramBar. */
  onInputFocusChange?: (focused: boolean) => void;
  /** Polyline segment sub-mode toggle. */
  polylineSegMode?: 'line' | 'arc';
  onPolylineSegModeChange?: (mode: 'line' | 'arc') => void;
  /** Polyline 3D mode — when true, viewport stays in perspective instead of locking to top view. */
  polyline3D?: boolean;
  onPolyline3DChange?: (on: boolean) => void;
}

/**
 * SketchUp-style measurement bar at the bottom of the 3D viewport.
 * - Shows live param values that follow the cursor while drawing.
 * - User can type into any field to override; Enter commits the shape with
 *   the current (possibly overridden) values.
 */
const DrawingParamBar: React.FC<Props> = ({
  tool, active, specs, onCommit, onErase, lang,
  angleSnapDeg = 0, onAngleSnapChange, onLengthPreview, onInputFocusChange,
  polylineSegMode = 'line', onPolylineSegModeChange,
  polyline3D = false, onPolyline3DChange,
}) => {
  const t = lang === 'zh';
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const lastActiveRef = useRef(active);
  const lengthInputRef = useRef<HTMLInputElement | null>(null);
  const hasLengthSpec = specs.some(s => s.key === 'length');

  // Reset overrides whenever a new placing session starts (active rising-edge)
  useEffect(() => {
    if (active && !lastActiveRef.current) setOverrides({});
    lastActiveRef.current = active;
  }, [active]);

  // SketchUp-style "just start typing" — when paramBar is active and no input
  // currently focused, digit keys jump to the length input + seed the value.
  // Solves the UX where users had to mouse-down to the bar (which changed the
  // angle on the way) just to click into the field.
  //
  // Attached on `window` in CAPTURE phase so it runs before any other keydown
  // listener (ThreeDViewer's bubble-phase one, OrbitControls, etc.) and the
  // digit is guaranteed to land in the length field.
  useEffect(() => {
    if (!active || !hasLengthSpec) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return; // skip "Shift", "ArrowUp", etc.
      if (!/^[0-9.]$/.test(e.key)) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
      const input = lengthInputRef.current;
      if (!input) return;
      e.preventDefault();
      e.stopPropagation();
      input.focus();
      // Use the next frame's setSelectionRange so subsequent keystrokes append
      // rather than replace (we manually seeded the value below).
      const seed = e.key === '.' ? '0.' : e.key;
      setOverrides(o => ({ ...o, length: seed }));
      if (angleSnapDeg > 0 && onLengthPreview) {
        const n = parseFloat(seed);
        if (Number.isFinite(n) && n > 0) onLengthPreview(n);
      }
      // Place caret at end so the next digit appends ("5" → "53" not "35")
      requestAnimationFrame(() => {
        const el = lengthInputRef.current;
        if (!el) return;
        const len = el.value.length;
        try { el.setSelectionRange(len, len); } catch { /* number inputs may not support setSelectionRange */ }
      });
    };
    window.addEventListener('keydown', onKey, true /* capture */);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, hasLengthSpec, angleSnapDeg, onLengthPreview]);

  // Polyline mode toggle is useful even before placing the first point — render
  // a minimal bar with just the toggle in that case.
  if (!active || specs.length === 0) {
    if (tool === 'polyline' && onPolylineSegModeChange) {
      return (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-md shadow-2xl"
             style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
          <span className="text-[11px] font-bold text-[color:var(--color-muted)]">{t ? '段型' : 'Seg'}</span>
          <div className="flex items-center gap-0.5 rounded-lg overflow-hidden border border-[color:var(--color-border)]">
            {(['line', 'arc'] as const).map(m => {
              const isActive = polylineSegMode === m;
              return (
                <button
                  key={m}
                  onClick={() => onPolylineSegModeChange(m)}
                  title={m === 'line' ? (t ? '直線段' : 'Line') : (t ? '弧線段 (中點 → 終點)' : 'Arc (mid → end)')}
                  className={`px-3 py-1 text-[12px] font-black transition ${isActive ? 'bg-blue-600 text-white' : 'bg-[color:var(--color-bg)] text-[color:var(--color-text)]'}`}
                >
                  {m === 'line' ? (t ? '線' : 'Line') : (t ? '弧' : 'Arc')}
                </button>
              );
            })}
          </div>
          {onPolyline3DChange && (
            <button
              onClick={() => onPolyline3DChange(!polyline3D)}
              title={t ? '3D 模式：保留透視視角繪製' : '3D mode: keep perspective view while drawing'}
              className={`ml-1 px-3 py-1 rounded-lg text-[12px] font-black transition border ${polyline3D ? 'bg-blue-600 text-white border-blue-600' : 'bg-[color:var(--color-bg)] text-[color:var(--color-text)] border-[color:var(--color-border)]'}`}
            >
              3D
            </button>
          )}
        </div>
      );
    }
    return null;
  }

  const valueOf = (s: ParamSpec) => {
    const ov = overrides[s.key];
    if (ov !== undefined) return ov;
    return s.value.toFixed(2);
  };

  const handleEnter = () => {
    const merged: Record<string, number> = {};
    for (const s of specs) {
      const ov = overrides[s.key];
      const num = ov !== undefined ? parseFloat(ov) : s.value;
      if (!isFinite(num)) return;
      // Allow zero/negative for delta-style fields (move tool dx/dz);
      // require positive for length-style fields.
      const allowNonPositive = s.key === 'dx' || s.key === 'dz';
      if (!allowNonPositive && num <= 0) return;
      merged[s.key] = num;
    }
    onCommit(merged);
    setOverrides({});
    // After Enter, drop focus from the input so the user can immediately
    // click on the canvas to confirm the previewed point (for polyline this
    // is a 2-step "Enter = preview, click = commit" flow).
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onInputFocusChange?.(false);
  };

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur-xl rounded-xl px-3 py-2 shadow-2xl border border-blue-500/30 flex items-center gap-2">
      <span className="text-[13px] font-black text-blue-400 uppercase tracking-wide pr-1">
        {t ? `${TOOL_LABEL_ZH[tool] || tool}` : `${TOOL_LABEL_EN[tool] || tool}`}
      </span>
      {specs.map((s, i) => {
        const isAngle = /angle/i.test(s.key);
        const isLength = s.key === 'length';
        const setOverride = (v: string) => {
          setOverrides(o => ({ ...o, [s.key]: v }));
          // Live preview: when length changes and an angle is locked, jump the
          // cursor along the locked direction so the next-point preview tracks
          // the typed number in real time.
          if (isLength && angleSnapDeg > 0 && onLengthPreview) {
            const n = parseFloat(v);
            if (Number.isFinite(n) && n > 0) onLengthPreview(n);
          }
        };
        return (
        <React.Fragment key={s.key}>
          {i > 0 && <span className="text-slate-600">·</span>}
          <label className="text-[12px] font-bold text-slate-400 flex items-center gap-1">
            {s.label}
            <input
              ref={isLength ? lengthInputRef : undefined}
              type="number"
              step={isAngle ? 1 : 0.1}
              {...(s.key !== 'dx' && s.key !== 'dz' ? { min: 0 } : {})}
              value={valueOf(s)}
              onChange={(e) => setOverride(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEnter(); } }}
              onFocus={(e) => {
                onInputFocusChange?.(true);
                // Select all so the user can type-replace without erasing first.
                e.currentTarget.select();
              }}
              onBlur={() => onInputFocusChange?.(false)}
              autoFocus={isLength && angleSnapDeg > 0}
              className="w-16 px-1.5 py-1 bg-slate-800 border border-white/10 rounded text-white text-[13px] font-mono text-center focus:border-blue-500 outline-none"
            />
            {s.unit && <span className="text-slate-500 text-[13px]">{s.unit}</span>}
          </label>
          {isAngle && (
            <div className="flex items-center gap-0.5 ml-0.5">
              {QUICK_ANGLES.map(deg => {
                const locked = angleSnapDeg === deg;
                return (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => {
                      setOverride(String(deg));
                      // Click again to release; first click to lock cursor to N°
                      onAngleSnapChange?.(locked ? 0 : deg);
                    }}
                    title={locked ? `已鎖 ${deg}° (再次按取消)` : `鎖定每 ${deg}° 移動`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black border transition-colors ${
                      locked
                        ? 'bg-amber-500 text-white border-amber-300 shadow'
                        : 'text-slate-300 bg-slate-800 hover:bg-blue-600 hover:text-white border-white/10'
                    }`}
                  >
                    {locked && '🔒'}{deg}°
                  </button>
                );
              })}
            </div>
          )}
        </React.Fragment>
        );
      })}
      {tool === 'polyline' && onPolylineSegModeChange && (
        <div className="ml-1 flex items-center gap-0.5 rounded-lg overflow-hidden border border-[color:var(--color-border)]">
          {(['line', 'arc'] as const).map(m => {
            const active = polylineSegMode === m;
            return (
              <button
                key={m}
                onClick={() => onPolylineSegModeChange(m)}
                title={m === 'line' ? (t ? '直線段' : 'Line') : (t ? '弧線段 (中點 → 終點)' : 'Arc (mid → end)')}
                className={`px-2 py-1 text-[12px] font-black transition ${active ? 'bg-blue-600 text-white' : 'bg-[color:var(--color-bg)] text-[color:var(--color-text)]'}`}
              >
                {m === 'line' ? (t ? '線' : 'L') : (t ? '弧' : 'A')}
              </button>
            );
          })}
        </div>
      )}
      {tool === 'polyline' && onErase && (
        <button
          onClick={onErase}
          title={t ? '橡皮擦：刪除最後一個點 (Backspace)' : 'Eraser: undo last point (Backspace)'}
          className="ml-1 px-2 py-1 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-[14px] font-black"
        >
          ⌫
        </button>
      )}
      <button
        onClick={handleEnter}
        className="ml-1 px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-black"
      >
        {t ? '✓ Enter' : '✓ Enter'}
      </button>
    </div>
  );
};

// Quick-pick angle chips next to any paramSpec whose key contains "angle"
// (polyline `angle`, polygon `startAngle`, fan `fanAngle`, arc `arcAngle`).
const QUICK_ANGLES: number[] = [30, 45, 60, 90, 120];

const TOOL_LABEL_ZH: Partial<Record<ToolKind, string>> = {
  box: '矩形', cylinder: '圓', polygon: '多邊形', lShape: 'L 形', tShape: 'T 形',
  arc: '弧', ellipse: '橢圓', fan: '扇形', polyline: 'Polyline', move: '移動',
};
const TOOL_LABEL_EN: Partial<Record<ToolKind, string>> = {
  box: 'Rectangle', cylinder: 'Circle', polygon: 'Polygon', lShape: 'L-Shape', tShape: 'T-Shape',
  arc: 'Arc', ellipse: 'Ellipse', fan: 'Fan', polyline: 'Polyline', move: 'Move',
};

export default DrawingParamBar;
