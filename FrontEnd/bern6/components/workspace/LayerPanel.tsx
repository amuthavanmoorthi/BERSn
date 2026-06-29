import React from 'react';

export type LayerKey = 'mainModel' | 'planes';

export interface LayerVisibility {
  /** 主體模型 — all extruded 3D shapes (box, cylinder, polygon, L, T, arc, ellipse, fan, polyline). */
  mainModel: boolean;
  /** 平面 — per-floor XZ working plane (snap grid + grid helper). */
  planes: boolean;
  // 預留擴充槽：baselinePlane / energyComponents / mep / envGrid / refUnderlay
}

/**
 * All shapes belong to 主體模型. The 平面 layer is the workplane (grid helper +
 * snap dots) toggled directly in ThreeDViewer, not a shape classification.
 */
export function layerKeyForShapeType(_shapeType: string): LayerKey {
  return 'mainModel';
}

interface Props {
  layers: LayerVisibility;
  onToggle: (key: LayerKey) => void;
}

const LayerPanel: React.FC<Props> = ({ layers, onToggle }) => {
  const Row: React.FC<{
    layerKey: LayerKey;
    tag: string;
    label: string;
    pct: string;
  }> = ({ layerKey, tag, label, pct }) => {
    const visible = layers[layerKey];
    return (
      <div className="flex items-center gap-2 py-1 px-1">
        <button
          type="button"
          onClick={() => onToggle(layerKey)}
          className="w-7 h-7 rounded flex items-center justify-center text-xs font-black transition-colors"
          style={{
            background: visible ? 'var(--color-accent)' : 'transparent',
            color: visible ? 'var(--color-accent-fg)' : 'var(--color-muted)',
            border: '1px solid var(--color-border)',
          }}
          title={visible ? '隱藏' : '顯示'}
          aria-pressed={visible}
        >
          👁
        </button>
        <span
          className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-black"
          style={{ background: 'var(--color-step-active-bg)', color: 'var(--color-step-active-text)' }}
        >
          {tag}
        </span>
        <span className="flex-1 text-xs" style={{ color: 'var(--color-text)' }}>{label}</span>
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{pct}</span>
      </div>
    );
  };

  return (
    <div
      className="border-t"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      {/* Region header */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{
          background: 'var(--color-step-active-bg)',
          borderBottom: '1px solid var(--color-border)',
          color: 'var(--color-step-active-text)',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 800 }}>面板（圖層／圖層資料顯示）</span>
        <span style={{ fontSize: '10px', fontWeight: 700, opacity: 0.7, letterSpacing: '0.05em' }}>LAYER-01</span>
      </div>

      <div className="p-2">
        <Row layerKey="mainModel" tag="M" label="主體模型（所有 3D 物件）" pct="100%" />
        <Row layerKey="planes"    tag="P" label="平面（樓層工作平面 XZ）" pct="100%" />
      </div>
    </div>
  );
};

export default LayerPanel;
