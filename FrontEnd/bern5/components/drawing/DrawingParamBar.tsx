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
}

/**
 * SketchUp-style measurement bar at the bottom of the 3D viewport.
 * - Shows live param values that follow the cursor while drawing.
 * - User can type into any field to override; Enter commits the shape with
 *   the current (possibly overridden) values.
 */
const DrawingParamBar: React.FC<Props> = ({ tool, active, specs, onCommit, onErase, lang }) => {
  const t = lang === 'zh';
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const lastActiveRef = useRef(active);

  // Reset overrides whenever a new placing session starts (active rising-edge)
  useEffect(() => {
    if (active && !lastActiveRef.current) setOverrides({});
    lastActiveRef.current = active;
  }, [active]);

  if (!active || specs.length === 0) return null;

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
  };

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur-xl rounded-xl px-3 py-2 shadow-2xl border border-blue-500/30 flex items-center gap-2">
      <span className="text-[13px] font-black text-blue-400 uppercase tracking-wide pr-1">
        {t ? `${TOOL_LABEL_ZH[tool] || tool}` : `${TOOL_LABEL_EN[tool] || tool}`}
      </span>
      {specs.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <span className="text-slate-600">·</span>}
          <label className="text-[12px] font-bold text-slate-400 flex items-center gap-1">
            {s.label}
            <input
              type="number"
              step={0.1}
              {...(s.key !== 'dx' && s.key !== 'dz' ? { min: 0 } : {})}
              value={valueOf(s)}
              onChange={(e) => setOverrides(o => ({ ...o, [s.key]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEnter(); } }}
              className="w-16 px-1.5 py-1 bg-slate-800 border border-white/10 rounded text-white text-[13px] font-mono text-center focus:border-blue-500 outline-none"
            />
            {s.unit && <span className="text-slate-500 text-[13px]">{s.unit}</span>}
          </label>
        </React.Fragment>
      ))}
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

const TOOL_LABEL_ZH: Partial<Record<ToolKind, string>> = {
  box: '矩形', cylinder: '圓', polygon: '多邊形', lShape: 'L 形', tShape: 'T 形',
  arc: '弧', ellipse: '橢圓', fan: '扇形', polyline: 'Polyline', move: '移動',
};
const TOOL_LABEL_EN: Partial<Record<ToolKind, string>> = {
  box: 'Rectangle', cylinder: 'Circle', polygon: 'Polygon', lShape: 'L-Shape', tShape: 'T-Shape',
  arc: 'Arc', ellipse: 'Ellipse', fan: 'Fan', polyline: 'Polyline', move: 'Move',
};

export default DrawingParamBar;
