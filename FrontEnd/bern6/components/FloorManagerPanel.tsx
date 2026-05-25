import React, { useState } from 'react';
import { Floor, FloorShape, GeometryType, LShapeDirection, TShapeWingPosition, PolylinePoint } from '../types';

interface FloorManagerPanelProps {
  floors: Floor[];
  onFloorsChange: (floors: Floor[]) => void;
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string | null) => void;
  selectedShapeId: string | null;
  onSelectShape: (shapeId: string | null) => void;
  onEnterTopView?: (floorId: string) => void;
  lang: 'zh' | 'en';
}

const GEOMETRY_LABELS: Record<GeometryType, { zh: string; en: string }> = {
  box: { zh: '長方體', en: 'Box' },
  lShape: { zh: 'L形複合體', en: 'L-Shape' },
  tShape: { zh: 'T形複合體', en: 'T-Shape' },
  cylinder: { zh: '圓柱體', en: 'Cylinder' },
  arc: { zh: '圓弧拉伸體', en: 'Arc' },
  ellipse: { zh: '橢圓柱', en: 'Ellipse' },
  fan: { zh: '扇形拉伸', en: 'Fan' },
  polygon: { zh: '多邊形棱柱', en: 'Polygon' },
  polyline: { zh: '自訂輪廓', en: 'Polyline' },
};

let shapeCounter = 100;
let floorCounter = 100;

const createDefaultShape = (): FloorShape => ({
  id: `shape-${Date.now()}-${shapeCounter++}`,
  type: 'box',
  params: { width: 40, length: 30, wwr: 0.35, glassType: 'Double', shadingType: 'None' },
  position: { x: 0, y: 0 },
  rotation: 0,
});

// Helpers for polyline shapes
const calcPolyArea = (pts: PolylinePoint[]): number => {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
};

// Set the length of edge starting at vertex `vi`. Keeps the start point fixed,
// moves the end point along the same direction; rest of the polyline shifts rigidly.
const setEdgeLength = (pts: PolylinePoint[], vi: number, newLen: number): PolylinePoint[] => {
  const N = pts.length;
  const a = pts[vi];
  const b = pts[(vi + 1) % N];
  const dx = b.x - a.x, dy = b.y - a.y;
  const cur = Math.hypot(dx, dy) || 1;
  const ux = dx / cur, uy = dy / cur;
  const nbx = a.x + ux * newLen;
  const nby = a.y + uy * newLen;
  const shiftX = nbx - b.x;
  const shiftY = nby - b.y;
  return pts.map((p, i) => {
    // Shift end point and everything after it (wrap-around handled by mod-traversal)
    const offset = (i - ((vi + 1) % N) + N) % N;
    if (i !== vi && offset < N - 1) return { x: p.x + shiftX, y: p.y + shiftY };
    return { ...p };
  });
};

// Set the included angle at vertex `vi`. Keeps prev and current vertex fixed,
// rotates the outgoing edge (and rest of polyline) so the interior angle matches.
const setVertexAngle = (pts: PolylinePoint[], vi: number, newAngleDeg: number): PolylinePoint[] => {
  const N = pts.length;
  const prev = pts[(vi - 1 + N) % N];
  const here = pts[vi];
  const next = pts[(vi + 1) % N];
  const v1x = here.x - prev.x, v1y = here.y - prev.y;
  const v2x = next.x - here.x, v2y = next.y - here.y;
  const a1 = Math.atan2(v1y, v1x);
  const a2 = Math.atan2(v2y, v2x);
  // Current interior angle and turn direction (sign)
  let turn = (a2 - a1) * 180 / Math.PI;
  while (turn > 180) turn -= 360;
  while (turn < -180) turn += 360;
  const sign = turn >= 0 ? 1 : -1;
  const newTurnRad = (180 - newAngleDeg) * sign * Math.PI / 180;
  const newA2 = a1 + newTurnRad;
  // Rotate the outgoing edge (and everything after `vi`) around `here` by deltaA = newA2 - a2
  const delta = newA2 - a2;
  const cos = Math.cos(delta), sin = Math.sin(delta);
  return pts.map((p, i) => {
    if (i === vi || i === (vi - 1 + N) % N) return { ...p };
    // Rotate this point around `here` by `delta`
    const dx = p.x - here.x, dy = p.y - here.y;
    return {
      x: here.x + dx * cos - dy * sin,
      y: here.y + dx * sin + dy * cos,
    };
  });
};

const FloorManagerPanel: React.FC<FloorManagerPanelProps> = ({
  floors,
  onFloorsChange,
  selectedFloorId,
  onSelectFloor,
  selectedShapeId,
  onSelectShape,
  onEnterTopView,
  lang,
}) => {
  const t = lang === 'zh';
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set(floors.map(f => f.id)));

  const inputClass = "p-1.5 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-lg text-[13px] font-bold text-[color:var(--color-text)] focus:bg-[color:var(--color-card)] outline-none transition-all text-center w-full";
  const labelClass = "text-[12px] font-black text-[color:var(--color-muted)] uppercase tracking-wide";
  const btnSmClass = "w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-[11px] transition-all hover:scale-105 active:scale-95";

  // Floor operations
  const addFloor = () => {
    const newFloor: Floor = {
      id: `floor-${Date.now()}-${floorCounter++}`,
      name: `${floors.length + 1}F`,
      floorHeight: 3.5,
      shapes: [],
    };
    const updated = [...floors, newFloor];
    onFloorsChange(updated);
    onSelectFloor(newFloor.id);
    setExpandedFloors(prev => new Set([...prev, newFloor.id]));
  };

  const deleteFloor = (floorId: string) => {
    const updated = floors.filter(f => f.id !== floorId);
    if (updated.length === 0) {
      // Last floor deleted: keep one empty floor as anchor
      const newFloor: Floor = {
        id: `floor-${Date.now()}`,
        name: '1F',
        floorHeight: 3.5,
        shapes: [],
      };
      onFloorsChange([newFloor]);
      onSelectFloor(newFloor.id);
      onSelectShape(null);
    } else {
      // Re-name remaining floors
      updated.forEach((f, i) => {
        if (!f.name.startsWith('B')) f.name = `${i + 1}F`;
      });
      onFloorsChange(updated);
      if (selectedFloorId === floorId) {
        onSelectFloor(updated[0]?.id || null);
        onSelectShape(null);
      }
    }
  };

  const duplicateFloor = (floorId: string) => {
    const floor = floors.find(f => f.id === floorId);
    if (!floor) return;
    const newId = `floor-${Date.now()}-${floorCounter++}`;
    const newFloor: Floor = {
      ...floor,
      id: newId,
      name: `${floors.length + 1}F`,
      shapes: floor.shapes.map(s => ({
        ...s,
        id: `shape-${Date.now()}-${shapeCounter++}`,
        params: { ...s.params },
        position: { ...s.position },
      })),
    };
    const idx = floors.findIndex(f => f.id === floorId);
    const updated = [...floors];
    updated.splice(idx + 1, 0, newFloor);
    // Re-name floors
    updated.forEach((f, i) => {
      if (!f.name.startsWith('B')) f.name = `${i + 1}F`;
    });
    onFloorsChange(updated);
    onSelectFloor(newId);
    setExpandedFloors(prev => new Set([...prev, newId]));
  };

  // Copy all shapes & params from this floor to the floor above
  const copyShapesToFloorAbove = (floorId: string) => {
    const idx = floors.findIndex(f => f.id === floorId);
    if (idx < 0 || idx >= floors.length - 1) return; // No floor above
    const sourceFloor = floors[idx];
    const targetFloorId = floors[idx + 1].id;

    const copiedShapes = sourceFloor.shapes.map(s => ({
      ...s,
      id: `shape-${Date.now()}-${shapeCounter++}`,
      params: { ...s.params },
      position: { ...s.position },
    }));

    const updated = floors.map(f =>
      f.id === targetFloorId
        ? { ...f, shapes: copiedShapes }
        : f
    );
    onFloorsChange(updated);
    onSelectFloor(targetFloorId);
    setExpandedFloors(prev => new Set([...prev, targetFloorId]));
  };

  const updateFloor = (floorId: string, updates: Partial<Floor>) => {
    onFloorsChange(floors.map(f => f.id === floorId ? { ...f, ...updates } : f));
  };

  const moveFloor = (floorId: string, direction: 'up' | 'down') => {
    const idx = floors.findIndex(f => f.id === floorId);
    if (direction === 'up' && idx > 0) {
      const updated = [...floors];
      [updated[idx], updated[idx - 1]] = [updated[idx - 1], updated[idx]];
      onFloorsChange(updated);
    } else if (direction === 'down' && idx < floors.length - 1) {
      const updated = [...floors];
      [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
      onFloorsChange(updated);
    }
  };

  // Shape operations
  const addShape = (floorId: string) => {
    const shape = createDefaultShape();
    onFloorsChange(floors.map(f =>
      f.id === floorId ? { ...f, shapes: [...f.shapes, shape] } : f
    ));
    onSelectShape(shape.id);
  };

  const deleteShape = (floorId: string, shapeId: string) => {
    onFloorsChange(floors.map(f => {
      if (f.id !== floorId) return f;
      if (f.shapes.length <= 1) return f; // Keep at least one shape
      return { ...f, shapes: f.shapes.filter(s => s.id !== shapeId) };
    }));
    if (selectedShapeId === shapeId) onSelectShape(null);
  };

  const duplicateShape = (floorId: string, shapeId: string) => {
    const floor = floors.find(f => f.id === floorId);
    const shape = floor?.shapes.find(s => s.id === shapeId);
    if (!shape) return;
    const newShape: FloorShape = {
      ...shape,
      id: `shape-${Date.now()}-${shapeCounter++}`,
      params: { ...shape.params },
      position: { x: shape.position.x + 5, y: shape.position.y + 5 },
    };
    onFloorsChange(floors.map(f =>
      f.id === floorId ? { ...f, shapes: [...f.shapes, newShape] } : f
    ));
    onSelectShape(newShape.id);
  };

  const updateShape = (floorId: string, shapeId: string, updates: Partial<FloorShape>) => {
    onFloorsChange(floors.map(f =>
      f.id === floorId ? {
        ...f,
        shapes: f.shapes.map(s =>
          s.id === shapeId ? { ...s, ...updates } : s
        )
      } : f
    ));
  };

  const updateShapeParams = (floorId: string, shapeId: string, paramUpdates: Partial<FloorShape['params']>) => {
    onFloorsChange(floors.map(f => {
      if (f.id !== floorId) return f;
      const next: Floor = {
        ...f,
        shapes: f.shapes.map(s =>
          s.id === shapeId ? { ...s, params: { ...s.params, ...paramUpdates } } : s
        ),
      };
      // Per-shape height edits do NOT modify floor.floorHeight or siblings.
      // Upper-floor stacking is computed in the renderer as
      // max(floor.floorHeight, all shape heights) so taller shapes push upper
      // floors up, while shorter siblings keep their own heights (no overlap).
      return next;
    }));
  };

  const toggleExpand = (floorId: string) => {
    setExpandedFloors(prev => {
      const next = new Set(prev);
      if (next.has(floorId)) next.delete(floorId);
      else next.add(floorId);
      return next;
    });
  };

  // Render shape-specific parameter inputs
  const renderShapeParams = (floorId: string, shape: FloorShape) => {
    const p = shape.params;
    const update = (u: Partial<FloorShape['params']>) => updateShapeParams(floorId, shape.id, u);

    const numInput = (label: string, value: number, key: string, min?: number, max?: number, step?: number) => (
      <div className="space-y-0.5">
        <label className={labelClass}>{label}</label>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step || 1}
          onChange={(e) => update({ [key]: parseFloat(e.target.value) || 0 })}
          className={inputClass}
        />
      </div>
    );

    const heightField = shape.type !== 'polyline'
      ? numInput(t ? '擠出高度' : 'Extrude H', p.height ?? 3.5, 'height', 0.5)
      : null;

    const body = (() => {
    switch (shape.type) {
      case 'box':
        return (
          <>
            {numInput(t ? '長度 (L)' : 'Length', p.length || 30, 'length', 1)}
            {numInput(t ? '寬度 (W)' : 'Width', p.width || 40, 'width', 1)}
          </>
        );
      case 'cylinder':
        return numInput(t ? '半徑 (R)' : 'Radius', p.radius || 15, 'radius', 1);
      case 'lShape':
        return (
          <>
            {numInput('L1', p.l1 || 40, 'l1', 1)}
            {numInput('W1', p.w1 || 20, 'w1', 1)}
            <div /> {/* keep grid alignment: skip 3rd column on row 1 */}
            {numInput('L2', p.l2 || 20, 'l2', 1)}
            {numInput('W2', p.w2 || 15, 'w2', 1)}
            <div />
            <div className="col-span-3 space-y-0.5">
              <label className={labelClass}>{t ? '轉折方向' : 'Direction'}</label>
              <div className="grid grid-cols-4 gap-1">
                {([
                  ['TopLeft', '↖'], ['TopRight', '↗'],
                  ['BottomLeft', '↙'], ['BottomRight', '↘'],
                ] as const).map(([val, ic]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => update({ lDirection: val as LShapeDirection })}
                    className={`py-1.5 rounded-lg text-sm font-black transition-all ${
                      (p.lDirection || 'TopLeft') === val
                        ? 'bg-blue-600 text-white'
                        : 'bg-[color:var(--color-bg)] text-[color:var(--color-muted)] hover:bg-[color:var(--color-bg)]'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </>
        );
      case 'tShape':
        return (
          <>
            {numInput('L1', p.l1 || 40, 'l1', 1)}
            {numInput('W1', p.w1 || 15, 'w1', 1)}
            <div />
            {numInput('L2', p.l2 || 30, 'l2', 1)}
            {numInput('W2', p.w2 || 20, 'w2', 1)}
            <div />
            <div className="col-span-3 space-y-0.5">
              <label className={labelClass}>{t ? '翼部位置' : 'Wing Pos'}</label>
              <div className="grid grid-cols-4 gap-1">
                {([
                  ['top', '↑'], ['bottom', '↓'], ['left', '←'], ['right', '→'],
                ] as const).map(([val, ic]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => update({ wingPosition: val as TShapeWingPosition })}
                    className={`py-1.5 rounded-lg text-sm font-black transition-all ${
                      (p.wingPosition || 'top') === val
                        ? 'bg-blue-600 text-white'
                        : 'bg-[color:var(--color-bg)] text-[color:var(--color-muted)] hover:bg-[color:var(--color-bg)]'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </>
        );
      case 'arc':
        return (
          <>
            {numInput(t ? '圓弧半徑' : 'Arc R', p.arcRadius || 30, 'arcRadius', 1)}
            {numInput(t ? '圓弧角度°' : 'Arc Angle°', p.arcAngle || 90, 'arcAngle', 1, 360)}
            {numInput(t ? '拉伸深度' : 'Depth', p.depth || 20, 'depth', 1)}
          </>
        );
      case 'ellipse':
        return (
          <>
            {numInput(t ? '長軸半徑' : 'Major R', p.majorRadius || 25, 'majorRadius', 1)}
            {numInput(t ? '短軸半徑' : 'Minor R', p.minorRadius || 15, 'minorRadius', 1)}
          </>
        );
      case 'fan':
        return (
          <>
            {numInput(t ? '內半徑' : 'Inner R', p.innerRadius || 10, 'innerRadius', 0)}
            {numInput(t ? '外半徑' : 'Outer R', p.outerRadius || 30, 'outerRadius', 1)}
            {numInput(t ? '扇形角度°' : 'Angle°', p.fanAngle || 90, 'fanAngle', 1, 360)}
          </>
        );
      case 'polygon':
        return (
          <>
            <div className="space-y-0.5">
              <label className={labelClass}>{t ? '邊數' : 'Sides'}</label>
              <select
                value={p.sides || 6}
                onChange={(e) => update({ sides: parseInt(e.target.value) })}
                className={inputClass}
              >
                {[4, 5, 6, 7, 8].map(n => (
                  <option key={n} value={n}>{n}{t ? '邊' : ' sides'}</option>
                ))}
              </select>
            </div>
            {numInput(t ? '外接圓R' : 'Circumradius', p.circumradius || 20, 'circumradius', 1)}
            {numInput(t ? '起始角度°' : 'Start Angle°', p.startAngle || 0, 'startAngle', 0, 360)}
          </>
        );
      case 'polyline':
        return (
          <>
            {p.points && p.isClosed && (
              <div className="col-span-3 space-y-1">
                <div className="flex justify-between text-[13px]">
                  <span className="text-emerald-400 font-bold">{t ? '面積' : 'Area'}: {calcPolyArea(p.points).toFixed(1)} m²</span>
                  <span className="text-[color:var(--color-muted)] font-bold">{p.points.length} {t ? '節點' : 'nodes'}</span>
                </div>
              </div>
            )}
            <div className="col-span-3">
              {numInput(t ? '擠出高度' : 'Extrude H', p.extrudeHeight || 3.5, 'extrudeHeight', 0.5)}
            </div>
            {p.points && p.isClosed && p.points.length >= 3 && (
              <div className="col-span-3 space-y-1 pt-1 border-t border-[color:var(--color-border)]">
                <div className="text-[11px] font-black text-[color:var(--color-muted)] uppercase tracking-wide">{t ? '邊長 / 夾腳' : 'Edges / Angles'}</div>
                <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {p.points.map((_pt, vi) => {
                    const pts = p.points!;
                    const N = pts.length;
                    const prev = pts[(vi - 1 + N) % N];
                    const here = pts[vi];
                    const next = pts[(vi + 1) % N];
                    const edgeLen = Math.hypot(next.x - here.x, next.y - here.y);
                    const v1x = here.x - prev.x, v1y = here.y - prev.y;
                    const v2x = next.x - here.x, v2y = next.y - here.y;
                    const a1 = Math.atan2(v1y, v1x);
                    const a2 = Math.atan2(v2y, v2x);
                    let turn = (a2 - a1) * 180 / Math.PI;
                    while (turn > 180) turn -= 360;
                    while (turn < -180) turn += 360;
                    const angleDeg = 180 - Math.abs(turn);
                    return (
                      <div key={vi} className="flex items-center gap-1.5 text-[11px]">
                        <span className="font-mono text-[color:var(--color-muted)] w-6 shrink-0">P{vi + 1}</span>
                        <span className="text-amber-400 shrink-0">∠</span>
                        <input
                          type="number"
                          step={1}
                          min={1}
                          max={359}
                          value={Number(angleDeg.toFixed(1))}
                          onChange={(e) => {
                            const newAng = parseFloat(e.target.value);
                            if (!isFinite(newAng)) return;
                            update({ points: setVertexAngle(pts, vi, newAng) });
                          }}
                          className="w-14 px-1 py-0.5 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded text-[color:var(--color-text)] font-mono text-center outline-none focus:bg-[color:var(--color-bg)]"
                        />
                        <span className="text-[color:var(--color-muted)] text-[10px] shrink-0">°</span>
                        <span className="text-blue-400 shrink-0 ml-1">L</span>
                        <input
                          type="number"
                          step={0.5}
                          min={0.1}
                          value={Number(edgeLen.toFixed(2))}
                          onChange={(e) => {
                            const newLen = parseFloat(e.target.value);
                            if (!isFinite(newLen) || newLen <= 0) return;
                            update({ points: setEdgeLength(pts, vi, newLen) });
                          }}
                          className="flex-1 min-w-0 px-1 py-0.5 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded text-[color:var(--color-text)] font-mono text-center outline-none focus:bg-[color:var(--color-bg)]"
                        />
                        <span className="text-[color:var(--color-muted)] text-[10px] shrink-0">m</span>
                        <button
                          onClick={() => {
                            if (pts.length <= 3) return;
                            update({ points: pts.filter((_, i) => i !== vi) });
                          }}
                          disabled={pts.length <= 3}
                          title={pts.length <= 3 ? (t ? '至少需 3 個節點' : 'Need ≥ 3 nodes') : (t ? '刪除節點' : 'Delete node')}
                          className={`w-5 h-5 shrink-0 rounded text-[12px] font-black transition-all flex items-center justify-center ${
                            pts.length <= 3
                              ? 'text-[color:var(--color-text)] cursor-not-allowed'
                              : 'text-red-400 hover:bg-red-500/20'
                          }`}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        );
      default:
        return null;
    }
    })();
    return <>{body}{heightField}</>;
  };

  return (
    <div className="text-[color:var(--color-text)] overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-[color:var(--color-border)] flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-sm font-black tracking-tight">
            {t ? '🏢 樓層建模' : '🏢 Floor Modeling'}
          </h3>
          <p className="text-[13px] text-[color:var(--color-muted)] font-bold">
            {t ? `${floors.length} 層 · ${floors.reduce((s, f) => s + f.shapes.length, 0)} 形狀` : `${floors.length} floors · ${floors.reduce((s, f) => s + f.shapes.length, 0)} shapes`}
          </p>
        </div>
        <button
          onClick={addFloor}
          className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-[12px] font-black uppercase tracking-wide transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/30"
        >
          + {t ? '新增樓層' : 'Add Floor'}
        </button>
      </div>

      {/* Floor List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {[...floors].reverse().map((floor, reverseIdx) => {
          const floorIdx = floors.length - 1 - reverseIdx;
          const isExpanded = expandedFloors.has(floor.id);
          const isSelected = floor.id === selectedFloorId;

          return (
            <div
              key={floor.id}
              className={`rounded-xl border transition-all duration-200 ${
                isSelected
                  ? 'border-blue-500/50 bg-blue-950/30 shadow-lg shadow-blue-500/10'
                  : 'border-[color:var(--color-border)] bg-[color:var(--color-bg)] hover:border-[color:var(--color-border)]'
              }`}
            >
              {/* Floor Header */}
              <div
                className="p-2.5 flex items-center gap-2 cursor-pointer select-none"
                onClick={() => {
                  onSelectFloor(floor.id);
                  onSelectShape(null);
                  toggleExpand(floor.id);
                }}
              >
                {/* Expand arrow */}
                <span className={`text-[12px] text-[color:var(--color-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                  ▶
                </span>

                {/* Floor name */}
                <input
                  value={floor.name}
                  onChange={(e) => updateFloor(floor.id, { name: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent border-none text-[13px] font-black text-[color:var(--color-text)] w-10 shrink-0 outline-none focus:bg-[color:var(--color-bg)] rounded px-1 transition-all"
                />

                {/* Floor height */}
                <div className="flex items-center gap-0.5 ml-auto mr-1.5 shrink-0">
                  <input
                    type="number"
                    value={floor.floorHeight}
                    step={0.1}
                    min={2}
                    max={10}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 3.5;
                      onFloorsChange(floors.map(f =>
                        f.id === floor.id
                          ? {
                              ...f,
                              floorHeight: val,
                              shapes: f.shapes.map(s =>
                                s.type === 'polyline'
                                  ? { ...s, params: { ...s.params, extrudeHeight: val } }
                                  : s
                              ),
                            }
                          : f
                      ));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title={t ? '樓層高度 (m)' : 'Floor height (m)'}
                    className="bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded text-[11px] font-bold text-[color:var(--color-text)] w-10 text-center outline-none focus:bg-[color:var(--color-bg)] py-0.5"
                  />
                  <span className="text-[10px] text-[color:var(--color-muted)]">m</span>
                </div>

                {/* Floor actions */}
                <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => moveFloor(floor.id, 'up')} className={`${btnSmClass} bg-[color:var(--color-bg)] text-[color:var(--color-muted)] hover:bg-[color:var(--color-bg)] ${floorIdx === 0 ? 'opacity-30 pointer-events-none' : ''}`} title={t ? '下移' : 'Move Down'}>↓</button>
                  <button onClick={() => moveFloor(floor.id, 'down')} className={`${btnSmClass} bg-[color:var(--color-bg)] text-[color:var(--color-muted)] hover:bg-[color:var(--color-bg)] ${floorIdx === floors.length - 1 ? 'opacity-30 pointer-events-none' : ''}`} title={t ? '上移' : 'Move Up'}>↑</button>
                  <button onClick={() => duplicateFloor(floor.id)} className={`${btnSmClass} bg-[color:var(--color-bg)] text-blue-400 hover:bg-blue-600/20`} title={t ? '複製樓層' : 'Duplicate Floor'}>⧉</button>
                  {onEnterTopView && (
                    <button
                      onClick={() => onEnterTopView(floor.id)}
                      className={`${btnSmClass} bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40`}
                      title={t ? '俯視編輯該樓層' : 'Top View Edit'}
                    >
                      📐
                    </button>
                  )}
                </div>
              </div>

              {/* Shapes List (Expanded) */}
              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-2 animate-in slide-in-from-top-1 duration-200">

                  {/* Copy shapes to floor above */}
                  {floorIdx < floors.length - 1 && (
                    <button
                      onClick={() => copyShapesToFloorAbove(floor.id)}
                      className="w-full min-w-0 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all text-amber-400"
                      title={t ? `複製形狀至 ${floors[floorIdx + 1]?.name}` : `Copy shapes to ${floors[floorIdx + 1]?.name}`}
                    >
                      <span className="text-xs shrink-0">⬆</span>
                      <span className="text-[11px] font-bold truncate">
                        {t ? `複製至 ${floors[floorIdx + 1]?.name}` : `Copy to ${floors[floorIdx + 1]?.name}`}
                      </span>
                    </button>
                  )}

                  {floor.shapes.map((shape, shapeIdx) => {
                    const isShapeSelected = shape.id === selectedShapeId;
                    return (
                      <div
                        key={shape.id}
                        className={`rounded-lg border p-2.5 transition-all cursor-pointer ${
                          isShapeSelected
                            ? 'border-blue-400/40 bg-blue-900/20'
                            : 'border-[color:var(--color-border)] bg-[color:var(--color-bg)] hover:border-[color:var(--color-border)]'
                        }`}
                        onClick={() => {
                          onSelectFloor(floor.id);
                          onSelectShape(shape.id);
                        }}
                      >
                        {/* Shape header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-black text-[color:var(--color-muted)]">#{shapeIdx + 1}</span>
                            <select
                              value={shape.type}
                              onChange={(e) => updateShape(floor.id, shape.id, { type: e.target.value as GeometryType })}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-lg text-[12px] font-bold text-[color:var(--color-text)] px-2 py-1 outline-none focus:bg-[color:var(--color-bg)] cursor-pointer"
                            >
                              {Object.entries(GEOMETRY_LABELS).map(([val, lbl]) => (
                                <option key={val} value={val}>{t ? lbl.zh : lbl.en}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => duplicateShape(floor.id, shape.id)} className={`${btnSmClass} bg-[color:var(--color-bg)] text-blue-400 hover:bg-blue-600/20 !w-6 !h-6 text-[12px]`} title={t ? '複製' : 'Copy'}>⧉</button>
                            <button onClick={() => deleteShape(floor.id, shape.id)} className={`${btnSmClass} bg-[color:var(--color-bg)] text-red-400 hover:bg-red-600/20 !w-6 !h-6 text-[12px] ${floor.shapes.length <= 1 ? 'opacity-30 pointer-events-none' : ''}`} title={t ? '刪除' : 'Del'}>✕</button>
                          </div>
                        </div>

                        {/* Shape params grid */}
                        {isShapeSelected && (
                          <div className="space-y-2 animate-in fade-in duration-200">
                            {/* Geometry params */}
                            <div className="grid grid-cols-3 gap-2">
                              {renderShapeParams(floor.id, shape)}
                            </div>

                            {/* Brush color */}
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                              <span className="text-[13px] font-black text-purple-400 shrink-0">{t ? '顏色' : 'Color'}</span>
                              <input
                                type="color"
                                value={shape.params.color || '#ffffff'}
                                onChange={(e) => updateShapeParams(floor.id, shape.id, { color: e.target.value })}
                                className="w-10 h-7 rounded cursor-pointer bg-transparent p-0 border-0"
                              />
                              <span className="text-[11px] text-[color:var(--color-muted)] font-mono flex-1">{shape.params.color || '#ffffff'}</span>
                              {shape.params.color && (
                                <button
                                  onClick={() => updateShapeParams(floor.id, shape.id, { color: undefined })}
                                  className="text-[10px] px-2 py-0.5 rounded bg-[color:var(--color-bg)] text-[color:var(--color-muted)] hover:bg-[color:var(--color-bg)]"
                                  title={t ? '清除' : 'Clear'}
                                >✕</button>
                              )}
                            </div>

                            {/* Per-face no-window toggles */}
                            <NoWindowFaceToggles
                              shape={shape}
                              lang={lang}
                              onToggle={(key) => {
                                const cur = new Set(shape.params.noWindowFaces || []);
                                if (cur.has(key)) cur.delete(key); else cur.add(key);
                                updateShapeParams(floor.id, shape.id, { noWindowFaces: Array.from(cur) });
                              }}
                            />

                            {/* Per-shape WWR */}
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                              <span className="text-[13px] font-black text-orange-400 shrink-0">{t ? '開窗率' : 'WWR'}</span>
                              <input
                                type="range"
                                min={5}
                                max={90}
                                step={1}
                                value={(shape.params.wwr ?? 0.35) * 100}
                                onChange={(e) => {
                                  const newWwr = parseInt(e.target.value) / 100;
                                  updateShapeParams(floor.id, shape.id, { wwr: newWwr });
                                }}
                                className="flex-1 h-1 appearance-none bg-[color:var(--color-bg)] rounded-full cursor-pointer accent-orange-500"
                              />
                              <span className="text-[12px] font-black text-orange-300 min-w-[32px] text-right">
                                {((shape.params.wwr ?? 0.35) * 100).toFixed(0)}%
                              </span>
                            </div>

                            {/* Per-shape Glazing & Shading override */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-0.5">
                                <label className="text-[12px] font-black text-cyan-400 uppercase">{t ? '窗戶' : 'Glass'}</label>
                                <select
                                  value={shape.params.glassType ?? 'Double'}
                                  onChange={(e) => updateShapeParams(floor.id, shape.id, { glassType: e.target.value as any })}
                                  onClick={(e) => e.stopPropagation()}
                                  className={inputClass}
                                >
                                  <option value="Single">{t ? '單層' : 'Single'}</option>
                                  <option value="Double">{t ? '雙層' : 'Double'}</option>
                                  <option value="Triple-LowE">{t ? '三層 LowE' : 'Triple-LowE'}</option>
                                  <option value="Vacuum">{t ? '真空' : 'Vacuum'}</option>
                                </select>
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-[12px] font-black text-cyan-400 uppercase">{t ? '遮陽' : 'Shade'}</label>
                                <select
                                  value={shape.params.shadingType ?? 'None'}
                                  onChange={(e) => updateShapeParams(floor.id, shape.id, { shadingType: e.target.value as any })}
                                  onClick={(e) => e.stopPropagation()}
                                  className={inputClass}
                                >
                                  <option value="None">{t ? '無' : 'None'}</option>
                                  <option value="Horizontal">{t ? '水平' : 'Horizontal'}</option>
                                  <option value="Vertical">{t ? '垂直' : 'Vertical'}</option>
                                  <option value="Eggcrate">{t ? '格柵' : 'Eggcrate'}</option>
                                  <option value="Louver">{t ? '百葉' : 'Louver'}</option>
                                </select>
                              </div>
                            </div>

                            {/* Position & Rotation */}
                            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[color:var(--color-border)]">
                              <div className="space-y-0.5">
                                <label className="text-[12px] font-black text-purple-400 uppercase">X</label>
                                <input
                                  type="number"
                                  value={shape.position.x}
                                  onChange={(e) => updateShape(floor.id, shape.id, {
                                    position: { ...shape.position, x: parseFloat(e.target.value) || 0 }
                                  })}
                                  onClick={(e) => e.stopPropagation()}
                                  className={inputClass}
                                />
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-[12px] font-black text-purple-400 uppercase">Y</label>
                                <input
                                  type="number"
                                  value={shape.position.y}
                                  onChange={(e) => updateShape(floor.id, shape.id, {
                                    position: { ...shape.position, y: parseFloat(e.target.value) || 0 }
                                  })}
                                  onClick={(e) => e.stopPropagation()}
                                  className={inputClass}
                                />
                              </div>
                              <div className="space-y-0.5">
                                <label className="text-[12px] font-black text-orange-400 uppercase">{t ? '旋轉°' : 'Rot°'}</label>
                                <input
                                  type="number"
                                  value={shape.rotation}
                                  onChange={(e) => updateShape(floor.id, shape.id, {
                                    rotation: parseFloat(e.target.value) || 0
                                  })}
                                  onClick={(e) => e.stopPropagation()}
                                  className={inputClass}
                                />
                              </div>
                            </div>


                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add shape button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); addShape(floor.id); }}
                    className="w-full py-2 rounded-lg border border-dashed border-[color:var(--color-border)] text-[12px] font-bold text-[color:var(--color-muted)] hover:border-[color:var(--color-border)] hover:text-[color:var(--color-text)] transition-all flex items-center justify-center gap-1"
                  >
                    <span>+</span> {t ? '新增形狀' : 'Add Shape'}
                  </button>

                  {/* Delete floor button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteFloor(floor.id); }}
                    className="w-full py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-[13px] font-bold text-red-400 hover:bg-red-500/15 hover:border-red-500/40 transition-all flex items-center justify-center gap-1"
                  >
                    <span>🗑️</span> {t ? `刪除 ${floor.name}` : `Delete ${floor.name}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----- Per-face no-window toggles ---------------------------------------

interface FaceToggleSpec { key: string; label: string; }

const getFaceSpecs = (shape: FloorShape, lang: 'zh' | 'en'): FaceToggleSpec[] => {
  const t = lang === 'zh';
  const p = shape.params;
  switch (shape.type) {
    case 'box':
      return [
        { key: 'N', label: t ? '北 N' : 'N' },
        { key: 'E', label: t ? '東 E' : 'E' },
        { key: 'S', label: t ? '南 S' : 'S' },
        { key: 'W', label: t ? '西 W' : 'W' },
      ];
    case 'cylinder':
    case 'polygon':
    case 'ellipse':
      return [{ key: 'side', label: t ? '曲面' : 'Curve' }];
    case 'arc':
      return [
        { key: 'outer', label: t ? '外弧' : 'Outer' },
        { key: 'inner', label: t ? '內弧' : 'Inner' },
        { key: 'side1', label: t ? '邊1' : 'Side 1' },
        { key: 'side2', label: t ? '邊2' : 'Side 2' },
      ];
    case 'fan': {
      const annular = (p.innerRadius ?? 0) > 0.01;
      const base = [
        { key: 'outer', label: t ? '外弧' : 'Outer' },
        { key: 'side1', label: t ? '邊1' : 'Side 1' },
        { key: 'side2', label: t ? '邊2' : 'Side 2' },
      ];
      return annular ? [...base, { key: 'inner', label: t ? '內弧' : 'Inner' }] : base;
    }
    case 'polyline': {
      const n = p.points?.length ?? 0;
      return Array.from({ length: n }, (_, i) => ({ key: `edge-${i}`, label: `${t ? '邊' : 'E'}${i + 1}` }));
    }
    case 'lShape':
    case 'tShape': {
      const n = shape.type === 'lShape' ? 6 : 8;
      return Array.from({ length: n }, (_, i) => ({ key: `edge-${i}`, label: `${t ? '邊' : 'E'}${i + 1}` }));
    }
    default:
      return [];
  }
};

const NoWindowFaceToggles: React.FC<{
  shape: FloorShape;
  lang: 'zh' | 'en';
  onToggle: (key: string) => void;
}> = ({ shape, lang, onToggle }) => {
  const t = lang === 'zh';
  const specs = getFaceSpecs(shape, lang);
  const noWin = new Set(shape.params.noWindowFaces || []);
  if (specs.length === 0) return null;
  return (
    <div className="space-y-1 p-2 rounded-lg bg-slate-700/30 border border-[color:var(--color-border)]">
      <div className="text-[11px] font-black text-[color:var(--color-muted)] uppercase tracking-wide">
        {t ? '不開窗的面' : 'Faces without windows'}
      </div>
      <div className="flex flex-wrap gap-1">
        {specs.map(s => {
          const active = noWin.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => onToggle(s.key)}
              title={s.label}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                active
                  ? 'bg-slate-600 text-white border border-slate-400'
                  : 'bg-[color:var(--color-bg)] text-[color:var(--color-muted)] hover:bg-[color:var(--color-bg)] border border-[color:var(--color-border)]'
              }`}
            >
              {active ? '✕ ' : '◻ '}{s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FloorManagerPanel;
