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
  { kind: 'delete',   icon: '🗑', labelZh: '刪除', labelEn: 'Delete' },
  { kind: 'brush',    icon: '🖌', labelZh: '筆刷', labelEn: 'Brush' },
];

const SHAPE_TOOL_KINDS: ToolKind[] = ['box','cylinder','polygon','lShape','tShape','arc','ellipse','fan','polyline','move','rotate','delete'];

const ToolButton: React.FC<{ def: ToolDef; active: boolean; disabled: boolean; onPick: (k: ToolKind) => void; lang: 'zh'|'en' }> =
  ({ def, active, disabled, onPick, lang }) => (
    <button
      title={lang === 'zh' ? def.labelZh : def.labelEn}
      disabled={disabled}
      onClick={() => onPick(def.kind)}
      className={`w-10 h-10 flex items-center justify-center rounded-lg text-base font-black transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg'
          : disabled
            ? 'text-slate-600 cursor-not-allowed'
            : 'text-slate-300 hover:bg-white/10'
      }`}
    >
      {def.icon}
    </button>
  );

const Divider: React.FC = () => <div className="h-px bg-white/10 my-1" />;

const DrawingToolbar: React.FC<Props> = ({ current, onPick, topViewLocked, onToggleTopView, snapEnabled, onToggleSnap, lang, disabled, onUndo, onRedo, canUndo, canRedo, brushColor, onBrushColorChange }) => {
  const isShapeTool = (k: ToolKind) => SHAPE_TOOL_KINDS.includes(k);
  const groups = [TOOLS_TOP, TOOLS_SELECT, TOOLS_SHAPES, TOOLS_TRANSFORM];
  return (
    <div className="absolute top-3 left-3 z-30 bg-slate-900/85 backdrop-blur-xl rounded-xl p-1 shadow-2xl border border-white/10 flex flex-col gap-0.5">
      {groups.map((g, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <Divider />}
          {g.map(t => (
            <ToolButton
              key={t.kind}
              def={t}
              active={current === t.kind}
              disabled={!!disabled && isShapeTool(t.kind)}
              onPick={onPick}
              lang={lang}
            />
          ))}
        </React.Fragment>
      ))}
      <Divider />
      <button
        title={lang === 'zh' ? '復原 (Cmd/Ctrl+Z)' : 'Undo (Cmd/Ctrl+Z)'}
        onClick={() => onUndo?.()}
        disabled={!canUndo}
        className={`w-10 h-10 flex items-center justify-center rounded-lg text-base font-black transition-all ${
          canUndo ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'
        }`}
      >
        ↶
      </button>
      <button
        title={lang === 'zh' ? '重做 (Cmd/Ctrl+Shift+Z)' : 'Redo (Cmd/Ctrl+Shift+Z)'}
        onClick={() => onRedo?.()}
        disabled={!canRedo}
        className={`w-10 h-10 flex items-center justify-center rounded-lg text-base font-black transition-all ${
          canRedo ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 cursor-not-allowed'
        }`}
      >
        ↷
      </button>
      {/* Brush color picker (only visible when brush tool is active) */}
      {current === 'brush' && onBrushColorChange && (
        <>
          <Divider />
          <input
            type="color"
            value={brushColor || '#fbbf24'}
            onChange={(e) => onBrushColorChange(e.target.value)}
            title={lang === 'zh' ? '筆刷顏色' : 'Brush color'}
            className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent p-0"
          />
        </>
      )}
      <Divider />
      <button
        title={lang === 'zh' ? `格點鎖定 (${snapEnabled ? '開' : '關'})` : `Snap (${snapEnabled ? 'ON' : 'OFF'})`}
        onClick={onToggleSnap}
        className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-black transition-all ${
          snapEnabled ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-300 hover:bg-white/10'
        }`}
      >
        ⊞
      </button>
      <button
        title={lang === 'zh' ? '鎖定俯視' : 'Lock Top View'}
        onClick={onToggleTopView}
        className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-black transition-all ${
          topViewLocked ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-white/10'
        }`}
      >
        ⬇
      </button>
    </div>
  );
};

export default DrawingToolbar;
