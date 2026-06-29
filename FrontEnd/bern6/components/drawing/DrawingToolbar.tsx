import React from 'react';
import { ToolKind } from '../../hooks/useDrawingTool';

interface Props {
  current: ToolKind;
  onPick: (tool: ToolKind) => void;
  topViewLocked: boolean;
  onToggleTopView: () => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  lang: 'zh' | 'en';
  disabled?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  brushColor?: string;
  onBrushColorChange?: (color: string) => void;
  /**
   * Layout mode:
   *   - 'overlay' (default): absolute-positioned over the 3D canvas (legacy).
   *   - 'inline':  lives in its own flex column outside the canvas; full-height
   *                of its container (new shell uses this).
   *
   * The inline variant also adopts the workspace CSS-variable theme so the
   * toolbar background, text, and accents follow the active palette.
   */
  variant?: 'overlay' | 'inline';
}

interface ToolDef { kind: ToolKind; icon: string; labelZh: string; labelEn: string; }

const TOOLS_TOP: ToolDef[] = [
  { kind: 'pan',      icon: '✋', labelZh: '縮放/平移', labelEn: 'Pan/Zoom' },
];
const TOOLS_SELECT: ToolDef[] = [
  { kind: 'select',   icon: '↖',  labelZh: '選取', labelEn: 'Select' },
];
const TOOLS_SHAPES: ToolDef[] = [
  { kind: 'box',      icon: '▭',  labelZh: '矩形', labelEn: 'Rectangle' },
  { kind: 'cylinder', icon: '○',  labelZh: '圓',   labelEn: 'Circle' },
  { kind: 'polygon',  icon: '⬡',  labelZh: '多邊形', labelEn: 'Polygon' },
  { kind: 'lShape',   icon: 'L',  labelZh: 'L 形', labelEn: 'L-Shape' },
  { kind: 'tShape',   icon: 'T',  labelZh: 'T 形', labelEn: 'T-Shape' },
  { kind: 'arc',      icon: '◗',  labelZh: '弧',   labelEn: 'Arc' },
  { kind: 'ellipse',  icon: '⬭',  labelZh: '橢圓', labelEn: 'Ellipse' },
  { kind: 'fan',      icon: '◔',  labelZh: '扇形', labelEn: 'Fan' },
  { kind: 'polyline', icon: '⌇',  labelZh: 'Polyline', labelEn: 'Polyline' },
];
const TOOLS_TRANSFORM: ToolDef[] = [
  { kind: 'move',     icon: '✥',  labelZh: '移動', labelEn: 'Move' },
  { kind: 'rotate',   icon: '↻',  labelZh: '旋轉', labelEn: 'Rotate' },
  { kind: 'deform',   icon: '⬚',  labelZh: '塊體變形', labelEn: 'Deform' },
  { kind: 'extrude',  icon: '⇪',  labelZh: '拉伸', labelEn: 'Extrude' },
  { kind: 'delete',   icon: '🗑', labelZh: '刪除', labelEn: 'Delete' },
  { kind: 'brush',    icon: '🖌', labelZh: '筆刷', labelEn: 'Brush' },
];

const SHAPE_TOOL_KINDS: ToolKind[] = ['box','cylinder','polygon','lShape','tShape','arc','ellipse','fan','polyline','move','rotate','deform','extrude','delete'];

// ---- Class helpers: switch between legacy (slate/blue hard-coded) and themed (CSS vars) ----

interface SkinClasses {
  wrapper: string;
  wrapperStyle?: React.CSSProperties;
  divider: string;
  dividerStyle?: React.CSSProperties;
  btnBase: string;
  // Style helpers that take into account current button state
  btnStyle: (opts: { active: boolean; disabled: boolean; accent?: 'primary' | 'snap' }) => React.CSSProperties;
}

function getSkin(variant: 'overlay' | 'inline'): SkinClasses {
  if (variant === 'overlay') {
    // Legacy look — high-contrast dark toolbar over 3D canvas (flag-off path).
    return {
      wrapper:
        'absolute top-3 bottom-3 left-3 z-30 bg-slate-900/85 backdrop-blur-xl rounded-xl p-1 shadow-2xl border border-white/10 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar',
      divider: 'h-px bg-white/10 my-1',
      btnBase: 'w-10 h-10 flex items-center justify-center rounded-lg text-base font-black transition-all',
      btnStyle: ({ active, disabled, accent }) => ({}),  // no inline-style overrides; legacy uses className for color
    };
  }
  // Inline variant — follows the workspace theme.
  return {
    wrapper:
      'h-full backdrop-blur-xl rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 overflow-y-auto custom-scrollbar',
    wrapperStyle: {
      background: 'var(--color-card)',
      border: '1px solid var(--color-border)',
    },
    divider: 'h-px my-1',
    dividerStyle: { background: 'var(--color-border)' },
    btnBase: 'w-10 h-10 flex items-center justify-center rounded-lg text-base font-black transition-all',
    btnStyle: ({ active, disabled, accent }) => {
      if (disabled) {
        return { color: 'var(--color-muted)', opacity: 0.4, cursor: 'not-allowed' };
      }
      if (active) {
        // 'snap' uses amber semantic (kept hard-coded — different meaning from primary accent),
        // 'primary' uses theme accent for selected tools / topview toggle
        const bg = accent === 'snap' ? '#f59e0b' : 'var(--color-accent)';
        return { background: bg, color: 'var(--color-accent-fg)', boxShadow: '0 4px 12px rgba(0,0,0,.15)' };
      }
      return { color: 'var(--color-text)' };
    },
  };
}

const ToolButton: React.FC<{
  def: ToolDef;
  active: boolean;
  disabled: boolean;
  onPick: (k: ToolKind) => void;
  lang: 'zh'|'en';
  skin: SkinClasses;
}> = ({ def, active, disabled, onPick, lang, skin }) => {
  // Legacy skin keeps className-based color logic for parity with previous look
  const legacyColorClass = skin.btnStyle === undefined
    ? ''
    : (active
        ? 'bg-blue-600 text-white shadow-lg'
        : disabled
          ? 'text-slate-600 cursor-not-allowed'
          : 'text-slate-300 hover:bg-white/10');
  // For inline skin we use inline styles only; legacy keeps className-based
  const usesInlineStyle = !!skin.wrapperStyle; // proxy for "inline variant"
  return (
    <button
      title={lang === 'zh' ? def.labelZh : def.labelEn}
      disabled={disabled}
      onClick={() => onPick(def.kind)}
      className={`${skin.btnBase} ${usesInlineStyle ? '' : legacyColorClass}`}
      style={usesInlineStyle ? skin.btnStyle({ active, disabled, accent: 'primary' }) : undefined}
    >
      {def.icon}
    </button>
  );
};

const Divider: React.FC<{ skin: SkinClasses }> = ({ skin }) => (
  <div className={skin.divider} style={skin.dividerStyle} />
);

const DrawingToolbar: React.FC<Props> = ({
  current, onPick, topViewLocked, onToggleTopView, snapEnabled, onToggleSnap,
  lang, disabled, onUndo, onRedo, canUndo, canRedo, brushColor, onBrushColorChange,
  variant = 'overlay',
}) => {
  const isShapeTool = (k: ToolKind) => SHAPE_TOOL_KINDS.includes(k);
  const groups = [TOOLS_TOP, TOOLS_SELECT, TOOLS_SHAPES, TOOLS_TRANSFORM];
  const skin = getSkin(variant);
  const isInline = variant === 'inline';

  // Renders an auxiliary button (undo/redo/snap/topview). Handles both skins.
  const AuxButton: React.FC<{
    title: string;
    active?: boolean;
    disabled?: boolean;
    accent?: 'primary' | 'snap';
    onClick?: () => void;
    children: React.ReactNode;
    sizeClass?: string;
  }> = ({ title, active = false, disabled = false, accent = 'primary', onClick, children, sizeClass = 'text-base' }) => {
    const legacyColorClass = !isInline
      ? (active
          ? (accent === 'snap' ? 'bg-amber-600 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg')
          : disabled
            ? 'text-slate-600 cursor-not-allowed'
            : 'text-slate-300 hover:bg-white/10')
      : '';
    return (
      <button
        title={title}
        onClick={onClick}
        disabled={disabled}
        className={`w-10 h-10 flex items-center justify-center rounded-lg ${sizeClass} font-black transition-all ${legacyColorClass}`}
        style={isInline ? skin.btnStyle({ active, disabled, accent }) : undefined}
      >
        {children}
      </button>
    );
  };

  return (
    <div className={skin.wrapper} style={skin.wrapperStyle}>
      {groups.map((g, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <Divider skin={skin} />}
          {g.map(t => (
            <ToolButton
              key={t.kind}
              def={t}
              active={current === t.kind}
              disabled={!!disabled && isShapeTool(t.kind)}
              onPick={onPick}
              lang={lang}
              skin={skin}
            />
          ))}
        </React.Fragment>
      ))}
      <Divider skin={skin} />
      <AuxButton
        title={lang === 'zh' ? '復原 (Cmd/Ctrl+Z)' : 'Undo (Cmd/Ctrl+Z)'}
        onClick={() => onUndo?.()}
        disabled={!canUndo}
      >↶</AuxButton>
      <AuxButton
        title={lang === 'zh' ? '重做 (Cmd/Ctrl+Shift+Z)' : 'Redo (Cmd/Ctrl+Shift+Z)'}
        onClick={() => onRedo?.()}
        disabled={!canRedo}
      >↷</AuxButton>
      {current === 'brush' && onBrushColorChange && (
        <>
          <Divider skin={skin} />
          <input
            type="color"
            value={brushColor || '#fbbf24'}
            onChange={(e) => onBrushColorChange(e.target.value)}
            title={lang === 'zh' ? '筆刷顏色' : 'Brush color'}
            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent p-0"
            style={isInline ? { border: '1px solid var(--color-border)' } : undefined}
          />
        </>
      )}
      <Divider skin={skin} />
      <AuxButton
        title={lang === 'zh' ? `格點鎖定 (${snapEnabled ? '開' : '關'})` : `Snap (${snapEnabled ? 'ON' : 'OFF'})`}
        onClick={onToggleSnap}
        active={snapEnabled}
        accent="snap"
        sizeClass="text-sm"
      >⊞</AuxButton>
      <AuxButton
        title={lang === 'zh' ? '鎖定俯視' : 'Lock Top View'}
        onClick={onToggleTopView}
        active={topViewLocked}
        sizeClass="text-sm"
      >⬇</AuxButton>
    </div>
  );
};

export default DrawingToolbar;
