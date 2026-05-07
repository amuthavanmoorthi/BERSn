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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 shadow-2xl w-80 space-y-4 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-black text-white">{t ? '設定擠出高度' : 'Set Extrude Height'}</h3>
        {description && <p className="text-[13px] text-slate-400">{description}</p>}

        <div className="space-y-1">
          <label className="text-[12px] font-black text-slate-300 uppercase">{t ? '擠出高度 (m)' : 'Height (m)'}</label>
          <input
            type="number"
            value={height}
            step={0.1}
            min={0.5}
            onChange={(e) => setHeight(parseFloat(e.target.value) || 3.5)}
            className="w-full p-3 bg-slate-800 border border-white/20 rounded-xl text-white text-lg font-bold text-center outline-none focus:border-blue-500 transition-colors"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
          />
          {floorHeightHint != null && (
            <p className="text-[13px] text-slate-500 text-center">
              {t ? `樓層高度: ${floorHeightHint} m` : `Floor height: ${floorHeightHint} m`}
            </p>
          )}
        </div>

        {extraFields.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-[12px] font-black text-slate-300 uppercase">{f.label}</label>
            {f.kind === 'number' ? (
              <input
                type="number"
                value={extras[f.key] as number}
                step={f.step ?? 0.5}
                min={f.min}
                max={f.max}
                onChange={(e) => setExtras(s => ({ ...s, [f.key]: parseFloat(e.target.value) || f.defaultValue }))}
                className="w-full p-2 bg-slate-800 border border-white/20 rounded-lg text-white text-base font-bold text-center outline-none focus:border-blue-500"
              />
            ) : (
              <select
                value={extras[f.key] as string}
                onChange={(e) => setExtras(s => ({ ...s, [f.key]: e.target.value }))}
                className="w-full p-2 bg-slate-800 border border-white/20 rounded-lg text-white text-sm font-bold outline-none focus:border-blue-500"
              >
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>
        ))}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 font-bold text-xs hover:bg-slate-800 transition-all"
          >
            {t ? '取消' : 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-black text-xs hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30"
          >
            {t ? '確認擠出' : 'Extrude'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtrudeHeightDialog;
