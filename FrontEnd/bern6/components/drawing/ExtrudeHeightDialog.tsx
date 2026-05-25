import React, { useState, useEffect } from 'react';

export type ExtraField =
  | { kind: 'number'; key: string; label: string; defaultValue: number; min?: number; max?: number; step?: number }
  | { kind: 'select'; key: string; label: string; defaultValue: string; options: { value: string; label: string }[] };

interface Props {
  open: boolean;
  initialHeight: number;
  floorHeightHint?: number;
  description?: string;
  extraFields?: ExtraField[];
  lang: 'zh' | 'en';
  onConfirm: (height: number, extras: Record<string, number | string>) => void;
  onCancel: () => void;
}

// Shared CSS-var styles so the dialog adapts to the active workspace theme.
const dialogStyle: React.CSSProperties = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
};
const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
};
const dividerStyle: React.CSSProperties = { borderColor: 'var(--color-border)' };

const ExtrudeHeightDialog: React.FC<Props> = ({
  open, initialHeight, floorHeightHint, description, extraFields = [], lang, onConfirm, onCancel,
}) => {
  const t = lang === 'zh';
  const [height, setHeight] = useState(initialHeight);
  const [extras, setExtras] = useState<Record<string, number | string>>(() =>
    Object.fromEntries(extraFields.map(f => [f.key, f.defaultValue]))
  );

  useEffect(() => {
    if (open) {
      setHeight(initialHeight);
      setExtras(Object.fromEntries(extraFields.map(f => [f.key, f.defaultValue])));
    }
  }, [open, initialHeight, JSON.stringify(extraFields.map(f => [f.key, f.defaultValue]))]);

  if (!open) return null;

  const handleConfirm = () => onConfirm(height, extras);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="rounded-2xl shadow-2xl w-[26rem] max-w-[95vw] max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
        style={dialogStyle}
      >
        {/* Header — fixed */}
        <div className="px-4 pt-4 pb-2 flex-shrink-0 border-b" style={dividerStyle}>
          <h3 className="text-base font-black" style={{ color: 'var(--color-text)' }}>
            {t ? '設定擠出高度' : 'Set Extrude Height'}
          </h3>
          {description && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{description}</p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="px-4 py-3 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-2">
          <div className="space-y-1">
            <label className="text-[11px] font-black uppercase" style={{ color: 'var(--color-muted)' }}>
              {t ? '擠出高度 (m)' : 'Height (m)'}
            </label>
            <input
              type="number"
              value={height}
              step={0.1}
              min={0.5}
              onChange={(e) => setHeight(parseFloat(e.target.value) || 3.5)}
              className="w-full px-2 py-1.5 rounded-lg text-base font-bold text-center outline-none transition-colors focus:outline-none"
              style={{
                ...inputStyle,
                // focus ring via JS hover would be heavy; rely on default + accent-color hint
                accentColor: 'var(--color-accent)',
              }}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
            />
            {floorHeightHint != null && (
              <p className="text-[11px] text-center" style={{ color: 'var(--color-muted)' }}>
                {t ? `樓層高度: ${floorHeightHint} m` : `Floor height: ${floorHeightHint} m`}
              </p>
            )}
          </div>

          {/* Two-column grid for the extras to save vertical space */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-2">
            {extraFields.map(f => (
              <div key={f.key} className="space-y-0.5">
                <label
                  className="text-[10px] font-black uppercase truncate block"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {f.label}
                </label>
                {f.kind === 'number' ? (
                  <input
                    type="number"
                    value={extras[f.key] as number}
                    step={f.step ?? 0.5}
                    min={f.min}
                    max={f.max}
                    onChange={(e) => setExtras(s => ({ ...s, [f.key]: parseFloat(e.target.value) || f.defaultValue }))}
                    className="w-full px-2 py-1 rounded-md text-sm font-bold text-center outline-none"
                    style={inputStyle}
                  />
                ) : (
                  <select
                    value={extras[f.key] as string}
                    onChange={(e) => setExtras(s => ({ ...s, [f.key]: e.target.value }))}
                    className="w-full px-2 py-1 rounded-md text-xs font-bold outline-none"
                    style={inputStyle}
                  >
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer — fixed */}
        <div className="px-4 py-3 flex-shrink-0 border-t flex gap-2" style={dividerStyle}>
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg font-bold text-xs transition-all"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-muted)',
            }}
          >
            {t ? '取消' : 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg font-black text-xs transition-all shadow-lg"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-fg)',
            }}
          >
            {t ? '確認擠出' : 'Extrude'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtrudeHeightDialog;
