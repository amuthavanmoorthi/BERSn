import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Floor, FloorShape, GeometryType } from '../types';
import { ExtraField } from '../components/drawing/ExtrudeHeightDialog';
import { shapeAnchors } from '../services/areaUnion';

const SNAP_THRESHOLD_M = 1.0; // snap within 1 meter of another shape's edge anchor

export type ToolKind =
  | 'pan'
  | 'select'
  | 'box' | 'cylinder' | 'polygon'
  | 'lShape' | 'tShape'
  | 'arc' | 'ellipse' | 'fan'
  | 'polyline'
  | 'move' | 'rotate' | 'delete'
  | 'deform' | 'extrude'
  | 'brush';

type World = { x: number; z: number };

export type DrawingState =
  | { kind: 'idle' }
  | { kind: 'placing'; tool: ToolKind; points: World[]; cursor: World }
  | { kind: 'awaiting-extrude'; tool: ToolKind; baseParams: Partial<FloorShape['params']>; position: { x: number; y: number }; rotation?: number }
  | { kind: 'transforming'; mode: 'move' | 'rotate'; shapeId: string; floorId: string; start: World; origPos: { x: number; y: number }; origRot: number }
  // 3-click move flow:
  //   Click 1: select shape → enter 'move-selected'. The shape's vertices/midpoints are highlighted.
  //   Click 2: pick a grip vertex on the selected shape → enter 'placing-move'.
  //   Click 3: place onto a target anchor of another shape → commit, back to 'idle'.
  | { kind: 'move-selected'; shapeId: string; floorId: string }
  | { kind: 'placing-move'; shapeId: string; floorId: string; gripOffset: { x: number; y: number } }
  // Face push-pull: drag mouse vertically on canvas after picking a shape to set height.
  | { kind: 'extruding'; shapeId: string; floorId: string; heightKey: 'height' | 'extrudeHeight' };

interface Args {
  floors: Floor[];
  activeFloorId: string | null;
  selectedShapeId: string | null;
  onFloorsChange: (floors: Floor[]) => void;
  onSelectShape: (id: string | null) => void;
  onSelectFloor?: (id: string | null) => void;
  onToast: (msg: string) => void;
  /** When set, move-tool snaps shape position to nearest grid intersection (after anchor-snap). */
  gridSnap?: { gridSize: number };
  /**
   * Per-project facade defaults for newly drawn shapes. Sourced from STEP 3
   * Envelope (selectedGlazing / selectedShading). Per-shape overrides happen
   * in FloorManagerPanel after creation.
   */
  facadeDefaults?: { wwr?: number; glassType?: 'Single' | 'Double' | 'Triple-LowE' | 'Vacuum'; shadingType?: 'None' | 'Horizontal' | 'Vertical' | 'Eggcrate' | 'Louver' };
}

const FALLBACK_FACADE = { wwr: 0.35, glassType: 'Double' as const, shadingType: 'None' as const };

// Sample N points along the circular arc passing through (a, b, c).
// Returns the samples *excluding* `a` (which is already the previous vertex),
// *including* `c` (the new endpoint). Falls back to a straight line if the
// three points are collinear.
function tessellateArc3pt(a: World, b: World, c: World, n: number): World[] {
  const ax = a.x, ay = a.z, bx = b.x, by = b.z, cx = c.x, cy = c.z;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-6) return [c]; // collinear → single straight segment
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const r = Math.hypot(ax - ux, ay - uy);
  const aA = Math.atan2(ay - uy, ax - ux);
  const aB = Math.atan2(by - uy, bx - ux);
  const aC = Math.atan2(cy - uy, cx - ux);
  // Walk from aA toward aC, passing through aB. Pick the sweep direction that
  // makes aB fall between aA and aC.
  const norm = (t: number) => { while (t > Math.PI) t -= 2 * Math.PI; while (t < -Math.PI) t += 2 * Math.PI; return t; };
  const sweepCW = norm(aC - aA);
  const passesB_CW = (sweepCW >= 0) ? (norm(aB - aA) >= 0 && norm(aB - aA) <= sweepCW) : (norm(aB - aA) <= 0 && norm(aB - aA) >= sweepCW);
  const sweep = passesB_CW ? sweepCW : (sweepCW >= 0 ? sweepCW - 2 * Math.PI : sweepCW + 2 * Math.PI);
  const out: World[] = [];
  for (let i = 1; i <= n; i++) {
    const t = aA + (sweep * i) / n;
    out.push({ x: ux + r * Math.cos(t), z: uy + r * Math.sin(t) });
  }
  return out;
}

export function useDrawingTool(args: Args) {
  const [tool, setToolState] = useState<ToolKind>('pan');
  const [state, setState] = useState<DrawingState>({ kind: 'idle' });
  // Active brush color (used when brush tool clicks on a shape)
  const [brushColor, setBrushColor] = useState<string>('#fbbf24');
  // Angle-snap step in degrees (0 = off). CAD-style polar tracking: the
  // polyline cursor snaps to multiples of this step relative to the last
  // placed point. Toggled from the paramBar angle chips.
  const [angleSnapDeg, setAngleSnapDeg] = useState<number>(0);
  const angleSnapRef = useRef(angleSnapDeg);
  angleSnapRef.current = angleSnapDeg;
  // While the paramBar (length / angle) input is focused, freeze the cursor
  // so mouse moves don't interfere with what the user is typing. Cleared on
  // blur or commit.
  const inputFocusRef = useRef(false);
  const setInputFocused = useCallback((focused: boolean) => {
    inputFocusRef.current = focused;
  }, []);
  // After the user presses Enter in the paramBar, lock the cursor at the
  // previewed (length × snapped-angle) position so it stays put while the
  // mouse moves back to the canvas. The next canvas click *confirms* the
  // preview (commits the point) and releases the lock.
  const cursorLockRef = useRef(false);
  // Polyline segment sub-mode: 'line' = each click adds 1 vertex;
  // 'arc' = first click sets arc midpoint (stored in arcMidRef, not appended),
  // second click sets endpoint → tessellate 3-point arc through (lastVertex, mid, end).
  const [polylineSegMode, setPolylineSegMode] = useState<'line' | 'arc'>('line');
  const polylineSegModeRef = useRef(polylineSegMode);
  polylineSegModeRef.current = polylineSegMode;
  const arcMidRef = useRef<World | null>(null);
  // 3D polyline mode: when true, ThreeDViewer does NOT auto-lock the camera to
  // top view, so the user can draw polylines while orbiting in perspective.
  // Points still project onto the active floor's base plane (per-vertex Y
  // requires a schema change — future Phase C2).
  const [polyline3D, setPolyline3D] = useState<boolean>(false);
  // Declared early — used by both phase-2 setState and the paramSpecs/commit logic below.
  const placingMoveOriginRef = useRef<{ x: number; z: number } | null>(null);
  // Live ref to args (esp. floors + onFloorsChange) so async commits never
  // see a stale closure. Updated synchronously each render.
  const argsRef = useRef(args);
  argsRef.current = args;
  const getFacadeDefaults = () => ({ ...FALLBACK_FACADE, ...argsRef.current.facadeDefaults });
  const stateRef = useRef(state);
  stateRef.current = state;

  const setTool = useCallback((next: ToolKind) => {
    setToolState(prev => (prev === next ? 'pan' : next));
    setState({ kind: 'idle' });
    setAngleSnapDeg(0);  // drop any polar-track lock when tool changes
    cursorLockRef.current = false;
    arcMidRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    cursorLockRef.current = false;
    arcMidRef.current = null;
    setState({ kind: 'idle' });
  }, []);

  const findShapeAt = useCallback((shapeId: string) => {
    for (const f of argsRef.current.floors) {
      const s = f.shapes.find(s => s.id === shapeId);
      if (s) return { floor: f, shape: s };
    }
    return null;
  }, [argsRef.current.floors]);

  const removeShape = useCallback((floorId: string, shapeId: string) => {
    const next = argsRef.current.floors.map(f =>
      f.id === floorId ? { ...f, shapes: f.shapes.filter(s => s.id !== shapeId) } : f
    );
    argsRef.current.onFloorsChange(next);
  }, [args]);

  const handlePointerMove = useCallback((world: World | null) => {
    if (!world) return;
    // Freeze cursor while the user is typing in the paramBar — otherwise
    // mouse moves over the canvas keep overwriting their typed value and the
    // input is impossible to operate.
    if (inputFocusRef.current) return;
    // After paramBar Enter, cursor is held at the preview position until the
    // user confirms with a canvas click. Mouse moves in between do nothing.
    if (cursorLockRef.current) return;
    setState(s => {
      if (s.kind === 'placing-move') {
        // World is pre-snapped by ThreeDViewer (vertex/grid). Use as-is so
        // the live preview position matches exactly what a click would commit.
        const target = world;
        const newPos = { x: target.x - s.gripOffset.x, y: target.z - s.gripOffset.y };
        const next = argsRef.current.floors.map(f =>
          f.id === s.floorId
            ? { ...f, shapes: f.shapes.map(sh => sh.id === s.shapeId ? { ...sh, position: newPos } : sh) }
            : f
        );
        argsRef.current.onFloorsChange(next);
        return s;
      }
      if (s.kind === 'placing') {
        // For polyline: snap cursor to any already-placed vertex (esp. the start)
        // when within SNAP_THRESHOLD_M, so the user can easily close the loop.
        if (s.tool === 'polyline' && s.points.length >= 1) {
          let best: World | null = null;
          let bestDist = SNAP_THRESHOLD_M;
          for (const pt of s.points) {
            const d = Math.hypot(world.x - pt.x, world.z - pt.z);
            if (d < bestDist) { bestDist = d; best = pt; }
          }
          if (best) return { ...s, cursor: best };

          // CAD-style polar tracking: snap the cursor direction from the last
          // placed point to multiples of `angleSnapDeg`. Length is preserved.
          const snapDeg = angleSnapRef.current;
          if (snapDeg > 0) {
            const last = s.points[s.points.length - 1];
            const dx = world.x - last.x;
            const dz = world.z - last.z;
            const len = Math.hypot(dx, dz);
            if (len >= 0.01) {
              const angleRad = Math.atan2(dz, dx);
              const stepRad = (snapDeg * Math.PI) / 180;
              const snappedRad = Math.round(angleRad / stepRad) * stepRad;
              return {
                ...s,
                cursor: {
                  x: last.x + Math.cos(snappedRad) * len,
                  z: last.z + Math.sin(snappedRad) * len,
                },
              };
            }
          }
        }
        return { ...s, cursor: world };
      }
      if (s.kind === 'transforming') {
        const found = findShapeAt(s.shapeId);
        if (!found) return s;
        if (s.mode === 'move') {
          const dx = world.x - s.start.x;
          const dz = world.z - s.start.z;
          let proposed = { x: s.origPos.x + dx, y: s.origPos.y + dz };
          // When snap is on, eagerly round to grid — even if origPos was
          // off-grid (e.g. shape created with a non-aligned center) this brings
          // the shape onto the grid as soon as the user starts moving it.
          if (args.gridSnap) {
            const g = args.gridSnap.gridSize;
            proposed = {
              x: Math.round(proposed.x / g) * g,
              y: Math.round(proposed.y / g) * g,
            };
          }

          // Snap-to-anchor: align the dragged shape's anchors with any other
          // shape's anchor on the same floor when within SNAP_THRESHOLD_M.
          // Disabled when snap mode (gridSnap arg) is off.
          const targetFloor = args.gridSnap ? argsRef.current.floors.find(f => f.id === s.floorId) : undefined;
          if (targetFloor) {
            const draggedPreview: FloorShape = { ...found.shape, position: proposed };
            const myAnchors = shapeAnchors(draggedPreview);
            const otherAnchors: { x: number; y: number }[] = [];
            for (const sh of targetFloor.shapes) {
              if (sh.id === s.shapeId) continue;
              for (const a of shapeAnchors(sh)) otherAnchors.push(a);
            }
            let bestDist = SNAP_THRESHOLD_M;
            let bestDelta: { dx: number; dy: number } | null = null;
            for (const m of myAnchors) {
              for (const o of otherAnchors) {
                const dist = Math.hypot(o.x - m.x, o.y - m.y);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestDelta = { dx: o.x - m.x, dy: o.y - m.y };
                }
              }
            }
            if (bestDelta) {
              proposed = { x: proposed.x + bestDelta.dx, y: proposed.y + bestDelta.dy };
            } else if (args.gridSnap) {
              // Fallback: snap to grid (round position to nearest grid intersection)
              const g = args.gridSnap.gridSize;
              proposed = {
                x: Math.round(proposed.x / g) * g,
                y: Math.round(proposed.y / g) * g,
              };
            }
          }

          const next = argsRef.current.floors.map(f =>
            f.id === s.floorId
              ? { ...f, shapes: f.shapes.map(sh =>
                  sh.id === s.shapeId
                    ? { ...sh, position: proposed }
                    : sh
                )}
              : f
          );
          argsRef.current.onFloorsChange(next);
        } else if (s.mode === 'rotate') {
          // Angle from shape center
          const cx = found.shape.position.x;
          const cy = found.shape.position.y;
          const a0 = Math.atan2(s.start.z - cy, s.start.x - cx);
          const a1 = Math.atan2(world.z - cy, world.x - cx);
          const deltaDeg = ((a1 - a0) * 180) / Math.PI;
          const newRot = s.origRot + deltaDeg;
          const next = argsRef.current.floors.map(f =>
            f.id === s.floorId
              ? { ...f, shapes: f.shapes.map(sh =>
                  sh.id === s.shapeId ? { ...sh, rotation: newRot } : sh
                )}
              : f
          );
          argsRef.current.onFloorsChange(next);
        }
      }
      return s;
    });
  }, [args, findShapeAt]);

  const handlePointerDown = useCallback((world: World | null, _event: PointerEvent, hitShapeId?: string, hitFloorId?: string) => {
    if (tool === 'pan') return;

    // Shape-only tools fire regardless of world projection — they only need
    // the raycast hit info, not floor-plane coords. (A click on a tall shape
    // can miss the floor plane entirely.)
    if (tool === 'select') {
      args.onSelectShape(hitShapeId ?? null);
      return;
    }
    if (tool === 'deform') {
      args.onSelectShape(hitShapeId ?? null);
      if (hitShapeId && hitFloorId && argsRef.current.onSelectFloor) {
        argsRef.current.onSelectFloor(hitFloorId);
      }
      argsRef.current.onToast?.('於形狀面板調整尺寸');
      return;
    }
    if (tool === 'extrude') {
      // Prefer the already-selected shape over the raycast hit. From a typical
      // perspective view, the ray often pierces the topmost floor's roof first
      // and would hijack the extrude target away from what the user picked.
      // Workflow: select the shape (via 選取 tool / panel / canvas click), then
      // activate 拉伸 — the drag now operates on that shape regardless of where
      // the click lands.
      const selId = argsRef.current.selectedShapeId;
      let targetShapeId = selId ?? hitShapeId;
      let targetFloorId = hitFloorId;
      if (selId) {
        const sel = findShapeAt(selId);
        if (sel) targetFloorId = sel.floor.id;
      }
      if (!targetShapeId || !targetFloorId) {
        argsRef.current.onToast?.('請先選取形狀，再用拉伸工具');
        return;
      }
      const found = findShapeAt(targetShapeId);
      if (!found) return;
      args.onSelectShape(targetShapeId);
      argsRef.current.onSelectFloor?.(targetFloorId);
      const heightKey: 'height' | 'extrudeHeight' = found.shape.type === 'polyline' ? 'extrudeHeight' : 'height';
      setState({ kind: 'extruding', shapeId: targetShapeId, floorId: targetFloorId, heightKey });
      argsRef.current.onToast?.('拖曳滑鼠調整高度');
      return;
    }
    if (tool === 'delete') {
      if (hitShapeId && hitFloorId) removeShape(hitFloorId, hitShapeId);
      return;
    }
    if (tool === 'brush') {
      if (!hitShapeId || !hitFloorId) return;
      // Apply current brush color to the clicked shape
      const next = argsRef.current.floors.map(f =>
        f.id === hitFloorId
          ? { ...f, shapes: f.shapes.map(sh => sh.id === hitShapeId ? { ...sh, params: { ...sh.params, color: brushColor } } : sh) }
          : f
      );
      argsRef.current.onFloorsChange(next);
      argsRef.current.onSelectShape(hitShapeId);
      return;
    }

    // Tools below need world (floor-plane coords) for rotation pivot / shape
    // placement / move start anchor.
    if (!world) return;

    if (tool === 'rotate') {
      if (!hitShapeId || !hitFloorId) return;
      const found = findShapeAt(hitShapeId);
      if (!found) return;
      args.onSelectShape(hitShapeId);
      setState({
        kind: 'transforming',
        mode: 'rotate',
        shapeId: hitShapeId,
        floorId: hitFloorId,
        start: world,
        origPos: { ...found.shape.position },
        origRot: found.shape.rotation || 0,
      });
      return;
    }

    if (tool === 'move') {
      // 3-phase move: select shape → pick grip vertex → place to target anchor.
      const cur = stateRef.current;

      // === Phase 3: place onto snapped target ===
      if (cur.kind === 'placing-move') {
        // World is already snapped (vertex / grid) by ThreeDViewer. Don't
        // re-snap here — that previously could override grid snap with a
        // nearby off-grid vertex and produce inaccurate placement.
        const target = world;
        const newPos = { x: target.x - cur.gripOffset.x, y: target.z - cur.gripOffset.y };
        const next = argsRef.current.floors.map(f =>
          f.id === cur.floorId
            ? { ...f, shapes: f.shapes.map(sh => sh.id === cur.shapeId ? { ...sh, position: newPos } : sh) }
            : f
        );
        argsRef.current.onFloorsChange(next);
        setState({ kind: 'idle' });
        return;
      }

      // === Phase 2: pick grip vertex on the already-selected shape ===
      if (cur.kind === 'move-selected') {
        const found = findShapeAt(cur.shapeId);
        if (!found) { setState({ kind: 'idle' }); return; }
        // Snap clicked world to closest anchor of the selected shape (no distance limit).
        let grip = world;
        let bestDist = Infinity;
        for (const a of shapeAnchors(found.shape)) {
          const d = Math.hypot(a.x - world.x, a.y - world.z);
          if (d < bestDist) { bestDist = d; grip = { x: a.x, z: a.y }; }
        }
        placingMoveOriginRef.current = { x: grip.x, z: grip.z };
        setState({
          kind: 'placing-move',
          shapeId: cur.shapeId,
          floorId: cur.floorId,
          gripOffset: { x: grip.x - found.shape.position.x, y: grip.z - found.shape.position.y },
        });
        return;
      }

      // === Phase 1: select a shape ===
      if (!hitShapeId || !hitFloorId) {
        // Clicked empty space — clear any previous selection
        args.onSelectShape(null);
        setState({ kind: 'idle' });
        return;
      }
      args.onSelectShape(hitShapeId);
      args.onSelectFloor?.(hitFloorId);
      setState({ kind: 'move-selected', shapeId: hitShapeId, floorId: hitFloorId });
      return;
    }

    // Shape tools require an active floor
    if (!args.activeFloorId) {
      args.onToast('請先在右側面板選一個樓層');
      return;
    }

    // 2-click shapes (start a placing then complete)
    if (tool === 'box') {
      setState(s => {
        if (s.kind !== 'placing' || s.tool !== tool) {
          return { kind: 'placing', tool, points: [world], cursor: world };
        }
        const a = s.points[0];
        const w = Math.abs(world.x - a.x);
        const l = Math.abs(world.z - a.z);
        if (w < 0.1 || l < 0.1) return s;
        const cx = (a.x + world.x) / 2;
        const cz = (a.z + world.z) / 2;
        return {
          kind: 'awaiting-extrude',
          tool,
          baseParams: { width: w, length: l, ...getFacadeDefaults() },
          position: { x: cx, y: cz },
        };
      });
      return;
    }

    // L-shape: free-form 6-vertex outline. Stored as polyline with l/t metadata
    // so the create-time dialog still recognises it.
    // T-shape: same but 8 vertices.
    if (tool === 'lShape' || tool === 'tShape') {
      const targetN = tool === 'lShape' ? 6 : 8;
      setState(s => {
        if (s.kind !== 'placing' || s.tool !== tool) {
          return { kind: 'placing', tool, points: [world], cursor: world };
        }
        // Snap to existing placed points
        let snapped = world;
        let bestDist = SNAP_THRESHOLD_M;
        for (const pt of s.points) {
          const d = Math.hypot(world.x - pt.x, world.z - pt.z);
          if (d < bestDist) { bestDist = d; snapped = pt; }
        }
        const nextPoints = [...s.points, snapped];
        if (nextPoints.length >= targetN) {
          // Auto-close: keep type as lShape/tShape (label preserved) but
          // store the drawn outline in params.points for accurate rendering.
          const pts = nextPoints.map(p => ({ x: p.x, y: -p.z }));
          return {
            kind: 'awaiting-extrude',
            tool,
            baseParams: { points: pts, isClosed: true, ...getFacadeDefaults() },
            position: { x: 0, y: 0 },
          };
        }
        return { ...s, points: nextPoints, cursor: snapped };
      });
      return;
    }

    // Center + radius shapes
    if (tool === 'cylinder' || tool === 'polygon') {
      setState(s => {
        if (s.kind !== 'placing' || s.tool !== tool) {
          return { kind: 'placing', tool, points: [world], cursor: world };
        }
        const c = s.points[0];
        const radius = Math.hypot(world.x - c.x, world.z - c.z);
        if (radius < 0.1) return s;
        const baseParams: Partial<FloorShape['params']> = tool === 'cylinder'
          ? { radius, ...getFacadeDefaults() }
          : { circumradius: radius, sides: 6, startAngle: 0, ...getFacadeDefaults() };
        return {
          kind: 'awaiting-extrude',
          tool,
          baseParams,
          position: { x: c.x, y: c.z },
        };
      });
      return;
    }

    // Arc: click center → click start point → click end-angle
    if (tool === 'arc') {
      setState(s => {
        if (s.kind !== 'placing' || s.tool !== 'arc') {
          return { kind: 'placing', tool: 'arc', points: [world], cursor: world };
        }
        if (s.points.length === 1) {
          return { ...s, points: [...s.points, world], cursor: world };
        }
        const c = s.points[0], p0 = s.points[1], p1 = world;
        const arcRadius = Math.hypot(p0.x - c.x, p0.z - c.z);
        const a0 = Math.atan2(p0.z - c.z, p0.x - c.x);
        const a1 = Math.atan2(p1.z - c.z, p1.x - c.x);
        let arcAngleDeg = ((a1 - a0) * 180 / Math.PI);
        arcAngleDeg = ((arcAngleDeg % 360) + 360) % 360;
        if (arcAngleDeg < 1) arcAngleDeg = 90;
        return {
          kind: 'awaiting-extrude',
          tool: 'arc',
          baseParams: { arcRadius, arcAngle: arcAngleDeg, depth: arcRadius * 0.3, ...getFacadeDefaults() },
          position: { x: c.x, y: c.z },
        };
      });
      return;
    }

    // Fan: same as arc but commits with innerRadius prompt
    if (tool === 'fan') {
      setState(s => {
        if (s.kind !== 'placing' || s.tool !== 'fan') {
          return { kind: 'placing', tool: 'fan', points: [world], cursor: world };
        }
        if (s.points.length === 1) {
          return { ...s, points: [...s.points, world], cursor: world };
        }
        const c = s.points[0], p0 = s.points[1], p1 = world;
        const outerRadius = Math.hypot(p0.x - c.x, p0.z - c.z);
        const a0 = Math.atan2(p0.z - c.z, p0.x - c.x);
        const a1 = Math.atan2(p1.z - c.z, p1.x - c.x);
        let fanAngleDeg = ((a1 - a0) * 180 / Math.PI);
        fanAngleDeg = ((fanAngleDeg % 360) + 360) % 360;
        if (fanAngleDeg < 1) fanAngleDeg = 90;
        return {
          kind: 'awaiting-extrude',
          tool: 'fan',
          baseParams: { outerRadius, innerRadius: 0, fanAngle: fanAngleDeg, ...getFacadeDefaults() },
          position: { x: c.x, y: c.z },
        };
      });
      return;
    }

    // Ellipse: click center → click major axis end → click minor axis end
    if (tool === 'ellipse') {
      setState(s => {
        if (s.kind !== 'placing' || s.tool !== 'ellipse') {
          return { kind: 'placing', tool: 'ellipse', points: [world], cursor: world };
        }
        if (s.points.length === 1) {
          return { ...s, points: [...s.points, world], cursor: world };
        }
        const c = s.points[0], p0 = s.points[1], p1 = world;
        const majorRadius = Math.hypot(p0.x - c.x, p0.z - c.z);
        // minor = perpendicular distance from p1 to line c→p0
        const dx = p0.x - c.x, dz = p0.z - c.z;
        const len = Math.hypot(dx, dz) || 1;
        const ux = dx / len, uz = dz / len; // major axis unit
        // perpendicular: (-uz, ux)
        const px = -uz, pz = ux;
        const minorRadius = Math.abs((p1.x - c.x) * px + (p1.z - c.z) * pz);
        if (majorRadius < 0.1 || minorRadius < 0.1) return s;
        const rotation = (Math.atan2(dz, dx) * 180) / Math.PI;
        return {
          kind: 'awaiting-extrude',
          tool: 'ellipse',
          baseParams: { majorRadius, minorRadius, ...getFacadeDefaults() },
          position: { x: c.x, y: c.z },
          rotation,
        };
      });
      return;
    }

    // Polyline: click N points, close by clicking near first point.
    // Arc sub-mode: 2 clicks (midpoint, end) → tessellate 3-point arc through
    // (lastVertex, midpoint, endpoint) and append samples.
    if (tool === 'polyline') {
      if (polylineSegModeRef.current === 'arc' && stateRef.current.kind === 'placing' && stateRef.current.tool === 'polyline') {
        if (!arcMidRef.current) {
          arcMidRef.current = world;
          argsRef.current.onToast?.('再按一下：弧線終點');
          return;
        }
        const cur = stateRef.current;
        const start = cur.points[cur.points.length - 1];
        const mid = arcMidRef.current;
        const end = world;
        arcMidRef.current = null;
        const samples = tessellateArc3pt(start, mid, end, 16);
        setState(s => {
          if (s.kind !== 'placing' || s.tool !== 'polyline') return s;
          return { ...s, points: [...s.points, ...samples], cursor: end };
        });
        return;
      }
      // If a paramBar Enter pre-committed a length+angle preview, the cursor
      // is already at the intended next-point position. The user's confirming
      // click now commits the locked preview regardless of where mouse is.
      const lockedFromPreview = cursorLockRef.current;
      cursorLockRef.current = false;
      setState(s => {
        if (s.kind !== 'placing' || s.tool !== 'polyline') {
          return { kind: 'placing', tool: 'polyline', points: [world], cursor: world };
        }
        // Use the locked cursor when in preview-confirm mode; otherwise use the
        // raw click world.
        let candidate = lockedFromPreview ? s.cursor : world;
        // If the click is near any already-placed vertex, snap to it.
        let snapped = candidate;
        let bestDist = SNAP_THRESHOLD_M;
        for (const pt of s.points) {
          const d = Math.hypot(candidate.x - pt.x, candidate.z - pt.z);
          if (d < bestDist) { bestDist = d; snapped = pt; }
        }
        const first = s.points[0];
        const closeDist = Math.hypot(snapped.x - first.x, snapped.z - first.z);
        if (s.points.length >= 3 && closeDist < 1.0) {
          // Negate world.z so the rendered polyline (rotated -π/2 around X) lands at the original world position.
          const pts = s.points.map(p => ({ x: p.x, y: -p.z }));
          return {
            kind: 'awaiting-extrude',
            tool: 'polyline',
            baseParams: { points: pts, isClosed: true, ...getFacadeDefaults() },
            position: { x: 0, y: 0 },
          };
        }
        return { ...s, points: [...s.points, snapped], cursor: snapped };
      });
      return;
    }
  }, [tool, args, findShapeAt, removeShape]);

  const handlePointerUp = useCallback((_world: World | null, _event: PointerEvent) => {
    setState(s => {
      if (s.kind === 'transforming') return { kind: 'idle' };
      if (s.kind === 'extruding') return { kind: 'idle' };
      return s;
    });
  }, []);

  // Push-pull drag: called from ThreeDViewer mousemove while `state.kind === 'extruding'`.
  // deltaY = pointer event.movementY (positive = mouse moved DOWN). Map to height
  // decrease so dragging up grows the shape (SketchUp convention).
  const handleExtrudeDrag = useCallback((deltaY: number) => {
    const s = stateRef.current;
    if (s.kind !== 'extruding') return;
    const PIXELS_PER_METER = 30;
    const dh = -deltaY / PIXELS_PER_METER;
    const floors = argsRef.current.floors;
    const next = floors.map(f => {
      if (f.id !== s.floorId) return f;
      return {
        ...f,
        shapes: f.shapes.map(sh => {
          if (sh.id !== s.shapeId) return sh;
          // Per-shape height only. Upper floors restack via the renderer's
          // max-shape-height logic; siblings (taller or shorter) untouched
          // so no overlap is created.
          const cur = (sh.params as any)[s.heightKey] ?? f.floorHeight ?? 3.5;
          const nv = Math.max(0.5, cur + dh);
          return { ...sh, params: { ...sh.params, [s.heightKey]: Math.round(nv * 100) / 100 } };
        }),
      };
    });
    argsRef.current.onFloorsChange(next);
  }, []);

  // SketchUp-style commit: while in 'placing' with one anchor, accept typed
  // dimensions and immediately enter awaiting-extrude.
  // For placing-move, accept dx/dz to move the shape by exact deltas.
  const commitWithDimensions = useCallback((values: Record<string, number>) => {
    if (stateRef.current.kind === 'placing-move') {
      const dx = values.dx ?? 0;
      const dz = values.dz ?? 0;
      commitMoveByDelta(dx, dz);
      return;
    }
    setState(s => {
      if (s.kind !== 'placing' || s.points.length < 1) return s;
      const a = s.points[0];
      const c = s.cursor;
      const sx = c.x >= a.x ? 1 : -1;
      const sz = c.z >= a.z ? 1 : -1;

      if (s.tool === 'box' || s.tool === 'lShape' || s.tool === 'tShape') {
        const w = values.width ?? values.l1 ?? 30;
        const l = values.length ?? values.w1 ?? 20;
        const cx = a.x + (sx * w) / 2;
        const cz = a.z + (sz * l) / 2;
        let baseParams: Partial<FloorShape['params']>;
        if (s.tool === 'box') {
          baseParams = { width: w, length: l, ...getFacadeDefaults() };
        } else if (s.tool === 'lShape') {
          baseParams = { l1: w, w1: l, l2: w / 2, w2: l / 2, lDirection: 'TopLeft' as any, ...getFacadeDefaults() };
        } else {
          baseParams = { l1: w, w1: l, l2: w / 2, w2: l / 2, wingPosition: 'top' as any, ...getFacadeDefaults() };
        }
        return { kind: 'awaiting-extrude', tool: s.tool, baseParams, position: { x: cx, y: cz } };
      }
      if (s.tool === 'cylinder' || s.tool === 'polygon') {
        const radius = values.radius ?? values.circumradius ?? 10;
        const baseParams: Partial<FloorShape['params']> = s.tool === 'cylinder'
          ? { radius, ...getFacadeDefaults() }
          : { circumradius: radius, sides: Math.max(3, Math.min(12, Math.round(values.sides ?? 6))), startAngle: 0, ...getFacadeDefaults() };
        return { kind: 'awaiting-extrude', tool: s.tool, baseParams, position: { x: a.x, y: a.z } };
      }
      if (s.tool === 'polyline' && s.points.length >= 1) {
        // Place next vertex at given length & angle from the last placed point.
        const last = s.points[s.points.length - 1];
        const length = values.length ?? Math.hypot(c.x - last.x, c.z - last.z);
        const angleDeg = values.angle;
        let nx: number, nz: number;
        if (s.points.length >= 2 && angleDeg != null) {
          // Apply interior-angle convention from previous edge
          const prev = s.points[s.points.length - 2];
          const v1x = last.x - prev.x, v1z = last.z - prev.z;
          const baseAng = Math.atan2(v1z, v1x);
          // interior 180° = straight ahead; <180° = turn. Pick turn sign based on cursor side.
          const sideSign = Math.sign(((c.x - last.x) * (-v1z) + (c.z - last.z) * v1x)) || 1;
          const turnRad = (180 - angleDeg) * Math.PI / 180 * sideSign;
          const newAng = baseAng + turnRad;
          nx = last.x + Math.cos(newAng) * length;
          nz = last.z + Math.sin(newAng) * length;
        } else if (angleDeg != null) {
          // First segment: angle is absolute from +X (screen-up = -z direction)
          const rad = (-angleDeg) * Math.PI / 180;
          nx = last.x + Math.cos(rad) * length;
          nz = last.z + Math.sin(rad) * length;
        } else {
          // Length only: keep cursor direction
          const dx = c.x - last.x, dz = c.z - last.z;
          const m = Math.hypot(dx, dz) || 1;
          nx = last.x + (dx / m) * length;
          nz = last.z + (dz / m) * length;
        }
        // PREVIEW (not commit): move cursor to the typed (length × angle)
        // position and lock it. User must confirm with a canvas click — that
        // click adds the locked cursor to points and releases the lock (see
        // handlePointerDown for the polyline branch).
        cursorLockRef.current = true;
        return { ...s, cursor: { x: nx, z: nz } };
      }
      // multi-click tools: not supported via dimension entry yet
      return s;
    });
  }, []);

  const closePolyline = useCallback(() => {
    setState(s => {
      if (s.kind === 'placing' && s.tool === 'polyline' && s.points.length >= 3) {
        // Negate world.z so the rendered polyline (rotated -π/2 around X) lands at the original world position.
          const pts = s.points.map(p => ({ x: p.x, y: -p.z }));
        return {
          kind: 'awaiting-extrude',
          tool: 'polyline',
          baseParams: { points: pts, isClosed: true, ...getFacadeDefaults() },
          position: { x: 0, y: 0 },
        };
      }
      return s;
    });
  }, []);

  // Auto-commit shapes when they reach 'awaiting-extrude' — uses the active
  // floor's height as the extrude height and the defaultValue of each extra
  // field (WWR / glass / shading / shape-specific). The legacy modal is
  // bypassed; users tweak fine-grained facade params via the FloorManager
  // panel after creation.
  useEffect(() => {
    if (state.kind !== 'awaiting-extrude') return;
    const activeFloor = argsRef.current.floors.find(f => f.id === argsRef.current.activeFloorId);
    const height = activeFloor?.floorHeight ?? 3.5;
    // Build extras from the field's defaultValue (paramBar's typed overrides
    // were already merged into baseParams before this state was entered).
    const extras: Record<string, number | string> = {};
    for (const f of extraFields) extras[f.key] = f.defaultValue;
    confirmExtrude(height, extras);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setState({ kind: 'idle' });
      return;
    }
    if (e.key === 'Enter') {
      closePolyline();
      return;
    }
    // Backspace during polyline drawing → remove the last placed point (eraser)
    if (e.key === 'Backspace' && stateRef.current.kind === 'placing' && stateRef.current.tool === 'polyline') {
      e.preventDefault();
      setState(s => {
        if (s.kind !== 'placing' || s.tool !== 'polyline') return s;
        if (s.points.length <= 1) return { kind: 'idle' }; // last point — exit drawing
        return { ...s, points: s.points.slice(0, -1) };
      });
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && args.selectedShapeId) {
      const found = findShapeAt(args.selectedShapeId);
      if (found) removeShape(found.floor.id, found.shape.id);
    }
  }, [closePolyline, args.selectedShapeId, findShapeAt, removeShape]);

  const extraFields = useMemo<ExtraField[]>(() => {
    if (state.kind !== 'awaiting-extrude') return [];
    // Common facade fields appended to every shape's create-time dialog so the
    // user can fully define the shape's WWR + glass + shading at create time.
    const commonFacade: ExtraField[] = [
      { kind: 'number', key: 'wwr', label: '開窗率 (0-1)', defaultValue: state.baseParams.wwr ?? 0.35, min: 0, max: 1, step: 0.05 },
      { kind: 'select', key: 'glassType', label: '玻璃類型', defaultValue: (state.baseParams.glassType as string) ?? 'Double', options: [
        { value: 'Single', label: '單層' },
        { value: 'Double', label: '雙層' },
        { value: 'Triple-LowE', label: '三層 Low-E' },
        { value: 'Vacuum', label: '真空' },
      ]},
      { kind: 'select', key: 'shadingType', label: '遮陽類型', defaultValue: (state.baseParams.shadingType as string) ?? 'None', options: [
        { value: 'None', label: '無' },
        { value: 'Horizontal', label: '水平' },
        { value: 'Vertical', label: '垂直' },
        { value: 'Eggcrate', label: '格柵' },
        { value: 'Louver', label: '百葉' },
      ]},
    ];
    let shapeSpecific: ExtraField[] = [];
    if (state.tool === 'cylinder') {
      shapeSpecific = [
        { kind: 'number', key: 'radius', label: '半徑 (m)', defaultValue: state.baseParams.radius ?? 15, min: 0.5, step: 0.5 },
      ];
    } else if (state.tool === 'polygon') {
      shapeSpecific = [
        { kind: 'number', key: 'circumradius', label: '外接圓半徑 (m)', defaultValue: state.baseParams.circumradius ?? 20, min: 0.5, step: 0.5 },
        { kind: 'number', key: 'sides', label: '邊數 (3-12)', defaultValue: state.baseParams.sides ?? 6, min: 3, max: 12, step: 1 },
        { kind: 'number', key: 'startAngle', label: '起始角度 (°)', defaultValue: state.baseParams.startAngle ?? 0, min: 0, max: 360, step: 1 },
      ];
    } else if (state.tool === 'lShape') {
      shapeSpecific = [
        { kind: 'number', key: 'l2', label: '次體 L2', defaultValue: state.baseParams.l2 ?? 20, min: 1, step: 1 },
        { kind: 'number', key: 'w2', label: '次體 W2', defaultValue: state.baseParams.w2 ?? 15, min: 1, step: 1 },
        { kind: 'select', key: 'lDirection', label: '轉折方向', defaultValue: 'TopLeft', options: [
          { value: 'TopLeft', label: '左上' }, { value: 'TopRight', label: '右上' },
          { value: 'BottomLeft', label: '左下' }, { value: 'BottomRight', label: '右下' },
        ]},
      ];
    } else if (state.tool === 'tShape') {
      shapeSpecific = [
        { kind: 'number', key: 'l2', label: '翼部 L2', defaultValue: state.baseParams.l2 ?? 20, min: 1, step: 1 },
        { kind: 'number', key: 'w2', label: '翼部 W2', defaultValue: state.baseParams.w2 ?? 15, min: 1, step: 1 },
        { kind: 'select', key: 'wingPosition', label: '翼部位置', defaultValue: 'top', options: [
          { value: 'top', label: '上' }, { value: 'bottom', label: '下' },
          { value: 'left', label: '左' }, { value: 'right', label: '右' },
        ]},
      ];
    } else if (state.tool === 'fan') {
      shapeSpecific = [
        { kind: 'number', key: 'outerRadius', label: '外半徑 (m)', defaultValue: state.baseParams.outerRadius ?? 30, min: 0.5, step: 0.5 },
        { kind: 'number', key: 'innerRadius', label: '內半徑 (0=實心扇形)', defaultValue: state.baseParams.innerRadius ?? 0, min: 0, step: 0.5 },
        { kind: 'number', key: 'fanAngle', label: '扇形角度 (°)', defaultValue: state.baseParams.fanAngle ?? 90, min: 1, max: 360, step: 1 },
      ];
    } else if (state.tool === 'arc') {
      shapeSpecific = [
        { kind: 'number', key: 'arcRadius', label: '內側半徑 (m)', defaultValue: state.baseParams.arcRadius ?? 30, min: 0.5, step: 0.5 },
        { kind: 'number', key: 'depth', label: '厚度/深度 (m)', defaultValue: state.baseParams.depth ?? 10, min: 0.5, step: 0.5 },
        { kind: 'number', key: 'arcAngle', label: '弧角度 (°)', defaultValue: state.baseParams.arcAngle ?? 90, min: 1, max: 360, step: 1 },
      ];
    } else if (state.tool === 'ellipse') {
      shapeSpecific = [
        { kind: 'number', key: 'majorRadius', label: '長軸半徑 (m)', defaultValue: state.baseParams.majorRadius ?? 25, min: 0.5, step: 0.5 },
        { kind: 'number', key: 'minorRadius', label: '短軸半徑 (m)', defaultValue: state.baseParams.minorRadius ?? 15, min: 0.5, step: 0.5 },
      ];
    } else if (state.tool === 'box') {
      shapeSpecific = [
        { kind: 'number', key: 'width', label: '寬度 W (m)', defaultValue: state.baseParams.width ?? 30, min: 0.5, step: 0.5 },
        { kind: 'number', key: 'length', label: '長度 L (m)', defaultValue: state.baseParams.length ?? 30, min: 0.5, step: 0.5 },
      ];
    }
    return [...shapeSpecific, ...commonFacade];
  }, [state]);

  const confirmExtrude = useCallback((height: number, extras: Record<string, number | string>) => {
    setState(curr => {
      if (curr.kind !== 'awaiting-extrude') return curr;
      if (!args.activeFloorId) return { kind: 'idle' };
      const params: FloorShape['params'] = { ...curr.baseParams };
      // Shape-specific overrides from the dialog
      if (curr.tool === 'box') {
        if (extras.width != null) params.width = Number(extras.width);
        if (extras.length != null) params.length = Number(extras.length);
      }
      if (curr.tool === 'cylinder' && extras.radius != null) params.radius = Number(extras.radius);
      if (curr.tool === 'polygon') {
        if (extras.circumradius != null) params.circumradius = Number(extras.circumradius);
        if (extras.sides != null) params.sides = Number(extras.sides);
        if (extras.startAngle != null) params.startAngle = Number(extras.startAngle);
      }
      if (curr.tool === 'ellipse') {
        if (extras.majorRadius != null) params.majorRadius = Number(extras.majorRadius);
        if (extras.minorRadius != null) params.minorRadius = Number(extras.minorRadius);
      }
      if (curr.tool === 'arc') {
        if (extras.arcRadius != null) params.arcRadius = Number(extras.arcRadius);
        if (extras.depth != null) params.depth = Number(extras.depth);
        if (extras.arcAngle != null) params.arcAngle = Number(extras.arcAngle);
      }
      if (curr.tool === 'fan') {
        if (extras.outerRadius != null) params.outerRadius = Number(extras.outerRadius);
        if (extras.innerRadius != null) params.innerRadius = Number(extras.innerRadius);
        if (extras.fanAngle != null) params.fanAngle = Number(extras.fanAngle);
      }
      if (curr.tool === 'lShape') {
        if (extras.l2 != null) params.l2 = Number(extras.l2);
        if (extras.w2 != null) params.w2 = Number(extras.w2);
        if (extras.lDirection) params.lDirection = extras.lDirection as any;
      }
      if (curr.tool === 'tShape') {
        if (extras.l2 != null) params.l2 = Number(extras.l2);
        if (extras.w2 != null) params.w2 = Number(extras.w2);
        if (extras.wingPosition) params.wingPosition = extras.wingPosition as any;
      }
      if (curr.tool === 'polyline') params.extrudeHeight = height;
      // Common facade fields (apply to all shape types)
      if (extras.wwr != null) params.wwr = Number(extras.wwr);
      if (extras.glassType) params.glassType = extras.glassType as any;
      if (extras.shadingType) params.shadingType = extras.shadingType as any;

      const newShape: FloorShape = {
        id: `${curr.tool}-${Date.now()}`,
        type: curr.tool as GeometryType,
        params,
        position: curr.position,
        rotation: curr.rotation ?? 0,
      };
      const next = argsRef.current.floors.map(f =>
        f.id === args.activeFloorId
          ? {
              ...f,
              floorHeight: height,
              shapes: [...f.shapes.map(s =>
                s.type === 'polyline' ? { ...s, params: { ...s.params, extrudeHeight: height } } : s
              ), newShape],
            }
          : f
      );
      argsRef.current.onFloorsChange(next);
      args.onSelectShape(newShape.id);
      return { kind: 'idle' };
    });
  }, [args]);

  // Live parameter specs for the SketchUp-style bottom bar.
  const paramSpecs = useMemo<Array<{ key: string; label: string; value: number; unit?: string }>>(() => {
    // For placing-move (move tool phase 3), expose dx/dz from origin grip
    if (state.kind === 'placing-move') {
      const origin = placingMoveOriginRef.current;
      const found = argsRef.current.floors
        .find(f => f.id === state.floorId)?.shapes
        .find(sh => sh.id === state.shapeId);
      if (origin && found) {
        // Current grip position = shape.position + gripOffset
        const curGripX = found.position.x + state.gripOffset.x;
        const curGripZ = found.position.y + state.gripOffset.y;
        return [
          { key: 'dx', label: 'ΔX', value: curGripX - origin.x, unit: 'm' },
          { key: 'dz', label: 'ΔY', value: curGripZ - origin.z, unit: 'm' },
        ];
      }
      return [];
    }
    if (state.kind !== 'placing' || state.points.length < 1) return [];
    const a = state.points[0];
    const c = state.cursor;
    if (state.tool === 'box') {
      return [
        { key: 'width', label: 'W', value: Math.abs(c.x - a.x), unit: 'm' },
        { key: 'length', label: 'L', value: Math.abs(c.z - a.z), unit: 'm' },
      ];
    }
    if (state.tool === 'lShape' || state.tool === 'tShape') {
      return [
        { key: 'l1', label: 'L1', value: Math.abs(c.x - a.x), unit: 'm' },
        { key: 'w1', label: 'W1', value: Math.abs(c.z - a.z), unit: 'm' },
      ];
    }
    if (state.tool === 'cylinder') {
      return [{ key: 'radius', label: 'R', value: Math.hypot(c.x - a.x, c.z - a.z), unit: 'm' }];
    }
    if (state.tool === 'polygon') {
      return [
        { key: 'circumradius', label: 'R', value: Math.hypot(c.x - a.x, c.z - a.z), unit: 'm' },
        { key: 'sides', label: 'N', value: 6 },
      ];
    }
    if (state.tool === 'polyline') {
      const last = state.points[state.points.length - 1];
      const len = Math.hypot(c.x - last.x, c.z - last.z);
      let angleDeg: number;
      if (state.points.length >= 2) {
        const prev = state.points[state.points.length - 2];
        const v1x = last.x - prev.x, v1z = last.z - prev.z;
        const v2x = c.x - last.x, v2z = c.z - last.z;
        const a1 = Math.atan2(v1z, v1x);
        const a2 = Math.atan2(v2z, v2x);
        let turn = (a2 - a1) * 180 / Math.PI;
        while (turn > 180) turn -= 360;
        while (turn < -180) turn += 360;
        angleDeg = 180 - Math.abs(turn);
      } else {
        let abs = Math.atan2(-(c.z - last.z), c.x - last.x) * 180 / Math.PI;
        if (abs < 0) abs += 360;
        angleDeg = abs;
      }
      return [
        { key: 'length', label: 'L', value: len, unit: 'm' },
        { key: 'angle', label: '∠', value: angleDeg, unit: '°' },
      ];
    }
    return [];
  }, [state, argsRef.current.floors]);

  // Commit a move by absolute (dx, dz) from the original grip position.
  // Uses argsRef.current to always read the LATEST floors / onFloorsChange,
  // never a stale closure.
  const commitMoveByDelta = useCallback((dx: number, dz: number) => {
    const curr = stateRef.current;
    if (curr.kind !== 'placing-move') return;
    const origin = placingMoveOriginRef.current;
    if (!origin) return;
    if (!isFinite(dx) || !isFinite(dz)) return;
    const newGripWorld = { x: origin.x + dx, z: origin.z + dz };
    const newPos = { x: newGripWorld.x - curr.gripOffset.x, y: newGripWorld.z - curr.gripOffset.y };
    if (!isFinite(newPos.x) || !isFinite(newPos.y)) return;
    const liveArgs = argsRef.current;
    if (!liveArgs.floors || liveArgs.floors.length === 0) return;
    const next = liveArgs.floors.map(f =>
      f.id === curr.floorId
        ? { ...f, shapes: f.shapes.map(sh => sh.id === curr.shapeId ? { ...sh, position: newPos } : sh) }
        : f
    );
    liveArgs.onFloorsChange(next);
    placingMoveOriginRef.current = null;
    setState({ kind: 'idle' });
  }, []);

  /**
   * Live preview: when polyline is placing with angle-snap locked, typing a
   * length in the paramBar should jump the cursor along the snapped direction
   * by that length without waiting for the mouse to move there. Lets users
   * type a precise length (e.g. 5m at locked 90°) and see the next point
   * before pressing Enter.
   */
  const setPreviewLength = useCallback((len: number) => {
    if (!Number.isFinite(len) || len <= 0) return;
    const snapDeg = angleSnapRef.current;
    if (snapDeg <= 0) return;  // free angle → typed length is preview-irrelevant
    setState(s => {
      if (s.kind !== 'placing' || s.tool !== 'polyline' || s.points.length < 1) return s;
      const last = s.points[s.points.length - 1];
      // Use the CURRENT cursor direction (already snapped by handlePointerMove)
      const dx = s.cursor.x - last.x;
      const dz = s.cursor.z - last.z;
      const m = Math.hypot(dx, dz);
      if (m < 0.001) return s;
      return {
        ...s,
        cursor: {
          x: last.x + (dx / m) * len,
          z: last.z + (dz / m) * len,
        },
      };
    });
  }, []);

  // Eraser: remove the last placed point of an in-progress polyline.
  const eraseLastPoint = useCallback(() => {
    setState(s => {
      if (s.kind !== 'placing' || s.tool !== 'polyline') return s;
      if (s.points.length <= 1) return { kind: 'idle' };
      return { ...s, points: s.points.slice(0, -1) };
    });
  }, []);

  return {
    tool,
    state,
    setTool,
    cancel,
    handlePointerMove,
    handlePointerDown,
    handlePointerUp,
    handleExtrudeDrag,
    polylineSegMode,
    setPolylineSegMode,
    polyline3D,
    setPolyline3D,
    handleKeyDown,
    extrudeOpen: state.kind === 'awaiting-extrude',
    extraFields,
    confirmExtrude,
    cancelExtrude: cancel,
    paramSpecs,
    commitWithDimensions,
    eraseLastPoint,
    brushColor,
    setBrushColor,
    angleSnapDeg,
    setAngleSnapDeg,
    setPreviewLength,
    setInputFocused,
  };
}
