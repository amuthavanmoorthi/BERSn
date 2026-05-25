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
  /** CAD-style isolate selection: dim everything except the selected scope. */
  isolateEnabled?: boolean;
  onToggleIsolate?: () => void;
  lang: 'zh' | 'en';
}

const GRID_OPTIONS = [0.5, 1, 2, 5];

const DrawingHUD: React.FC<Props> = ({
  cursor, hint, snapEnabled, topViewLocked, gridSize,
  onToggleSnap, onToggleTopView, onSetGridSize,
  isolateEnabled, onToggleIsolate,
  lang,
}) => {
  const t = lang === 'zh';

  // Compact pill styles — themed. Font sizes are inline so they bypass the
  // global `text-[Xpx] { !important }` bump in themes.css; the HUD floats over
  // 3D and needs to stay compact regardless of the workspace font scale.
  const pillBase: React.CSSProperties = {
    background: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.09)',
    fontSize: '13px',
    lineHeight: 1.1,
    height: '34px',
  };
  const pillActive: React.CSSProperties = {
    ...pillBase,
    background: 'var(--color-accent)',
    border: '1px solid var(--color-accent)',
    color: 'var(--color-accent-fg)',
  };

  return (
    <>
      {/* Cursor coords + drawing hint (bottom-right) */}
      <div
        className="absolute bottom-3 right-3 z-30 rounded-md px-2.5 py-1.5 font-mono space-y-0.5 pointer-events-none"
        style={{
          background: 'rgba(0,0,0,0.78)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#ffffff',
          backdropFilter: 'blur(8px)',
          fontSize: '11px',
          lineHeight: 1.3,
        }}
      >
        <div>X: {cursor ? cursor.x.toFixed(2) : '—'}  Y: {cursor ? cursor.z.toFixed(2) : '—'} m</div>
        {hint && <div style={{ color: '#93c5fd' }}>{t ? '繪製中' : 'Drawing'} · {hint}</div>}
      </div>

      {/* Top-center status bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
        {/* SNAP toggle */}
        <button
          onClick={onToggleSnap}
          title={t ? '切換格點鎖定' : 'Toggle snap'}
          className="flex items-center gap-1.5 rounded-lg font-black transition-all whitespace-nowrap"
          style={{ ...(snapEnabled ? pillActive : pillBase), padding: '0 12px' }}
        >
          <span
            className="rounded-full inline-block flex-shrink-0"
            style={{
              width: '8px',
              height: '8px',
              background: snapEnabled ? '#34d399' : 'var(--color-muted)',
              boxShadow: snapEnabled ? '0 0 8px rgba(52,211,153,.7)' : 'none',
            }}
          />
          <span className="whitespace-nowrap">⊞ {t ? '鎖點' : 'SNAP'}: {snapEnabled ? 'ON' : 'OFF'}</span>
        </button>

        {/* Grid size segmented selector */}
        <div
          className="flex items-center rounded-lg"
          style={{
            ...pillBase,
            opacity: snapEnabled ? 1 : 0.45,
            cursor: snapEnabled ? 'default' : 'not-allowed',
            padding: '2px',
            gap: '2px',
          }}
        >
          <span
            className="uppercase tracking-wider whitespace-nowrap"
            style={{
              padding: '0 10px',
              fontSize: '12px',
              color: 'var(--color-muted)',
              fontWeight: 700,
            }}
          >
            {t ? '格距' : 'Grid'}
          </span>
          {GRID_OPTIONS.map(g => {
            const isActive = gridSize === g;
            return (
              <button
                key={g}
                onClick={() => onSetGridSize(g)}
                disabled={!snapEnabled}
                className="rounded-lg font-black transition-all whitespace-nowrap"
                style={{
                  padding: '4px 11px',
                  fontSize: '13px',
                  background: isActive ? 'var(--color-accent)' : 'transparent',
                  color: isActive ? 'var(--color-accent-fg)' : 'var(--color-text)',
                  border: 'none',
                  lineHeight: 1.1,
                }}
              >
                {g}m
              </button>
            );
          })}
        </div>

        {/* TOP-VIEW toggle */}
        <button
          onClick={onToggleTopView}
          title={t ? '切換俯視' : 'Toggle top view'}
          className="flex items-center gap-1.5 rounded-lg font-black transition-all whitespace-nowrap"
          style={{ ...(topViewLocked ? pillActive : pillBase), padding: '0 12px' }}
        >
          <span
            className="rounded-full inline-block flex-shrink-0"
            style={{
              width: '8px',
              height: '8px',
              background: topViewLocked ? '#60a5fa' : 'var(--color-muted)',
              boxShadow: topViewLocked ? '0 0 8px rgba(96,165,250,.7)' : 'none',
            }}
          />
          <span className="whitespace-nowrap">⬇ {t ? '俯視' : 'TOP'}: {topViewLocked ? 'ON' : 'OFF'}</span>
        </button>

        {/* ISOLATE-SELECTION toggle */}
        {onToggleIsolate && (
          <button
            onClick={onToggleIsolate}
            title={t ? '切換隔離選取（其他範圍刷淡）' : 'Toggle isolate selection (dim others)'}
            className="flex items-center gap-1.5 rounded-lg font-black transition-all whitespace-nowrap"
            style={{ ...(isolateEnabled ? pillActive : pillBase), padding: '0 12px' }}
          >
            <span
              className="rounded-full inline-block flex-shrink-0"
              style={{
                width: '8px',
                height: '8px',
                background: isolateEnabled ? '#f59e0b' : 'var(--color-muted)',
                boxShadow: isolateEnabled ? '0 0 8px rgba(245,158,11,.7)' : 'none',
              }}
            />
            <span className="whitespace-nowrap">◉ {t ? '隔離' : 'ISO'}: {isolateEnabled ? 'ON' : 'OFF'}</span>
          </button>
        )}
      </div>
    </>
  );
};

export default DrawingHUD;
