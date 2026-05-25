# SketchUp-Style 3D Modeling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the form-driven shape entry with a SketchUp-style left toolbar that lets the user pick a tool, draw the outline directly in the 3D perspective viewport, and confirm extrusion via dialog.

**Architecture:** In-place integration into existing `ThreeDViewer` via two new hooks (`useDrawingTool`, `useGroundRaycaster`) and three new components (`DrawingToolbar`, `DrawingHUD`, `ExtrudeHeightDialog`). All drawing state lives inside `useDrawingTool`; ThreeDViewer renders a separate `previewGroup` for in-progress shapes. Commits flow through the existing `onFloorsChange` prop, writing to the `selectedFloorId` floor.

**Tech Stack:** React 19, TypeScript, Three.js 0.182, Vite. No test runner configured — verification is via the running dev server (HMR + manual browser check at http://localhost:3001/). The project is **not a git repo**, so no commit steps.

**Spec:** [docs/superpowers/specs/2026-04-25-sketchup-style-3d-modeling-design.md](../specs/2026-04-25-sketchup-style-3d-modeling-design.md)

---

## File Structure

**New files:**
- `components/drawing/DrawingToolbar.tsx` — Left-side floating tool buttons.
- `components/drawing/ExtrudeHeightDialog.tsx` — Modal dialog for extrude height (and shape-specific extras like `sides`).
- `components/drawing/DrawingHUD.tsx` — Right-bottom cursor coords + edge length + lock-top-view toggle.
- `hooks/useGroundRaycaster.ts` — Screen → ground-plane (y=0) world coords with snap-to-grid.
- `hooks/useDrawingTool.ts` — State machine, pointer event handlers, preview mesh builder, commit logic.

**Modified files:**
- `components/ThreeDViewer.tsx` — Mount toolbar/HUD overlays, add `previewGroupRef`, wire pointer events to `useDrawingTool`, add ground grid, support orthographic top-view camera swap.
- `components/TopViewCanvas.tsx` — Extract `ExtrudeHeightDialog` (the inline dialog at line 1044+) into the shared component; replace its inline JSX with `<ExtrudeHeightDialog />`.
- `App.tsx` — No prop changes expected; `onFloorsChange` is already passed via `setFloors`.

**Verification model:** After every task, the dev server is left running (`npm run dev` in background, started in §0). HMR will hot-reload changes. Each task ends with a **manual browser check** describing exactly what to look for at http://localhost:3001/.

---

## Task 0: Pre-flight — confirm dev server & baseline

**Files:** none

- [ ] **Step 1: Verify dev server is running**

Run: `curl -s http://localhost:3001/ | head -1`
Expected: HTML response starting with `<!doctype html>`. If the server is not up, run `npm run dev` in background.

- [ ] **Step 2: Open browser and confirm baseline**

Open http://localhost:3001/, navigate into the project geometry view. Confirm:
- The current `FloorManagerPanel` is visible (right-ish overlay).
- 3D view renders the existing floors.
- No console errors.

If anything is broken, **stop and fix before starting Task 1.** This plan assumes the previous WWR / extrudeHeight↔floorHeight changes are intact.

- [ ] **Step 3: Read the spec**

Open [the spec](../specs/2026-04-25-sketchup-style-3d-modeling-design.md) and re-read sections 5–8. The plan does not duplicate every UI detail — refer back when implementing each tool.

---

## Task 1: Extract `ExtrudeHeightDialog` from TopViewCanvas

**Files:**
- Create: `components/drawing/ExtrudeHeightDialog.tsx`
- Modify: `components/TopViewCanvas.tsx:1044-1089` (replace inline dialog)

**Why first:** Both the existing polyline flow and every new shape tool need this dialog. Extracting now avoids duplication and proves the new `components/drawing/` directory is wired up before bigger work.

- [ ] **Step 1: Create the component file**

Create `components/drawing/ExtrudeHeightDialog.tsx`:

```tsx
import React, { useState } from 'react';

export type ExtraField =
  | { kind: 'number'; key: string; label: string; defaultValue: number; min?: number; max?: number; step?: number }
  | { kind: 'select'; key: string; label: string; defaultValue: string; options: { value: string; label: string }[] };

interface Props {
  open: boolean;
  initialHeight: number;
  floorHeightHint?: number;        // shown below input
  description?: string;            // e.g. "已建立 5 節點的封閉輪廓..."
  extraFields?: ExtraField[];      // e.g. polygon needs `sides`, L-shape needs L2/W2/direction
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

  if (!open) return null;

  const handleConfirm = () => onConfirm(height, extras);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 shadow-2xl w-80 space-y-4 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-black text-white">{t ? '設定擠出高度' : 'Set Extrude Height'}</h3>
        {description && <p className="text-[11px] text-slate-400">{description}</p>}

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-300 uppercase">{t ? '擠出高度 (m)' : 'Height (m)'}</label>
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
            <p className="text-[9px] text-slate-500 text-center">
              {t ? `樓層高度: ${floorHeightHint} m` : `Floor height: ${floorHeightHint} m`}
            </p>
          )}
        </div>

        {extraFields.map(f => (
          <div key={f.key} className="space-y-1">
            <label className="text-[10px] font-black text-slate-300 uppercase">{f.label}</label>
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
```

- [ ] **Step 2: Replace inline dialog in TopViewCanvas**

In `components/TopViewCanvas.tsx`:
- Add `import ExtrudeHeightDialog from './drawing/ExtrudeHeightDialog';` near the top imports.
- Replace lines 1044–1089 (the entire `{showExtrudeDialog && (...)}` block) with:

```tsx
<ExtrudeHeightDialog
  open={showExtrudeDialog}
  initialHeight={extrudeHeight}
  floorHeightHint={activeFloor?.floorHeight || 3.5}
  description={
    lang === 'zh'
      ? `已建立 ${pendingPoints.length} 節點的封閉輪廓，面積 ${calcPolygonArea(pendingPoints).toFixed(1)} m²`
      : `Created closed outline with ${pendingPoints.length} nodes, area ${calcPolygonArea(pendingPoints).toFixed(1)} m²`
  }
  lang={lang}
  onConfirm={(h) => { setExtrudeHeight(h); confirmExtrude(); }}
  onCancel={cancelExtrude}
/>
```

Note: `confirmExtrude` reads from `extrudeHeight` state, so we set it first via `setExtrudeHeight(h)`. Confirm `confirmExtrude` works with the latest value (React batches state updates — if there's a stale-closure bug, change `confirmExtrude` to accept an explicit height parameter and pass `h` directly).

- [ ] **Step 3: Verify in browser**

HMR reload, open Polyline mode, draw a polyline, close it. Confirm:
- The extrude dialog still appears with the same look.
- Number input works, Enter confirms, Cancel dismisses.
- Polyline gets created with the correct height.

If broken, switch the implementation in Step 2 to pass `h` explicitly:
```ts
const confirmExtrudeWith = (h: number) => { /* same logic but uses h */ };
onConfirm={(h) => confirmExtrudeWith(h)}
```

---

## Task 2: `useGroundRaycaster` hook

**Files:**
- Create: `hooks/useGroundRaycaster.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useCallback, useRef } from 'react';
import * as THREE from 'three';

interface Options {
  snap: boolean;
  gridSize: number; // e.g. 1.0 = snap to whole meters
  maxDistance?: number; // safety cap on raycast distance, default 500m
}

export interface GroundRaycaster {
  /** Convert a pointer event on the renderer DOM element to a ground-plane (y=0) world point. Returns null if ray misses (e.g. cursor above horizon). */
  project: (event: PointerEvent | MouseEvent, dom: HTMLElement, camera: THREE.Camera) => { x: number; z: number } | null;
}

export function useGroundRaycaster(opts: Options): GroundRaycaster {
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hit = useRef(new THREE.Vector3());
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const project = useCallback((event: PointerEvent | MouseEvent, dom: HTMLElement, camera: THREE.Camera) => {
    const rect = dom.getBoundingClientRect();
    ndc.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(ndc.current, camera);
    const ok = raycaster.current.ray.intersectPlane(plane.current, hit.current);
    if (!ok) return null;
    const max = optsRef.current.maxDistance ?? 500;
    if (hit.current.length() > max) return null;
    let x = hit.current.x;
    let z = hit.current.z;
    if (optsRef.current.snap) {
      const g = optsRef.current.gridSize;
      x = Math.round(x / g) * g;
      z = Math.round(z / g) * g;
    }
    return { x, z };
  }, []);

  return { project };
}
```

**Note on coordinate conventions:** ThreeDViewer uses world-space `x` (east) and `z` (south). Existing `shape.position` stores `{ x, y }` where stored `y` actually maps to world `z` (see `shapeGroup.position.z = shape.position.y` at ThreeDViewer.tsx:907). When committing shapes, write `position: { x: world.x, y: world.z }`. **Don't change the existing convention** — match it.

- [ ] **Step 2: No standalone verification**

This hook has no UI — verified via Task 6 onwards when wired into ThreeDViewer.

---

## Task 3: `useDrawingTool` hook (state machine + tool registry)

**Files:**
- Create: `hooks/useDrawingTool.ts`

- [ ] **Step 1: Define the public interface**

```ts
import { useCallback, useState } from 'react';
import * as THREE from 'three';
import { Floor, FloorShape, GeometryType } from '../types';

export type ToolKind =
  | 'pan'
  | 'select'
  | 'box' | 'cylinder' | 'polygon'
  | 'lShape' | 'tShape'
  | 'arc' | 'ellipse' | 'fan'
  | 'polyline'
  | 'move' | 'rotate' | 'delete';

export type DrawingState =
  | { kind: 'idle' }
  | { kind: 'placing'; tool: ToolKind; points: { x: number; z: number }[]; cursor: { x: number; z: number } }
  | { kind: 'awaiting-extrude'; tool: ToolKind; baseParams: Partial<FloorShape['params']>; position: { x: number; y: number } }
  | { kind: 'transforming'; mode: 'move' | 'rotate'; shapeId: string; floorId: string; start: { x: number; z: number } };

interface Args {
  floors: Floor[];
  activeFloorId: string | null;
  onFloorsChange: (floors: Floor[]) => void;
  onSelectShape: (id: string | null) => void;
  onToast: (msg: string) => void;
}

export function useDrawingTool(args: Args) {
  const [tool, setTool] = useState<ToolKind>('pan');
  const [state, setState] = useState<DrawingState>({ kind: 'idle' });

  // ... (event handlers added in Tasks 6-13)

  const cancel = useCallback(() => setState({ kind: 'idle' }), []);

  const setToolAndReset = useCallback((next: ToolKind) => {
    setTool(next);
    setState({ kind: 'idle' });
  }, []);

  return {
    tool,
    state,
    setTool: setToolAndReset,
    cancel,
    // event handlers exposed in later tasks:
    handlePointerMove: (_world: { x: number; z: number } | null) => {},
    handlePointerDown: (_world: { x: number; z: number } | null, _event: PointerEvent) => {},
    handlePointerUp: (_world: { x: number; z: number } | null, _event: PointerEvent) => {},
    handleKeyDown: (_e: KeyboardEvent) => {},
    // dialog state
    extrudeOpen: state.kind === 'awaiting-extrude',
    confirmExtrude: (_height: number, _extras: Record<string, number | string>) => {},
    cancelExtrude: () => setState({ kind: 'idle' }),
  };
}
```

- [ ] **Step 2: No standalone verification**

Verified incrementally in Tasks 6+ as event handlers are filled in.

---

## Task 4: `DrawingToolbar` component (UI only)

**Files:**
- Create: `components/drawing/DrawingToolbar.tsx`

- [ ] **Step 1: Create the toolbar**

```tsx
import React from 'react';
import { ToolKind } from '../../hooks/useDrawingTool';

interface Props {
  current: ToolKind;
  onPick: (tool: ToolKind) => void;
  topViewLocked: boolean;
  onToggleTopView: () => void;
  lang: 'zh' | 'en';
  disabled?: boolean; // true when no active floor
}

interface ToolDef { kind: ToolKind; icon: string; labelZh: string; labelEn: string; }

const TOOLS_TOP: ToolDef[] = [
  { kind: 'pan',      icon: '🔍', labelZh: '縮放/平移', labelEn: 'Pan/Zoom' },
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
  { kind: 'polyline', icon: '~',  labelZh: 'Polyline', labelEn: 'Polyline' },
];
const TOOLS_TRANSFORM: ToolDef[] = [
  { kind: 'move',     icon: '✥',  labelZh: '移動', labelEn: 'Move' },
  { kind: 'rotate',   icon: '↻',  labelZh: '旋轉', labelEn: 'Rotate' },
  { kind: 'delete',   icon: '🗑', labelZh: '刪除', labelEn: 'Delete' },
];

const ToolButton: React.FC<{ def: ToolDef; active: boolean; disabled: boolean; onPick: (k: ToolKind) => void; lang: 'zh'|'en' }> =
  ({ def, active, disabled, onPick, lang }) => (
    <button
      title={lang === 'zh' ? def.labelZh : def.labelEn}
      disabled={disabled}
      onClick={() => onPick(def.kind)}
      className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-black transition-all ${
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

const DrawingToolbar: React.FC<Props> = ({ current, onPick, topViewLocked, onToggleTopView, lang, disabled }) => {
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
              disabled={!!disabled && t.kind !== 'pan' && t.kind !== 'select'}
              onPick={onPick}
              lang={lang}
            />
          ))}
        </React.Fragment>
      ))}
      <Divider />
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
```

- [ ] **Step 2: Verify mount in isolation (skipped)**

Will be verified when mounted in Task 6.

---

## Task 5: `DrawingHUD` component (cursor coords + edge length)

**Files:**
- Create: `components/drawing/DrawingHUD.tsx`

- [ ] **Step 1: Create the HUD**

```tsx
import React from 'react';

interface Props {
  cursor: { x: number; z: number } | null;
  hint: string | null;     // e.g. "邊長: 8.4 m" while drawing
  lang: 'zh' | 'en';
}

const DrawingHUD: React.FC<Props> = ({ cursor, hint, lang }) => {
  const t = lang === 'zh';
  return (
    <div className="absolute bottom-3 right-3 z-30 bg-slate-900/85 backdrop-blur-xl rounded-lg px-3 py-2 shadow-lg border border-white/10 text-[10px] font-mono text-white space-y-0.5 pointer-events-none">
      <div>
        X: {cursor ? cursor.x.toFixed(2) : '—'}  Y: {cursor ? cursor.z.toFixed(2) : '—'} m
      </div>
      {hint && <div className="text-blue-300">{t ? '繪製中' : 'Drawing'} · {hint}</div>}
    </div>
  );
};

export default DrawingHUD;
```

- [ ] **Step 2: Verify mount in isolation (skipped)**

Will be verified when mounted in Task 6.

---

## Task 6: Mount toolbar + HUD + hook in ThreeDViewer (idle plumbing)

**Files:**
- Modify: `components/ThreeDViewer.tsx`

**Goal:** Toolbar, HUD, and ground grid show up. Picking a tool changes `tool` state. Cursor coords update on mouse move. **No actual drawing yet** — just plumbing.

- [ ] **Step 1: Add new imports + props**

In `ThreeDViewer.tsx`:
- Add imports:
  ```ts
  import DrawingToolbar from './drawing/DrawingToolbar';
  import DrawingHUD from './drawing/DrawingHUD';
  import ExtrudeHeightDialog from './drawing/ExtrudeHeightDialog';
  import { useDrawingTool, ToolKind } from '../hooks/useDrawingTool';
  import { useGroundRaycaster } from '../hooks/useGroundRaycaster';
  ```
- Add prop to `ThreeDViewerProps`:
  ```ts
  onFloorsChange?: (floors: Floor[]) => void;
  ```
- Destructure `onFloorsChange` from props.

In `App.tsx` line 577 (`<ThreeDViewer ...>` mount), add:
```tsx
onFloorsChange={setFloors}
```

- [ ] **Step 2: Add ground grid to scene**

Find the scene initialization useEffect in ThreeDViewer (the one creating `sceneRef.current`). After scene creation, add:
```ts
const grid = new THREE.GridHelper(200, 100, 0xcccccc, 0xeeeeee);
(grid.material as THREE.Material).opacity = 0.4;
(grid.material as THREE.Material).transparent = true;
scene.add(grid);
```

- [ ] **Step 3: Add `previewGroupRef`**

Near the other group refs (around line 31), add:
```ts
const previewGroupRef = useRef<THREE.Group | null>(null);
```
After `objectsGroupRef` is created and added to scene, also create:
```ts
previewGroupRef.current = new THREE.Group();
scene.add(previewGroupRef.current);
```

- [ ] **Step 4: Wire up the hooks**

Inside the component body (after refs, before useEffects):
```ts
const [snapToGrid] = React.useState(true);
const [gridSize] = React.useState(1.0);
const [topViewLocked, setTopViewLocked] = React.useState(false);
const [cursor, setCursor] = React.useState<{ x: number; z: number } | null>(null);
const [toast, setToast] = React.useState<string | null>(null);

const ground = useGroundRaycaster({ snap: snapToGrid, gridSize, maxDistance: 500 });
const draw = useDrawingTool({
  floors: floors ?? [],
  activeFloorId: selectedFloorId ?? null,
  onFloorsChange: onFloorsChange ?? (() => {}),
  onSelectShape: onSelectShape ?? (() => {}),
  onToast: (m) => { setToast(m); setTimeout(() => setToast(null), 2500); },
});
```

- [ ] **Step 5: Add pointer move listener (for cursor HUD only)**

Inside the scene-init useEffect (which already attaches `pointermove`), find or add a handler that calls:
```ts
const dom = rendererRef.current?.domElement;
const cam = cameraRef.current;
if (!dom || !cam) return;
const world = ground.project(e, dom, cam);
setCursor(world);
draw.handlePointerMove(world);
```

If there's an existing pointer move handler (for hover overlay), add the call there. Otherwise add a new listener. Remove the listener in the cleanup function.

- [ ] **Step 6: Disable OrbitControls when a non-pan tool is active**

After hooks are set up, add:
```ts
useEffect(() => {
  if (controlsRef.current) {
    controlsRef.current.enabled = draw.tool === 'pan';
  }
}, [draw.tool]);
```

- [ ] **Step 7: Render toolbar, HUD, dialog, toast**

In the component's `return (...)`, immediately inside the existing root `<div>` (alongside the canvas), add:

```tsx
<DrawingToolbar
  current={draw.tool}
  onPick={(k) => draw.setTool(k)}
  topViewLocked={topViewLocked}
  onToggleTopView={() => setTopViewLocked(v => !v)}
  lang={lang}
  disabled={!selectedFloorId}
/>
<DrawingHUD cursor={cursor} hint={null} lang={lang} />
{toast && (
  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-lg">
    {toast}
  </div>
)}
<ExtrudeHeightDialog
  open={draw.extrudeOpen}
  initialHeight={floors?.find(f => f.id === selectedFloorId)?.floorHeight ?? 3.5}
  floorHeightHint={floors?.find(f => f.id === selectedFloorId)?.floorHeight}
  lang={lang}
  onConfirm={(h, extras) => draw.confirmExtrude(h, extras)}
  onCancel={() => draw.cancelExtrude()}
/>
```

- [ ] **Step 8: Verify in browser**

HMR reload. Confirm:
- Toolbar appears top-left with all 14 buttons.
- HUD appears bottom-right showing `X: — Y: — m` initially, updating as you move the mouse.
- Ground grid is visible on the floor of the 3D scene.
- Clicking different toolbar buttons highlights them in blue.
- When "pan" is active, OrbitControls (left-drag rotate, scroll zoom) work. When any other tool is active, dragging on the canvas does NOT rotate the camera.
- No console errors.

If toolbar overlaps with FloorManagerPanel, that's expected — Task 14 will handle their coexistence.

---

## Task 7: Rectangle (box) tool — first end-to-end shape

**Files:**
- Modify: `hooks/useDrawingTool.ts`
- Modify: `components/ThreeDViewer.tsx` (preview render)

**Goal:** Pick rectangle, click two corners, dialog appears, confirm, new box shape appears in 3D and is added to active floor.

- [ ] **Step 1: Add box-specific state transitions in `useDrawingTool`**

Inside `useDrawingTool`, replace the placeholder handlers with:

```ts
const handlePointerMove = useCallback((world: { x: number; z: number } | null) => {
  if (!world) return;
  setState(s => {
    if (s.kind === 'placing') return { ...s, cursor: world };
    return s;
  });
}, []);

const handlePointerDown = useCallback((world: { x: number; z: number } | null) => {
  if (!world) return;
  if (tool === 'pan' || tool === 'select') return;

  if (!args.activeFloorId) {
    args.onToast('請先在右側面板選一個樓層');
    return;
  }

  if (tool === 'box') {
    setState(s => {
      if (s.kind !== 'placing' || s.tool !== 'box') {
        return { kind: 'placing', tool: 'box', points: [world], cursor: world };
      }
      // 2nd click → compute width/length, position, awaiting-extrude
      const a = s.points[0], b = world;
      const width = Math.abs(b.x - a.x);
      const length = Math.abs(b.z - a.z);
      const cx = (a.x + b.x) / 2;
      const cz = (a.z + b.z) / 2;
      if (width < 0.1 || length < 0.1) return s; // degenerate
      return {
        kind: 'awaiting-extrude',
        tool: 'box',
        baseParams: { width, length, wwr: 0.35, glassType: 'Double', shadingType: 'None' },
        position: { x: cx, y: cz },
      };
    });
    return;
  }
  // other tools: added in later tasks
}, [tool, args]);
```

- [ ] **Step 2: Implement `confirmExtrude` for box**

Inside `useDrawingTool`:

```ts
const confirmExtrude = useCallback((height: number, _extras: Record<string, number | string>) => {
  setState(curr => {
    if (curr.kind !== 'awaiting-extrude') return curr;
    if (!args.activeFloorId) return { kind: 'idle' };
    const newShape: FloorShape = {
      id: `${curr.tool}-${Date.now()}`,
      type: curr.tool as GeometryType,
      params: { ...curr.baseParams },
      position: curr.position,
      rotation: 0,
    };
    const next = args.floors.map(f =>
      f.id === args.activeFloorId
        ? { ...f, floorHeight: height, shapes: [...f.shapes, newShape] }
        : f
    );
    args.onFloorsChange(next);
    args.onSelectShape(newShape.id);
    return { kind: 'idle' };
  });
}, [args]);
```

(Replace the placeholder `confirmExtrude` from Task 3.)

- [ ] **Step 3: Add ESC handler**

```ts
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    setState({ kind: 'idle' });
    return;
  }
}, []);
```

In ThreeDViewer, attach this to `window`:
```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => draw.handleKeyDown(e);
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [draw]);
```

- [ ] **Step 4: Render preview mesh**

In ThreeDViewer, add an effect that rebuilds `previewGroupRef.current` whenever `draw.state` changes:

```ts
useEffect(() => {
  const group = previewGroupRef.current;
  if (!group) return;
  while (group.children.length) group.remove(group.children[0]);

  if (draw.state.kind !== 'placing') return;
  const s = draw.state;

  if (s.tool === 'box' && s.points.length === 1) {
    const a = s.points[0], c = s.cursor;
    const w = Math.abs(c.x - a.x);
    const l = Math.abs(c.z - a.z);
    if (w < 0.01 || l < 0.01) return;
    const geo = new THREE.PlaneGeometry(w, l);
    const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((a.x + c.x) / 2, 0.05, (a.z + c.z) / 2);
    group.add(mesh);
  }
}, [draw.state]);
```

- [ ] **Step 5: Wire pointer down/up in scene init**

In the scene-init useEffect, find where `pointerdown` is attached (or add it). Forward to:
```ts
const onDown = (e: PointerEvent) => {
  const dom = rendererRef.current?.domElement;
  const cam = cameraRef.current;
  if (!dom || !cam) return;
  const world = ground.project(e, dom, cam);
  // existing logic for hover/drag overlay first ...
  draw.handlePointerDown(world, e);
};
```

Be careful not to break existing add-floor sprite click and shape-drag behavior — only call `draw.handlePointerDown` if the existing handler did NOT consume the event (e.g. when `draw.tool !== 'pan'`).

- [ ] **Step 6: Update HUD hint while placing**

In ThreeDViewer, compute a `hint`:
```ts
const hint = (() => {
  if (draw.state.kind !== 'placing') return null;
  if (draw.state.tool === 'box' && draw.state.points.length === 1) {
    const a = draw.state.points[0], c = draw.state.cursor;
    return `${Math.abs(c.x - a.x).toFixed(2)} × ${Math.abs(c.z - a.z).toFixed(2)} m`;
  }
  return null;
})();
```
Pass to `<DrawingHUD hint={hint} ... />`.

- [ ] **Step 7: Verify in browser**

HMR reload. Pick a floor in the right panel. Click the rectangle tool (▭). Click on the ground in the 3D view, move the mouse — a blue translucent rectangle should follow. Click again. Dialog appears with the floor's current height. Click Extrude. Confirm:
- A new box shape is added to the floor and rendered (with WWR facade texture).
- `floor.floorHeight` updates to the dialog value.
- HUD shows current cursor coords; while placing shows `W × L`.
- ESC during placing cancels (no shape added).
- Tool stays selected after commit (you can draw another).
- With no floor selected, clicking rectangle and clicking the canvas shows the toast and does NOT add a shape.

---

## Task 8: Circle + polygon tools

**Files:**
- Modify: `hooks/useDrawingTool.ts`
- Modify: `components/ThreeDViewer.tsx` (preview)

**Pattern:** Both share "click center → click radius point → dialog". Polygon's dialog gets an extra `sides` field.

- [ ] **Step 1: Extend `handlePointerDown` for cylinder + polygon**

```ts
if (tool === 'cylinder' || tool === 'polygon') {
  setState(s => {
    if (s.kind !== 'placing' || s.tool !== tool) {
      return { kind: 'placing', tool, points: [world], cursor: world };
    }
    const c = s.points[0], r = world;
    const radius = Math.hypot(r.x - c.x, r.z - c.z);
    if (radius < 0.1) return s;
    const baseParams: Partial<FloorShape['params']> =
      tool === 'cylinder'
        ? { radius, wwr: 0.35, glassType: 'Double', shadingType: 'None' }
        : { circumradius: radius, sides: 6, wwr: 0.35, glassType: 'Double', shadingType: 'None' };
    return {
      kind: 'awaiting-extrude',
      tool,
      baseParams,
      position: { x: c.x, y: c.z },
    };
  });
  return;
}
```

- [ ] **Step 2: Pass extra fields to ExtrudeHeightDialog for polygon**

In ThreeDViewer, expose `extraFields` from `useDrawingTool`:

```ts
// in useDrawingTool
const extraFields: ExtraField[] = (state.kind === 'awaiting-extrude' && state.tool === 'polygon')
  ? [{ kind: 'number', key: 'sides', label: '邊數 (3-12)', defaultValue: 6, min: 3, max: 12, step: 1 }]
  : [];
```
Return `extraFields` from the hook. In ThreeDViewer pass `extraFields={draw.extraFields}` to `<ExtrudeHeightDialog>`.

- [ ] **Step 3: Apply extras in `confirmExtrude`**

```ts
const confirmExtrude = useCallback((height: number, extras: Record<string, number | string>) => {
  setState(curr => {
    if (curr.kind !== 'awaiting-extrude') return curr;
    if (!args.activeFloorId) return { kind: 'idle' };
    const params = { ...curr.baseParams };
    if (curr.tool === 'polygon' && extras.sides) params.sides = Number(extras.sides);
    // ... build newShape & commit (same as Task 7)
  });
}, [args]);
```

- [ ] **Step 4: Add preview render for circle + polygon**

In the ThreeDViewer preview useEffect, add:

```ts
if ((s.tool === 'cylinder' || s.tool === 'polygon') && s.points.length === 1) {
  const c = s.points[0], r = s.cursor;
  const radius = Math.hypot(r.x - c.x, r.z - c.z);
  if (radius < 0.01) return;
  const segments = s.tool === 'cylinder' ? 32 : 6;
  const geo = new THREE.CircleGeometry(radius, segments);
  const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(c.x, 0.05, c.z);
  group.add(mesh);
}
```

- [ ] **Step 5: HUD hint for circle/polygon**

In the `hint` computation, add:
```ts
if ((draw.state.tool === 'cylinder' || draw.state.tool === 'polygon') && draw.state.points.length === 1) {
  const c = draw.state.points[0], r = draw.state.cursor;
  return `R = ${Math.hypot(r.x - c.x, r.z - c.z).toFixed(2)} m`;
}
```

- [ ] **Step 6: Verify in browser**

Try circle: click center, click outside → dialog → confirm → cylinder appears.
Try polygon: same flow but dialog has a "邊數" field (default 6); changing it to 8 produces an octagon.

---

## Task 9: L-shape + T-shape tools

**Files:**
- Modify: `hooks/useDrawingTool.ts`
- Modify: `components/ThreeDViewer.tsx` (preview)

**Pattern:** Click two corners (defines L1×W1 main body), then dialog asks for L2/W2 + direction.

- [ ] **Step 1: Add tool branch to `handlePointerDown`**

```ts
if (tool === 'lShape' || tool === 'tShape') {
  setState(s => {
    if (s.kind !== 'placing' || s.tool !== tool) {
      return { kind: 'placing', tool, points: [world], cursor: world };
    }
    const a = s.points[0], b = world;
    const l1 = Math.abs(b.x - a.x);
    const w1 = Math.abs(b.z - a.z);
    if (l1 < 0.1 || w1 < 0.1) return s;
    return {
      kind: 'awaiting-extrude',
      tool,
      baseParams: { l1, w1, l2: l1 / 2, w2: w1 / 2, wwr: 0.35, glassType: 'Double', shadingType: 'None' },
      position: { x: (a.x + b.x) / 2, y: (a.z + b.z) / 2 },
    };
  });
  return;
}
```

- [ ] **Step 2: Add extra fields**

```ts
if (state.kind === 'awaiting-extrude') {
  if (state.tool === 'lShape') return [
    { kind: 'number', key: 'l2', label: '次體 L2', defaultValue: state.baseParams.l2 ?? 20, min: 1, step: 1 },
    { kind: 'number', key: 'w2', label: '次體 W2', defaultValue: state.baseParams.w2 ?? 15, min: 1, step: 1 },
    { kind: 'select', key: 'lDirection', label: '轉折方向', defaultValue: 'TopLeft', options: [
      { value: 'TopLeft', label: '左上' }, { value: 'TopRight', label: '右上' },
      { value: 'BottomLeft', label: '左下' }, { value: 'BottomRight', label: '右下' },
    ]},
  ];
  if (state.tool === 'tShape') return [
    { kind: 'number', key: 'l2', label: '翼部 L2', defaultValue: state.baseParams.l2 ?? 20, min: 1, step: 1 },
    { kind: 'number', key: 'w2', label: '翼部 W2', defaultValue: state.baseParams.w2 ?? 15, min: 1, step: 1 },
    { kind: 'select', key: 'wingPosition', label: '翼部位置', defaultValue: 'top', options: [
      { value: 'top', label: '上' }, { value: 'bottom', label: '下' },
      { value: 'left', label: '左' }, { value: 'right', label: '右' },
    ]},
  ];
}
```

(Match the actual enum values in `LShapeDirection` / `TShapeWingPosition` — read `types.ts` to confirm exact string casing.)

- [ ] **Step 3: Apply extras in `confirmExtrude`**

```ts
if (curr.tool === 'lShape') {
  params.l2 = Number(extras.l2);
  params.w2 = Number(extras.w2);
  params.lDirection = extras.lDirection as any;
}
if (curr.tool === 'tShape') {
  params.l2 = Number(extras.l2);
  params.w2 = Number(extras.w2);
  params.wingPosition = extras.wingPosition as any;
}
```

- [ ] **Step 4: Preview = same as box (just outline of main body)**

Add to preview useEffect:
```ts
if ((s.tool === 'lShape' || s.tool === 'tShape') && s.points.length === 1) {
  // same as box preview, just bounding rectangle
  const a = s.points[0], c = s.cursor;
  const w = Math.abs(c.x - a.x), l = Math.abs(c.z - a.z);
  if (w < 0.01 || l < 0.01) return;
  const geo = new THREE.PlaneGeometry(w, l);
  const mat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((a.x + c.x) / 2, 0.05, (a.z + c.z) / 2);
  group.add(mesh);
}
```

- [ ] **Step 5: Verify in browser**

Pick L-shape, click two corners, dialog shows L2/W2/direction. Confirm → L-shape building appears with correct orientation.
Pick T-shape, repeat with wingPosition.

---

## Task 10: Arc + ellipse + fan tools

**Files:**
- Modify: `hooks/useDrawingTool.ts`
- Modify: `components/ThreeDViewer.tsx` (preview)

**Note:** These are 3-click tools. State transitions get longer; refer to Spec §6.2 for the click sequences.

- [ ] **Step 1: Implement state transitions**

For each tool, the pattern in `handlePointerDown` is:
- `points.length === 0` → push `world`, stay in placing.
- For 3-click tools, after each click push and stay until final click.
- On final click → compute params → enter `awaiting-extrude`.

Spec rows for arc / fan / ellipse describe the click meaning. Implement carefully; small test by drawing each.

- [ ] **Step 2: Add previews**

Use `THREE.RingGeometry` for arc/fan partial rings, `THREE.Shape` + `ExtrudeGeometry` (depth=0.01) or `ShapeGeometry` for ellipse outline.

- [ ] **Step 3: Map to params + extras**

Arc: no extras in dialog, just height. Params `arcRadius, arcAngle, depth` (default depth=20 — show it as an extra number field if needed).
Ellipse: no extras, just height. Params `majorRadius, minorRadius`.
Fan: extras `innerRadius` (number). Params `outerRadius, innerRadius, fanAngle`.

- [ ] **Step 4: Verify in browser**

For each: complete the click sequence, confirm dialog, confirm shape appears matching the preview.

---

## Task 11: Polyline tool in 3D

**Files:**
- Modify: `hooks/useDrawingTool.ts`
- Modify: `components/ThreeDViewer.tsx` (preview)

**Goal:** Draw polyline directly in 3D (raycast on each click), close by clicking near the first point or pressing Enter, dialog → commit.

- [ ] **Step 1: Add transitions**

```ts
if (tool === 'polyline') {
  setState(s => {
    if (s.kind !== 'placing' || s.tool !== 'polyline') {
      return { kind: 'placing', tool: 'polyline', points: [world], cursor: world };
    }
    const first = s.points[0];
    const closeDist = Math.hypot(world.x - first.x, world.z - first.z);
    if (s.points.length >= 3 && closeDist < 1.0) {
      // close
      const pts = s.points.map(p => ({ x: p.x, y: p.z })); // map z→y for storage
      return {
        kind: 'awaiting-extrude',
        tool: 'polyline',
        baseParams: { points: pts, isClosed: true, wwr: 0.35, glassType: 'Double', shadingType: 'None' },
        position: { x: 0, y: 0 },
      };
    }
    return { ...s, points: [...s.points, world], cursor: world };
  });
  return;
}
```

Add Enter key handler in `handleKeyDown`: if state is placing polyline with ≥3 points, force close.

- [ ] **Step 2: Add preview**

```ts
if (s.tool === 'polyline' && s.points.length >= 1) {
  const positions: number[] = [];
  for (const p of s.points) positions.push(p.x, 0.05, p.z);
  positions.push(s.cursor.x, 0.05, s.cursor.z);
  if (s.points.length >= 2) positions.push(s.points[0].x, 0.05, s.points[0].z); // hint closing line
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x3b82f6 });
  const line = new THREE.Line(geo, mat);
  group.add(line);
  // also small dots at each placed point
  s.points.forEach(p => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
    dot.position.set(p.x, 0.1, p.z);
    group.add(dot);
  });
}
```

- [ ] **Step 3: Commit polyline**

`confirmExtrude` already handles generic shape creation; for polyline also write `extrudeHeight: height` into `params`.

- [ ] **Step 4: Verify in browser**

Pick polyline, click 5 points, click near first point → dialog → confirm. Polyline shape renders in 3D with WWR texture.

---

## Task 12: Select + delete tools

**Files:**
- Modify: `hooks/useDrawingTool.ts`
- Modify: `components/ThreeDViewer.tsx`

- [ ] **Step 1: Select tool**

When `tool === 'select'`:
- On `handlePointerDown`, perform raycast against `objectsGroupRef.current` and look up `floorId/shapeId` from `userData` (existing pattern in ThreeDViewer click handler).
- Call `args.onSelectShape(shapeId)`.

Recommended: extract the existing raycast-to-shape logic in ThreeDViewer into a callback, expose it to `useDrawingTool`, or pass it as part of `args`. Simpler: handle it inline in ThreeDViewer's pointer-down handler when `draw.tool === 'select'`.

- [ ] **Step 2: Delete tool**

When `tool === 'delete'`, on click → raycast to find shape → remove from `floor.shapes[]`:
```ts
const next = args.floors.map(f =>
  f.id === floorId ? { ...f, shapes: f.shapes.filter(s => s.id !== shapeId) } : f
);
args.onFloorsChange(next);
```

- [ ] **Step 3: Del key on select**

In `handleKeyDown`, if `e.key === 'Delete'` or `'Backspace'` and `selectedShapeId` is set, do the same removal. (Pass `selectedShapeId` into the hook via `args`.)

- [ ] **Step 4: Verify**

Select tool: click a shape, it highlights (existing wireframe behavior). Delete tool: click any shape, it disappears. Press Del while a shape is selected: it disappears.

---

## Task 13: Move + rotate tools

**Files:**
- Modify: `hooks/useDrawingTool.ts`
- Modify: `components/ThreeDViewer.tsx`

**Move:** Click shape to grab → drag → release commits new `position`.
**Rotate:** Click shape to grab → drag clockwise/counter-clockwise around its position → release commits new `rotation` (degrees).

- [ ] **Step 1: Move state**

```ts
// inside handlePointerDown when tool === 'move'
// raycast to find shape; if hit, store start state:
setState({ kind: 'transforming', mode: 'move', shapeId, floorId, start: world });
```

In `handlePointerMove`, when `state.kind === 'transforming' && mode === 'move'`:
- Compute delta `world - start`, look up the shape, write `shape.position = origPos + delta` via `onFloorsChange`.

In `handlePointerUp`, end transform: `setState({ kind: 'idle' })`.

- [ ] **Step 2: Rotate state**

Same pattern but compute angle: `angle = atan2(world.z - shape.position.y, world.x - shape.position.x)` minus initial angle. Write to `shape.rotation` (convert radians to degrees).

- [ ] **Step 3: Visual feedback**

Optional: on hover during move/rotate, show a faint outline of the shape's bounding box. MVP can skip and just show OS cursor change via CSS:
```ts
canvas.style.cursor = (tool === 'move') ? 'move' : (tool === 'rotate') ? 'crosshair' : 'default';
```

- [ ] **Step 4: Verify**

Pick move, drag a shape across the floor — it follows the cursor.
Pick rotate, drag around a shape — it rotates. Releasing commits.

---

## Task 14: Lock-top-view toggle (orthographic camera)

**Files:**
- Modify: `components/ThreeDViewer.tsx`

- [ ] **Step 1: Save current perspective state, swap cameras**

When `topViewLocked` becomes `true`:
- Snapshot perspective camera position + target.
- Create `THREE.OrthographicCamera` looking down: `position.set(0, 200, 0)`, `lookAt(0, 0, 0)`, frustum sized to viewport.
- Replace `cameraRef.current`.
- Set `controlsRef.current.enableRotate = false`.

When `topViewLocked` becomes `false`:
- Restore the saved perspective camera.
- Re-enable rotate.

Resize handler must re-compute orthographic frustum on container size change.

- [ ] **Step 2: Verify**

Click the lock-top-view button (⬇ at bottom of toolbar). Camera snaps to true top-down, no rotation possible. Click again — restored to previous perspective view.
Drawing tools work in both modes.

---

## Task 15: FloorManagerPanel toggle button polish

**Files:**
- Modify: `App.tsx:626-700` (the existing collapse area)

**Current state:** The toggle button is a tiny ◀/▶ square that's easy to miss. Make it larger and clearer.

- [ ] **Step 1: Restyle the toggle**

In App.tsx near the toggle button (line 632), increase size and add a label:
```tsx
<button
  onClick={() => setShowFloorPanel(!showFloorPanel)}
  className="bg-slate-900/90 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-black transition-all shadow-xl border border-white/20 flex items-center gap-1.5"
>
  <span>{showFloorPanel ? '◀' : '▶'}</span>
  <span>{showFloorPanel ? (lang === 'zh' ? '收合' : 'Hide') : (lang === 'zh' ? '面板' : 'Panel')}</span>
</button>
```

- [ ] **Step 2: Avoid overlap with DrawingToolbar**

DrawingToolbar is positioned `top-3 left-3`. The floor panel container is also positioned `top-3 left-3`. Move the floor panel right by 56px (toolbar width + gap):
```tsx
<div className="absolute top-3 left-[56px] bottom-3 z-20 ..." style={{ width: showFloorPanel ? '300px' : 'auto' }}>
```

- [ ] **Step 3: Verify**

Toggle button is now visibly bigger with a text label. Toolbar (left edge) and floor panel (right of toolbar) coexist without overlap. Collapsing the panel still works.

---

## Task 16: Acceptance pass

- [ ] **Step 1: Run the full acceptance checklist** (from spec §12)

Walk through each item:
- [ ] 14 toolbar buttons all clickable with tooltips.
- [ ] All 9 shape tools complete a draw → dialog → commit cycle.
- [ ] Move/rotate/delete update floors correctly.
- [ ] Snap aligns to grid; HUD shows live coords + drawing edge length.
- [ ] Lock-top-view toggle works both ways.
- [ ] FloorManagerPanel toggle is clearly visible.
- [ ] No-active-floor toast appears.
- [ ] ESC cancels current drawing.
- [ ] extrudeHeight ↔ floorHeight stays in sync (visually: stacked floors line up).

- [ ] **Step 2: Sanity-check console**

Open DevTools console: no red errors during a full session of drawing each shape type.

- [ ] **Step 3: Performance smoke test**

Draw 5 shapes on one floor, switch tools rapidly, drag-rotate the scene. Frame rate should remain smooth (no obvious stutter).

- [ ] **Step 4: Report to user**

Summarize: what works, anything that didn't quite hit the bar, screenshots/notes. The user reviews before we consider this complete.

---

## Risks & Notes

- **Pointer event ordering:** ThreeDViewer already has pointer handlers for hover overlay, shape drag, and add-floor sprite. Each new task must integrate without breaking those — when `draw.tool !== 'pan'`, the existing handlers should early-return.
- **Stale closures in hooks:** `useDrawingTool` reads `args.floors` inside callbacks. Wrap callbacks with `useCallback` and include `args` (or destructured stable refs) in deps, mirroring how `updateFloorShapes` does it in TopViewCanvas.
- **TypeScript gotchas on `extras`:** `Record<string, number | string>` loses union narrowing. Cast at use sites (`extras.lDirection as LShapeDirection`).
- **No test runner:** All verification is manual via dev server. If the user later wants automated tests, a follow-up plan should add Vitest + a small render harness.
