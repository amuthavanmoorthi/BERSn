import React from 'react';

interface Props {
  cursor: { x: number; z: number } | null;
  hint: string | null;
  snapEnabled: boolean;
  topViewLocked: boolean;
  gridSize: number;
  onToggleSnap: () => void;
  onToggleTopView: () => void;
  onSetGridSize: (g: number) => void;
  lang: 'zh' | 'en';
}

const GRID_OPTIONS = [0.5, 1, 2, 5];

const DrawingHUD: React.FC<Props> = ({ cursor, hint, snapEnabled, topViewLocked, gridSize, onToggleSnap, onToggleTopView, onSetGridSize, lang }) => {
  const t = lang === 'zh';
  return (
    <>
      {/* Cursor coords + drawing hint (bottom-right) */}
      <div className="absolute bottom-3 right-3 z-30 bg-slate-900/85 backdrop-blur-xl rounded-lg px-3 py-2 shadow-lg border border-white/10 text-[12px] font-mono text-white space-y-0.5 pointer-events-none">
        <div>
          X: {cursor ? cursor.x.toFixed(2) : '—'}  Y: {cursor ? cursor.z.toFixed(2) : '—'} m
        </div>
        {hint && <div className="text-blue-300">{t ? '繪製中' : 'Drawing'} · {hint}</div>}
      </div>

      {/* Status bar: large, clickable badges anchored at TOP-center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
        <button
          onClick={onToggleSnap}
          title={t ? '切換格點鎖定' : 'Toggle snap'}
          className={`px-4 py-2 rounded-lg text-[13px] font-black shadow-xl border-2 transition-all backdrop-blur-xl ${
            snapEnabled
              ? 'bg-amber-500 text-white border-amber-300 hover:bg-amber-400'
              : 'bg-slate-900/80 text-slate-400 border-white/10 hover:bg-slate-800'
          }`}
        >
          ⊞ {t ? '鎖點' : 'SNAP'}: {snapEnabled ? 'ON' : 'OFF'}
        </button>

        {/* Grid size selector */}
        <div className={`flex items-center gap-0.5 bg-slate-900/80 backdrop-blur-xl rounded-lg shadow-xl border-2 border-white/10 p-0.5 ${snapEnabled ? '' : 'opacity-40'}`}>
          <span className="px-2 text-[11px] font-bold text-slate-400">{t ? '格距' : 'GRID'}</span>
          {GRID_OPTIONS.map(g => (
            <button
              key={g}
              onClick={() => onSetGridSize(g)}
              disabled={!snapEnabled}
              className={`px-2 py-1 rounded text-[11px] font-black transition-all ${
                gridSize === g ? 'bg-amber-500 text-white' : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              {g}m
            </button>
          ))}
        </div>

        <button
          onClick={onToggleTopView}
          title={t ? '切換俯視' : 'Toggle top view'}
          className={`px-4 py-2 rounded-lg text-[13px] font-black shadow-xl border-2 transition-all backdrop-blur-xl ${
            topViewLocked
              ? 'bg-blue-600 text-white border-blue-300 hover:bg-blue-500'
              : 'bg-slate-900/80 text-slate-400 border-white/10 hover:bg-slate-800'
          }`}
        >
          ⬇ {t ? '俯視' : 'TOP'}: {topViewLocked ? 'ON' : 'OFF'}
        </button>
      </div>
    </>
  );
};

export default DrawingHUD;
