
import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GeometryObject, Floor, FloorShape, ShadingType } from '../types';
import DrawingToolbar from './drawing/DrawingToolbar';
import DrawingHUD from './drawing/DrawingHUD';
import DrawingParamBar from './drawing/DrawingParamBar';
import ExtrudeHeightDialog from './drawing/ExtrudeHeightDialog';
import { useDrawingTool, ToolKind } from '../hooks/useDrawingTool';
import { useGroundRaycaster } from '../hooks/useGroundRaycaster';
import { shapeAnchors, shapeToPolygons } from '../services/areaUnion';

const SNAP_THRESHOLD_M_MOVE = 2.0;

// Snap radius scales with grid spacing — bigger grid = larger world tolerance
// because each "cell" the cursor sits in covers more world distance.
function snapRadius(gridSize: number): number {
  return Math.max(SNAP_THRESHOLD_M_MOVE, gridSize * 0.8);
}

// Sum heights of floors below targetId to get its base Y.
function computeFloorBaseY(floors: Floor[] | undefined, targetId: string | null): number {
  if (!floors || !targetId) return 0;
  let y = 0;
  for (const f of floors) {
    if (f.id === targetId) return y;
    y += f.floorHeight || 0;
  }
  return 0;
}

// Project a 3D world point to screen pixel coords (relative to the canvas).
function worldToScreenPx(p: THREE.Vector3, camera: THREE.Camera, dom: HTMLElement): { x: number; y: number } {
  const v = p.clone().project(camera);
  const rect = dom.getBoundingClientRect();
  return { x: (v.x * 0.5 + 0.5) * rect.width, y: (-v.y * 0.5 + 0.5) * rect.height };
}

// Find the shape vertex (top OR bottom) closest in screen pixels to the cursor.
function pickNearestVertexOnScreen(
  event: MouseEvent | PointerEvent,
  dom: HTMLElement,
  camera: THREE.Camera,
  shapes: FloorShape[],
  baseY: number,
  topY: number,
  pxThreshold: number,
): { x: number; z: number; y: number } | null {
  const rect = dom.getBoundingClientRect();
  const cx = event.clientX - rect.left;
  const cy = event.clientY - rect.top;
  let best: { x: number; z: number; y: number } | null = null;
  let bestPx = pxThreshold;
  const tmp = new THREE.Vector3();
  for (const sh of shapes) {
    const anchors = shapeAnchors(sh);
    for (const a of anchors) {
      for (const wy of [baseY, topY]) {
        tmp.set(a.x, wy, a.y);
        const sp = worldToScreenPx(tmp, camera, dom);
        const d = Math.hypot(sp.x - cx, sp.y - cy);
        if (d < bestPx) {
          bestPx = d;
          best = { x: a.x, z: a.y, y: wy };
        }
      }
    }
  }
  return best;
}

// Vertex picker that EXCLUDES edge midpoints (only true corners) — useful when
// we want to fall back to edge snap for clicks between corners.
function pickNearestCornerOnScreen(
  event: MouseEvent | PointerEvent, dom: HTMLElement, camera: THREE.Camera,
  shapes: FloorShape[], baseY: number, topY: number, pxThreshold: number,
): { x: number; z: number; y: number } | null {
  const rect = dom.getBoundingClientRect();
  const cx = event.clientX - rect.left;
  const cy = event.clientY - rect.top;
  let best: { x: number; z: number; y: number } | null = null;
  let bestPx = pxThreshold;
  const tmp = new THREE.Vector3();
  for (const sh of shapes) {
    const polys = shapeToPolygons(sh);
    for (const poly of polys) {
      for (const corner of poly) {
        for (const wy of [baseY, topY]) {
          tmp.set(corner.x, wy, corner.y);
          const sp = worldToScreenPx(tmp, camera, dom);
          const d = Math.hypot(sp.x - cx, sp.y - cy);
          if (d < bestPx) { bestPx = d; best = { x: corner.x, z: corner.y, y: wy }; }
        }
      }
    }
  }
  return best;
}

// Find the closest point on any shape edge in screen pixels.
function pickNearestEdgeOnScreen(
  event: MouseEvent | PointerEvent, dom: HTMLElement, camera: THREE.Camera,
  shapes: FloorShape[], baseY: number, topY: number, pxThreshold: number,
): { x: number; z: number; y: number } | null {
  const rect = dom.getBoundingClientRect();
  const cx = event.clientX - rect.left;
  const cy = event.clientY - rect.top;
  let best: { x: number; z: number; y: number } | null = null;
  let bestPx = pxThreshold;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const sh of shapes) {
    const polys = shapeToPolygons(sh);
    for (const poly of polys) {
      const N = poly.length;
      for (let i = 0; i < N; i++) {
        const p1 = poly[i], p2 = poly[(i + 1) % N];
        for (const wy of [baseY, topY]) {
          a.set(p1.x, wy, p1.y);
          b.set(p2.x, wy, p2.y);
          const sa = worldToScreenPx(a, camera, dom);
          const sb = worldToScreenPx(b, camera, dom);
          const dx = sb.x - sa.x, dy = sb.y - sa.y;
          const len2 = dx * dx + dy * dy;
          if (len2 < 1) continue;
          const t = Math.max(0, Math.min(1, ((cx - sa.x) * dx + (cy - sa.y) * dy) / len2));
          const px = sa.x + t * dx, py = sa.y + t * dy;
          const d = Math.hypot(px - cx, py - cy);
          if (d < bestPx) {
            bestPx = d;
            best = {
              x: p1.x + t * (p2.x - p1.x),
              z: p1.y + t * (p2.y - p1.y),
              y: wy,
            };
          }
        }
      }
    }
  }
  return best;
}

interface ThreeDViewerProps {
  objects: GeometryObject[];
  floors?: Floor[];
  selectedFloorId?: string | null;
  selectedShapeId?: string | null;
  editingFloorId?: string | null;
  lang: 'zh' | 'en';
  showCompass?: boolean;
  onSelectFloor?: (floorId: string) => void;
  onSelectShape?: (shapeId: string | null) => void;
  onAddFloor?: () => void;
  onMoveShape?: (floorId: string, shapeId: string, x: number, y: number) => void;
  onEnterEditMode?: (floorId: string) => void;
  onExitEditMode?: () => void;
  onFloorsChange?: (floors: Floor[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  /** Increment to request entering top-view edit for selectedFloorId (from FloorManagerPanel 📐) */
  topViewRequestSeq?: number;
  /** When true, walls are coloured by heat-loss intensity instead of normal facade textures.
   *  Heatmap value per shape is computed from U-value × WWR × wall area; values are normalized
   *  across the building so the worst face is red and the best is green. */
  heatmapMode?: boolean;
  /** Optional explicit heat-loss values (W/K) per shape, keyed by shape id. If not provided,
   *  the viewer estimates from each shape's wwr and assumes a baseline U=2.0 W/m²K. */
  heatmapDataByShape?: Record<string, number>;
}

/**
 * Heatmap colour ramp: green (cool / low heat-loss) → yellow → red (hot / high heat-loss).
 * Input `t` is normalized intensity 0..1.
 */
function heatColorAt(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  // 0.0 = green #10b981, 0.5 = yellow #f59e0b, 1.0 = red #dc2626
  let r: number, g: number, b: number;
  if (x < 0.5) {
    const s = x / 0.5;
    r = Math.round(0x10 + (0xf5 - 0x10) * s);
    g = Math.round(0xb9 + (0x9e - 0xb9) * s);
    b = Math.round(0x81 + (0x0b - 0x81) * s);
  } else {
    const s = (x - 0.5) / 0.5;
    r = Math.round(0xf5 + (0xdc - 0xf5) * s);
    g = Math.round(0x9e + (0x26 - 0x9e) * s);
    b = Math.round(0x0b + (0x26 - 0x0b) * s);
  }
  return (r << 16) | (g << 8) | b;
}

const ThreeDViewer: React.FC<ThreeDViewerProps> = ({
  objects, floors, selectedFloorId, selectedShapeId, editingFloorId, lang, showCompass = true,
  onSelectFloor, onSelectShape, onAddFloor, onMoveShape, onEnterEditMode, onExitEditMode, onFloorsChange,
  onUndo, onRedo, canUndo, canRedo, topViewRequestSeq,
  heatmapMode = false, heatmapDataByShape,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsGroupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoverOverlayRef = useRef<THREE.Mesh | null>(null);
  const addButtonSpriteRef = useRef<THREE.Sprite | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Drag state refs
  const isDraggingRef = useRef(false);
  const dragShapeRef = useRef<{ floorId: string; shapeId: string; startX: number; startZ: number; origX: number; origZ: number } | null>(null);
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragIntersectRef = useRef(new THREE.Vector3());
  const dragStartWorldRef = useRef(new THREE.Vector3());
  const mouseDownPosRef = useRef({ x: 0, y: 0 });

  // Refs for callbacks to avoid stale closures
  const onSelectFloorRef = useRef(onSelectFloor);
  const onSelectShapeRef = useRef(onSelectShape);
  const onAddFloorRef = useRef(onAddFloor);
  const onMoveShapeRef = useRef(onMoveShape);
  const onEnterEditModeRef = useRef(onEnterEditMode);
  const onExitEditModeRef = useRef(onExitEditMode);
  const editingFloorIdRef = useRef(editingFloorId);
  onSelectFloorRef.current = onSelectFloor;
  onSelectShapeRef.current = onSelectShape;
  onAddFloorRef.current = onAddFloor;
  onMoveShapeRef.current = onMoveShape;
  onEnterEditModeRef.current = onEnterEditMode;
  onExitEditModeRef.current = onExitEditMode;

  // Drawing-tool state + hooks (Tasks 3-13)
  const previewGroupRef = useRef<THREE.Group | null>(null);
  const snapDotsGroupRef = useRef<THREE.Group | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(1.0);
  const [topViewLocked, setTopViewLocked] = useState(false);
  // Track whether the user manually toggled top-view (so we don't override on tool exit)
  const topViewWasUserToggledRef = useRef(false);
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null);
  const [snapKind, setSnapKind] = useState<'none' | 'vertex' | 'edge' | 'grid'>('none');
  const [toast, setToast] = useState<string | null>(null);

  // Active floor's bottom Y (cursor projection plane).
  const activeFloorBaseY = useMemo(() => {
    if (!floors || !selectedFloorId) return 0;
    let y = 0;
    for (const f of floors) {
      if (f.id === selectedFloorId) return y;
      y += f.floorHeight;
    }
    return 0;
  }, [floors, selectedFloorId]);
  const ground = useGroundRaycaster({ snap: snapToGrid, gridSize, maxDistance: 500, planeY: activeFloorBaseY });
  const draw = useDrawingTool({
    floors: floors ?? [],
    activeFloorId: selectedFloorId ?? null,
    selectedShapeId: selectedShapeId ?? null,
    onFloorsChange: onFloorsChange ?? (() => {}),
    onSelectShape: (id) => onSelectShape?.(id as any),
    onSelectFloor: (id) => onSelectFloor?.(id as any),
    onToast: (m) => { setToast(m); setTimeout(() => setToast(null), 2500); },
    gridSnap: snapToGrid ? { gridSize } : undefined,
  });

  // Refs for drawing handlers (avoid stale closures inside the long-lived mouse listeners)
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const groundRef = useRef(ground);
  groundRef.current = ground;
  editingFloorIdRef.current = editingFloorId;
  // Live refs for floors / selectedFloorId so snap detection inside long-lived
  // event listeners always sees the latest data.
  const floorsRef = useRef(floors);
  floorsRef.current = floors;
  const selectedFloorIdRef = useRef(selectedFloorId);
  selectedFloorIdRef.current = selectedFloorId;
  const snapKindRef = useRef<'none' | 'vertex' | 'edge' | 'grid'>('none');

  const createFacadeTexture = (wwr: number = 0.3, shadingType: string = 'None') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Wall base color
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 1024, 1024);

    // Single row of windows — column count driven by WWR
    // Low WWR (0.1) → 2 cols, High WWR (0.9) → 8 cols
    const cols = Math.max(2, Math.min(8, Math.round(2 + wwr * 7)));

    // Window band occupies the middle portion of the facade
    const S = 1024; // texture size
    const bandHeight = S * 0.55;
    const bandY = (S - bandHeight) / 2;
    const margin = 40;
    const gap = 24;
    const usableWidth = S - margin * 2;
    const cellW = usableWidth / cols;
    const winW = cellW - gap;
    const winH = bandHeight * Math.min(1, wwr * 1.4 + 0.2);
    const winY = bandY + (bandHeight - winH) / 2;

    for (let c = 0; c < cols; c++) {
      const x = margin + c * cellW + gap / 2;

      // Window glass
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x, winY, winW, winH);

      // Window frame
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, winY, winW, winH);

      // Center mullion (vertical divider)
      if (winW > 60) {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + winW / 2, winY);
        ctx.lineTo(x + winW / 2, winY + winH);
        ctx.stroke();
      }

      // Shading elements
      if (shadingType !== 'None') {
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 6;
        if (shadingType === 'Horizontal') {
          // Overhang above window
          ctx.beginPath();
          ctx.moveTo(x - 4, winY - 2);
          ctx.lineTo(x + winW + 4, winY - 2);
          ctx.stroke();
        } else if (shadingType === 'Vertical') {
          // Fins on both sides
          ctx.beginPath();
          ctx.moveTo(x - 2, winY - 4);
          ctx.lineTo(x - 2, winY + winH + 4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + winW + 2, winY - 4);
          ctx.lineTo(x + winW + 2, winY + winH + 4);
          ctx.stroke();
        } else if (shadingType === 'Eggcrate') {
          ctx.strokeRect(x - 3, winY - 3, winW + 6, winH + 6);
        } else if (shadingType === 'Louver') {
          // Horizontal louver lines across window
          const louverCount = 3;
          for (let l = 1; l <= louverCount; l++) {
            const ly = winY + (winH * l) / (louverCount + 1);
            ctx.beginPath();
            ctx.moveTo(x, ly);
            ctx.lineTo(x + winW, ly);
            ctx.stroke();
          }
        }
      }
    }

    // Subtle floor line at bottom
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 1022);
    ctx.lineTo(1024, 1022);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
    texture.generateMipmaps = false;
    return texture;
  };

  const createCompass = () => {
    const group = new THREE.Group();
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0.5, 0),
      20,
      0xef4444,
      5,
      3
    );
    group.add(arrow);
    const circle = new THREE.Mesh(
      new THREE.RingGeometry(18, 20, 32),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, side: THREE.DoubleSide })
    );
    circle.rotation.x = -Math.PI / 2;
    group.add(circle);
    return group;
  };

  // Plain wall texture (no windows) for faces marked as no-window.
  const createWallOnlyTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 256, 256);
    // subtle floor line at bottom
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 254); ctx.lineTo(256, 254); ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };

  // Shared UV generator for ExtrudeGeometry shapes (polyline / arc / fan / ellipse).
  // Each side-wall quad gets normalized 0..1 UVs so the WWR facade texture maps
  // exactly once per wall segment — preventing the world-space stretching that
  // happens with Three.js's default WorldUVGenerator + ClampToEdgeWrapping.
  const FACADE_UV_GEN = {
    generateTopUV: (_geometry: THREE.ExtrudeGeometry, vertices: number[], indexA: number, indexB: number, indexC: number) => [
      new THREE.Vector2(vertices[indexA * 3], vertices[indexA * 3 + 1]),
      new THREE.Vector2(vertices[indexB * 3], vertices[indexB * 3 + 1]),
      new THREE.Vector2(vertices[indexC * 3], vertices[indexC * 3 + 1]),
    ],
    generateSideWallUV: () => [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1, 0),
      new THREE.Vector2(1, 1),
      new THREE.Vector2(0, 1),
    ],
  };

  // Helper: Create ExtrudeGeometry mesh with dynamically-detected material assignment
  // Inspects geometry groups to determine which is sides (more faces) vs caps (fewer faces)
  const createExtrudeMesh = (
    geo: THREE.ExtrudeGeometry,
    facadeMat: THREE.Material,
    capMat: THREE.Material
  ): THREE.Mesh => {
    const groups = geo.groups;
    const materials: THREE.Material[] = [];

    if (groups.length >= 2) {
      // Find the group with the most faces — that's the side walls
      let maxCount = 0;
      let maxIdx = 0;
      groups.forEach(g => {
        if (g.count > maxCount) {
          maxCount = g.count;
          maxIdx = g.materialIndex;
        }
      });
      // Assign: largest group = facades, rest = caps
      for (let i = 0; i <= Math.max(...groups.map(g => g.materialIndex)); i++) {
        materials[i] = (i === maxIdx) ? facadeMat : capMat;
      }
    } else {
      // Single group or none — apply facade to everything
      materials[0] = facadeMat;
    }

    return new THREE.Mesh(geo, materials);
  };

  // Split an ExtrudeGeometry's "sides" group into per-quad groups, each with
  // its own materialIndex. Caller provides a picker that returns the material
  // for each quad (0..actualN-1). Using actual quad count from geometry avoids
  // missing/extra triangles when the contour edge count differs from prediction.
  const buildExtrudeMaterialsByEdge = (
    geo: THREE.ExtrudeGeometry,
    expectedN: number,
    capMat: THREE.Material,
    perEdgeMats: THREE.Material[],
  ): THREE.Material[] => {
    const groups = geo.groups;
    if (groups.length === 0) return [capMat];
    let sidesIdx = 0;
    let maxCount = 0;
    groups.forEach((g, i) => {
      if (g.count > maxCount) { maxCount = g.count; sidesIdx = i; }
    });
    const sides = groups[sidesIdx];
    const start = sides.start;
    const total = sides.count;
    const perQuad = 6; // 1 quad = 2 triangles = 6 indices
    const actualN = Math.floor(total / perQuad);
    if (actualN === 0) return [capMat];
    groups.splice(sidesIdx, 1);
    groups.forEach(g => { g.materialIndex = 0; });
    const mats: THREE.Material[] = [capMat];
    for (let i = 0; i < actualN; i++) {
      // If geometry produced more quads than expected, reuse the last
      // logical material for the leftovers (avoids missing-material black faces).
      const matIdx = Math.min(i, perEdgeMats.length - 1);
      geo.addGroup(start + i * perQuad, perQuad, mats.length);
      mats.push(perEdgeMats[matIdx]);
    }
    return mats;
  };

  // Build shape mesh for a given shape + height
  const buildShapeMesh = (
    shape: { type: string; params: Record<string, any> },
    height: number,
    facadeMat: THREE.Material,
    wallOnlyMat: THREE.Material,
    roofMat: THREE.Material,
    floorMat: THREE.Material,
    isTopFloor: boolean,
    noWindowFaces: Set<string>,
  ): THREE.Group => {
    const group = new THREE.Group();
    const p = shape.params;
    const pick = (key: string): THREE.Material => noWindowFaces.has(key) ? wallOnlyMat : facadeMat;

    switch (shape.type) {
      case 'box': {
        const geo = new THREE.BoxGeometry(p.width || 40, height, p.length || 30);
        // [+X='E', -X='W', +Y(top), -Y(bot), +Z='S', -Z='N']
        const materials = [
          pick('E'), pick('W'),
          isTopFloor ? roofMat : floorMat, floorMat,
          pick('S'), pick('N'),
        ];
        const mesh = new THREE.Mesh(geo, materials);
        mesh.position.y = height / 2;
        group.add(mesh);
        break;
      }

      case 'cylinder': {
        const sideMat = pick('side');
        const geo = new THREE.CylinderGeometry(p.radius || 15, p.radius || 15, height, 32);
        const mesh = new THREE.Mesh(geo, [sideMat, isTopFloor ? roofMat : floorMat, floorMat]);
        mesh.position.y = height / 2;
        group.add(mesh);
        break;
      }

      case 'lShape': {
        // If user drew the L freehand (6-point outline), render directly from points.
        if (p.points && p.points.length >= 3 && p.isClosed !== false) {
          const polyShape = new THREE.Shape();
          polyShape.moveTo(p.points[0].x, p.points[0].y);
          for (let i = 1; i < p.points.length; i++) polyShape.lineTo(p.points[i].x, p.points[i].y);
          polyShape.closePath();
          const geo = new THREE.ExtrudeGeometry(polyShape, {
            depth: height, bevelEnabled: false, UVGenerator: FACADE_UV_GEN,
          });
          const N = p.points.length;
          const pickF = (k: string): THREE.Material => noWindowFaces.has(k) ? wallOnlyMat : facadeMat;
          const perEdgeMats = Array.from({ length: N }, (_, i) => pickF(`edge-${i}`));
          const capMat = isTopFloor ? roofMat : floorMat;
          const materials = buildExtrudeMaterialsByEdge(geo, N, capMat, perEdgeMats);
          const mesh = new THREE.Mesh(geo, materials);
          mesh.rotation.x = -Math.PI / 2;
          group.add(mesh);
          break;
        }
        const l1 = p.l1 || 40, w1 = p.w1 || 20;
        const l2 = p.l2 || 20, w2 = p.w2 || 15;
        const dir = p.lDirection || 'TopLeft';
        const mx = l1 / 2, my = w1 / 2;

        // World-space outline (counter-clockwise viewed from above), then negate Z
        // for the 2D shape (matching the polyline rotation convention).
        let worldPts: { x: number; y: number }[];
        if (dir === 'TopLeft') {
          worldPts = [
            { x: -mx, y: -my }, { x: mx, y: -my }, { x: mx, y: my },
            { x: -mx + l2, y: my }, { x: -mx + l2, y: my + w2 }, { x: -mx, y: my + w2 },
          ];
        } else if (dir === 'TopRight') {
          worldPts = [
            { x: -mx, y: -my }, { x: mx, y: -my }, { x: mx, y: my + w2 },
            { x: mx - l2, y: my + w2 }, { x: mx - l2, y: my }, { x: -mx, y: my },
          ];
        } else if (dir === 'BottomLeft') {
          worldPts = [
            { x: -mx, y: -my - w2 }, { x: -mx + l2, y: -my - w2 }, { x: -mx + l2, y: -my },
            { x: mx, y: -my }, { x: mx, y: my }, { x: -mx, y: my },
          ];
        } else {
          worldPts = [
            { x: mx - l2, y: -my - w2 }, { x: mx, y: -my - w2 }, { x: mx, y: my },
            { x: -mx, y: my }, { x: -mx, y: -my }, { x: mx - l2, y: -my },
          ];
        }
        const lShape = new THREE.Shape();
        lShape.moveTo(worldPts[0].x, -worldPts[0].y);
        for (let i = 1; i < worldPts.length; i++) lShape.lineTo(worldPts[i].x, -worldPts[i].y);
        lShape.closePath();
        const geo = new THREE.ExtrudeGeometry(lShape, {
          depth: height, bevelEnabled: false, UVGenerator: FACADE_UV_GEN,
        });
        const N = worldPts.length;
        const perEdgeMats = Array.from({ length: N }, (_, i) => pick(`edge-${i}`));
        const capMat = isTopFloor ? roofMat : floorMat;
        const materials = buildExtrudeMaterialsByEdge(geo, N, capMat, perEdgeMats);
        const mesh = new THREE.Mesh(geo, materials);
        mesh.rotation.x = -Math.PI / 2;
        group.add(mesh);
        break;
      }

      case 'tShape': {
        // If user drew the T freehand (8-point outline), render directly from points.
        if (p.points && p.points.length >= 3 && p.isClosed !== false) {
          const polyShape = new THREE.Shape();
          polyShape.moveTo(p.points[0].x, p.points[0].y);
          for (let i = 1; i < p.points.length; i++) polyShape.lineTo(p.points[i].x, p.points[i].y);
          polyShape.closePath();
          const geo = new THREE.ExtrudeGeometry(polyShape, {
            depth: height, bevelEnabled: false, UVGenerator: FACADE_UV_GEN,
          });
          const N = p.points.length;
          const pickF = (k: string): THREE.Material => noWindowFaces.has(k) ? wallOnlyMat : facadeMat;
          const perEdgeMats = Array.from({ length: N }, (_, i) => pickF(`edge-${i}`));
          const capMat = isTopFloor ? roofMat : floorMat;
          const materials = buildExtrudeMaterialsByEdge(geo, N, capMat, perEdgeMats);
          const mesh = new THREE.Mesh(geo, materials);
          mesh.rotation.x = -Math.PI / 2;
          group.add(mesh);
          break;
        }
        const l1 = p.l1 || 40, w1 = p.w1 || 15;
        const l2 = p.l2 || 30, w2 = p.w2 || 20;
        const wingPos = p.wingPosition || 'top';

        // World-space outline (CCW from above)
        let worldPts: { x: number; y: number }[];
        if (wingPos === 'top') {
          const ww = Math.min(l2, l1) / 2;
          worldPts = [
            { x: -l1/2, y: -w1/2 }, { x: l1/2, y: -w1/2 }, { x: l1/2, y: w1/2 },
            { x: ww, y: w1/2 }, { x: ww, y: w1/2 + w2 },
            { x: -ww, y: w1/2 + w2 }, { x: -ww, y: w1/2 }, { x: -l1/2, y: w1/2 },
          ];
        } else if (wingPos === 'bottom') {
          const ww = Math.min(l2, l1) / 2;
          worldPts = [
            { x: -l1/2, y: -w1/2 }, { x: -ww, y: -w1/2 }, { x: -ww, y: -w1/2 - w2 },
            { x: ww, y: -w1/2 - w2 }, { x: ww, y: -w1/2 },
            { x: l1/2, y: -w1/2 }, { x: l1/2, y: w1/2 }, { x: -l1/2, y: w1/2 },
          ];
        } else if (wingPos === 'left') {
          const wd = Math.min(l2, w1) / 2;
          worldPts = [
            { x: -l1/2, y: -w1/2 }, { x: l1/2, y: -w1/2 }, { x: l1/2, y: w1/2 },
            { x: -l1/2, y: w1/2 }, { x: -l1/2, y: wd },
            { x: -l1/2 - w2, y: wd }, { x: -l1/2 - w2, y: -wd }, { x: -l1/2, y: -wd },
          ];
        } else {
          const wd = Math.min(l2, w1) / 2;
          worldPts = [
            { x: -l1/2, y: -w1/2 }, { x: l1/2, y: -w1/2 }, { x: l1/2, y: -wd },
            { x: l1/2 + w2, y: -wd }, { x: l1/2 + w2, y: wd },
            { x: l1/2, y: wd }, { x: l1/2, y: w1/2 }, { x: -l1/2, y: w1/2 },
          ];
        }
        const tShape = new THREE.Shape();
        tShape.moveTo(worldPts[0].x, -worldPts[0].y);
        for (let i = 1; i < worldPts.length; i++) tShape.lineTo(worldPts[i].x, -worldPts[i].y);
        tShape.closePath();
        const geo = new THREE.ExtrudeGeometry(tShape, {
          depth: height, bevelEnabled: false, UVGenerator: FACADE_UV_GEN,
        });
        const N = worldPts.length;
        const perEdgeMats = Array.from({ length: N }, (_, i) => pick(`edge-${i}`));
        const capMat = isTopFloor ? roofMat : floorMat;
        const materials = buildExtrudeMaterialsByEdge(geo, N, capMat, perEdgeMats);
        const mesh = new THREE.Mesh(geo, materials);
        mesh.rotation.x = -Math.PI / 2;
        group.add(mesh);
        break;
      }

      case 'arc': {
        const arcR = p.arcRadius || 30;
        const arcAngle = (p.arcAngle || 90) * Math.PI / 180;
        const depth = p.depth || 20;
        const outerR = arcR + depth;

        const arcShape = new THREE.Shape();
        arcShape.moveTo(arcR, 0);
        arcShape.lineTo(outerR, 0);
        arcShape.absarc(0, 0, outerR, 0, arcAngle, false);
        const endX = Math.cos(arcAngle), endY = Math.sin(arcAngle);
        arcShape.lineTo(endX * arcR, endY * arcR);
        arcShape.absarc(0, 0, arcR, arcAngle, 0, true);

        const curveSegs = 6;
        const geo = new THREE.ExtrudeGeometry(arcShape, {
          depth: height, bevelEnabled: false, curveSegments: curveSegs, UVGenerator: FACADE_UV_GEN,
        });
        // Edges: 0 = side1, 1..curveSegs = outer, curveSegs+1 = side2, rest = inner
        const N = 2 * curveSegs + 2;
        const sideMat1 = pick('side1');
        const outerMat = pick('outer');
        const sideMat2 = pick('side2');
        const innerMat = pick('inner');
        const perEdgeMats: THREE.Material[] = [];
        for (let i = 0; i < N; i++) {
          if (i === 0) perEdgeMats.push(sideMat1);
          else if (i <= curveSegs) perEdgeMats.push(outerMat);
          else if (i === curveSegs + 1) perEdgeMats.push(sideMat2);
          else perEdgeMats.push(innerMat);
        }
        const capMat = isTopFloor ? roofMat : floorMat;
        const materials = buildExtrudeMaterialsByEdge(geo, N, capMat, perEdgeMats);
        const mesh = new THREE.Mesh(geo, materials);
        mesh.rotation.x = -Math.PI / 2;
        group.add(mesh);
        break;
      }

      case 'ellipse': {
        const majorR = p.majorRadius || 25;
        const minorR = p.minorRadius || 15;
        const ellipseShape = new THREE.Shape();
        ellipseShape.ellipse(0, 0, majorR, minorR, 0, Math.PI * 2, false, 0);
        const geo = new THREE.ExtrudeGeometry(ellipseShape, {
          depth: height, bevelEnabled: false, curveSegments: 12, UVGenerator: FACADE_UV_GEN,
        });
        const sideMat = pick('side');
        const capMat = isTopFloor ? roofMat : floorMat;
        const mesh = createExtrudeMesh(geo, sideMat, capMat);
        mesh.rotation.x = -Math.PI / 2;
        group.add(mesh);
        break;
      }

      case 'fan': {
        const innerR = Math.max(0, p.innerRadius ?? 0);
        const outerR = p.outerRadius || 30;
        const fanAngle = (p.fanAngle || 90) * Math.PI / 180;
        const isAnnular = innerR > 0.01;

        const fanShape = new THREE.Shape();
        if (!isAnnular) {
          fanShape.moveTo(0, 0);
          fanShape.lineTo(outerR, 0);
          fanShape.absarc(0, 0, outerR, 0, fanAngle, false);
          fanShape.lineTo(0, 0);
        } else {
          fanShape.moveTo(innerR, 0);
          fanShape.lineTo(outerR, 0);
          fanShape.absarc(0, 0, outerR, 0, fanAngle, false);
          fanShape.lineTo(innerR * Math.cos(fanAngle), innerR * Math.sin(fanAngle));
          fanShape.absarc(0, 0, innerR, fanAngle, 0, true);
        }
        const curveSegs = 8;
        const geo = new THREE.ExtrudeGeometry(fanShape, {
          depth: height, bevelEnabled: false, curveSegments: curveSegs, UVGenerator: FACADE_UV_GEN,
        });
        const N = isAnnular ? 2 * curveSegs + 2 : curveSegs + 2;
        const sideMat1 = pick('side1');
        const outerMat = pick('outer');
        const sideMat2 = pick('side2');
        const innerMat = pick('inner');
        const perEdgeMats: THREE.Material[] = [];
        for (let i = 0; i < N; i++) {
          if (i === 0) perEdgeMats.push(sideMat1);
          else if (i <= curveSegs) perEdgeMats.push(outerMat);
          else if (i === curveSegs + 1) perEdgeMats.push(sideMat2);
          else perEdgeMats.push(innerMat);
        }
        const capMat = isTopFloor ? roofMat : floorMat;
        const materials = buildExtrudeMaterialsByEdge(geo, N, capMat, perEdgeMats);
        const mesh = new THREE.Mesh(geo, materials);
        mesh.rotation.x = -Math.PI / 2;
        group.add(mesh);
        break;
      }

      case 'polygon': {
        const sides = p.sides || 6;
        const circumR = p.circumradius || 20;
        const startAng = (p.startAngle || 0) * Math.PI / 180;
        const sideMat = pick('side');
        const geo = new THREE.CylinderGeometry(circumR, circumR, height, sides);
        const mesh = new THREE.Mesh(geo, [sideMat, isTopFloor ? roofMat : floorMat, floorMat]);
        mesh.position.y = height / 2;
        mesh.rotation.y = startAng;
        group.add(mesh);
        break;
      }

      case 'polyline': {
        const pts = p.points;
        if (pts && pts.length >= 3 && p.isClosed !== false) {
          console.log('[ThreeDViewer] Rendering polyline shape:', pts.length, 'points, extrudeHeight:', p.extrudeHeight || height);

          // Validate points are not degenerate (all same point)
          const hasArea = pts.some((pt: {x: number; y: number}, i: number) => {
            if (i === 0) return false;
            return Math.abs(pt.x - pts[0].x) > 0.01 || Math.abs(pt.y - pts[0].y) > 0.01;
          });

          if (!hasArea) {
            console.warn('[ThreeDViewer] Polyline has no area (degenerate), skipping');
            break;
          }

          const polyShape = new THREE.Shape();
          polyShape.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            polyShape.lineTo(pts[i].x, pts[i].y);
          }
          polyShape.closePath();

          const extH = p.extrudeHeight || height;
          const geo = new THREE.ExtrudeGeometry(polyShape, {
            depth: extH, bevelEnabled: false, UVGenerator: FACADE_UV_GEN,
          });
          const N = pts.length;
          const perEdgeMats = Array.from({ length: N }, (_, i) => pick(`edge-${i}`));
          const capMat = isTopFloor ? roofMat : floorMat;
          const materials = buildExtrudeMaterialsByEdge(geo, N, capMat, perEdgeMats);
          const mesh = new THREE.Mesh(geo, materials);
          mesh.rotation.x = -Math.PI / 2;
          group.add(mesh);
        } else {
          console.warn('[ThreeDViewer] Polyline NOT rendered: pts=', pts?.length, 'isClosed=', p.isClosed);
        }
        break;
      }

      default: {
        const geo = new THREE.BoxGeometry(30, height, 30);
        const mesh = new THREE.Mesh(geo, pick('side'));
        mesh.position.y = height / 2;
        group.add(mesh);
      }
    }

    return group;
  };

  // Create a floor slab
  const createFloorSlab = (width: number, depth: number, yPos: number, isSelected: boolean) => {
    const geo = new THREE.BoxGeometry(width + 1, 0.3, depth + 1);
    const mat = new THREE.MeshPhongMaterial({
      color: isSelected ? 0x3b82f6 : 0x64748b,
      transparent: true,
      opacity: isSelected ? 0.6 : 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = yPos;
    return mesh;
  };

  // Create the "+" add floor overlay on top
  const createAddFloorOverlay = (width: number, depth: number, yPos: number) => {
    // Transparent hover plane on top of building
    const geo = new THREE.PlaneGeometry(width + 6, depth + 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = yPos + 0.5;
    mesh.userData = { isAddFloorZone: true };
    return mesh;
  };

  // Create "+" sprite
  const createAddButtonSprite = (yPos: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Circle background
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Plus sign
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', 64, 60);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0 });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(0, yPos + 4, 0);
    sprite.scale.set(8, 8, 1);
    sprite.userData = { isAddFloorButton: true };
    return sprite;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const initScene = () => {
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
        setTimeout(initScene, 100);
        return;
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf1f5f9);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 2000);
      camera.position.set(100, 80, 100);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      rendererRef.current = renderer;
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 22, 0);
      // SketchUp-style mappings (overridden per-tool by an effect below):
      //   Left  = depends on tool (rotate when in pan/select; consumed by drawing otherwise)
      //   Middle = orbit (rotate)
      //   Right  = pan
      //   Wheel  = zoom
      //   Shift + Middle = pan (SketchUp convention; handled in handleMouseDown)
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      };
      // enableKeys was removed in three/OrbitControls r134+ — keyboard pan is
      // now always enabled when the controls have focus.
      controls.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };
      controls.keyPanSpeed = 12;
      controls.zoomSpeed = 1.2;
      controls.rotateSpeed = 0.9;
      controls.update();
      controlsRef.current = controls;

      if (showCompass) {
        scene.add(createCompass());
      }
      // Initial grid; replaced by the dynamic effect below to match snap gridSize.
      const initialGrid = new THREE.GridHelper(200, 200, 0xcbd5e1, 0xe2e8f0);
      gridHelperRef.current = initialGrid;
      scene.add(initialGrid);
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.position.set(50, 150, 50);
      scene.add(sun);

      const group = new THREE.Group();
      scene.add(group);
      objectsGroupRef.current = group;

      const previewGroup = new THREE.Group();
      scene.add(previewGroup);
      previewGroupRef.current = previewGroup;

      const snapDots = new THREE.Group();
      scene.add(snapDots);
      snapDotsGroupRef.current = snapDots;

      setSceneReady(true);

      // ===== Mouse interaction =====
      const getMouseNDC = (event: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      };

      let isHoveringRoof = false;
      const DRAG_THRESHOLD = 5; // pixels before drag starts

      const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return; // left click only
        // If user holds a navigation modifier (Alt/Shift/Cmd/Ctrl), let OrbitControls handle it.
        if (event.altKey || event.shiftKey || event.metaKey || event.ctrlKey) return;
        getMouseNDC(event);
        mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
        if (!cameraRef.current || !objectsGroupRef.current) return;

        // === Drawing tool path: when active, route to draw hook and skip legacy drag ===
        const dr = drawRef.current;
        if (dr.tool !== 'pan') {
          // Find hit shape — restricted to the active floor so other floors'
          // shapes don't get accidentally picked.
          raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
          const intersects = raycasterRef.current.intersectObjects(objectsGroupRef.current.children, true);
          const ds = dr.state as any;
          const stFloorId = (ds?.kind === 'move-selected' || ds?.kind === 'placing-move') ? ds.floorId : null;
          const activeFloorIdForHit = stFloorId ?? selectedFloorIdRef.current ?? null;
          let hitShapeId: string | undefined, hitFloorId: string | undefined;
          for (const hit of intersects) {
            let cur: THREE.Object3D | null = hit.object;
            let candidateShapeId: string | undefined;
            let candidateFloorId: string | undefined;
            while (cur) {
              if (cur.userData?.shapeId && cur.userData?.floorId) {
                candidateShapeId = cur.userData.shapeId;
                candidateFloorId = cur.userData.floorId;
                break;
              }
              cur = cur.parent;
            }
            if (!candidateShapeId) continue;
            if (activeFloorIdForHit && candidateFloorId !== activeFloorIdForHit) continue;
            hitShapeId = candidateShapeId;
            hitFloorId = candidateFloorId;
            break;
          }
          const dom = rendererRef.current?.domElement;
          const cam = cameraRef.current;
          // Move tool always uses the floor-plane projection (raw, no grid snap)
          // so the world coord reflects the LATEST floor data — independent of
          // the 3D mesh which may be one frame stale right after a commit.
          let world = (dom && cam)
            ? (dr.tool === 'move' ? groundRef.current.projectRaw(event, dom, cam) : groundRef.current.project(event, dom, cam))
            : null;
          // Vertex snap by 2D plane distance — same logic as mousemove.
          if (dr.tool === 'move' && world) {
            const ds = dr.state as any;
            const stShapeId = (ds?.kind === 'move-selected' || ds?.kind === 'placing-move') ? ds.shapeId : null;
            const stFloorId = (ds?.kind === 'move-selected' || ds?.kind === 'placing-move') ? ds.floorId : null;
            const isPlacing = ds?.kind === 'placing-move';
            const isPicking = ds?.kind === 'move-selected';
            const liveFloors = floorsRef.current;
            const liveSelected = selectedFloorIdRef.current;
            const targetFloorId = stFloorId ?? liveSelected ?? null;
            const targetFloor = liveFloors?.find(f => f.id === targetFloorId);
            if (targetFloor) {
              const candidates = targetFloor.shapes.filter(sh => {
                if (isPicking) return sh.id === stShapeId;
                if (isPlacing) return sh.id !== stShapeId;
                return true;
              });
              const SNAP_M = snapRadius(gridSize);
              let bestVertex: { x: number; z: number } | null = null;
              let bestVertexDist = SNAP_M;
              for (const sh of candidates) {
                for (const a of shapeAnchors(sh)) {
                  const d = Math.hypot(a.x - world.x, a.y - world.z);
                  if (d < bestVertexDist) { bestVertexDist = d; bestVertex = { x: a.x, z: a.y }; }
                }
              }
              let bestGrid: { x: number; z: number } | null = null;
              let bestGridDist = Infinity;
              if (snapToGrid) {
                const gx = Math.round(world.x / gridSize) * gridSize;
                const gz = Math.round(world.z / gridSize) * gridSize;
                bestGrid = { x: gx, z: gz };
                bestGridDist = Math.hypot(gx - world.x, gz - world.z);
              }
              if (bestVertex && bestGrid) {
                world = bestVertexDist <= bestGridDist ? bestVertex : bestGrid;
              } else if (bestVertex) world = bestVertex;
              else if (bestGrid) world = bestGrid;
            }
          }
          dr.handlePointerDown(world, event as PointerEvent, hitShapeId, hitFloorId);
          return;
        }

        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(objectsGroupRef.current.children, true);

        for (const hit of intersects) {
          // Skip add-floor zone
          if (hit.object.userData?.isAddFloorZone || hit.object.userData?.isAddFloorButton) continue;

          // Find shape data in hierarchy
          let current: THREE.Object3D | null = hit.object;
          while (current) {
            if (current.userData?.shapeId && current.userData?.floorId) {
              const floorId = current.userData.floorId;
              const shapeId = current.userData.shapeId;

              // In edit mode, only allow drag on the editing floor
              if (editingFloorIdRef.current && floorId !== editingFloorIdRef.current) {
                break; // Skip shapes not on editing floor
              }
              // In view mode (no editingFloorId), don't allow drag at all
              if (!editingFloorIdRef.current) {
                break;
              }

              // Found a shape on the editing floor - prepare for potential drag
              const hitPoint = hit.point.clone();
              dragPlaneRef.current.set(new THREE.Vector3(0, 1, 0), -hitPoint.y);
              dragStartWorldRef.current.copy(hitPoint);

              let origX = 0, origZ = 0;
              const floorsData = onMoveShapeRef.current ? floors : undefined;
              if (floorsData) {
                const floor = floorsData.find(f => f.id === floorId);
                const shape = floor?.shapes.find(s => s.id === shapeId);
                if (shape) {
                  origX = shape.position.x;
                  origZ = shape.position.y;
                }
              }

              dragShapeRef.current = {
                floorId,
                shapeId,
                startX: hitPoint.x,
                startZ: hitPoint.z,
                origX,
                origZ,
              };
              return;
            }
            current = current.parent;
          }
        }
      };

      const handleMouseMove = (event: MouseEvent) => {
        getMouseNDC(event);
        if (!cameraRef.current || !objectsGroupRef.current) return;

        // === Drawing tool path: update cursor + forward to draw hook ===
        const dom = rendererRef.current?.domElement;
        const cam = cameraRef.current;
        const dr = drawRef.current;
        const useRaw = dr.tool === 'move';
        let world = (dom && cam)
          ? (useRaw ? groundRef.current.projectRaw(event, dom, cam) : groundRef.current.project(event, dom, cam))
          : null;
        // Move tool: vertex snap by 2D distance on the active-floor plane.
        // (Screen-pixel snap removed — plane-projection is more deterministic
        // and recomputes naturally each render from latest floors.)
        let nextSnapKind: 'none' | 'vertex' | 'edge' | 'grid' = 'none';
        if (useRaw && world) {
          const ds = dr.state as any;
          const stShapeId = (ds?.kind === 'move-selected' || ds?.kind === 'placing-move') ? ds.shapeId : null;
          const stFloorId = (ds?.kind === 'move-selected' || ds?.kind === 'placing-move') ? ds.floorId : null;
          const isPlacing = ds?.kind === 'placing-move';
          const isPicking = ds?.kind === 'move-selected';
          const liveFloors = floorsRef.current;
          const liveSelected = selectedFloorIdRef.current;
          const targetFloorId = stFloorId ?? liveSelected ?? null;
          const targetFloor = liveFloors?.find(f => f.id === targetFloorId);
          if (targetFloor) {
            const candidates = targetFloor.shapes.filter(sh => {
              if (isPicking) return sh.id === stShapeId;
              if (isPlacing) return sh.id !== stShapeId;
              return true;
            });
            const SNAP_M = snapRadius(gridSize);
            // Vertex candidate
            let bestVertex: { x: number; z: number } | null = null;
            let bestVertexDist = SNAP_M;
            for (const sh of candidates) {
              for (const a of shapeAnchors(sh)) {
                const d = Math.hypot(a.x - world.x, a.y - world.z);
                if (d < bestVertexDist) { bestVertexDist = d; bestVertex = { x: a.x, z: a.y }; }
              }
            }
            // Grid candidate
            let bestGrid: { x: number; z: number } | null = null;
            let bestGridDist = Infinity;
            if (snapToGrid) {
              const gx = Math.round(world.x / gridSize) * gridSize;
              const gz = Math.round(world.z / gridSize) * gridSize;
              bestGrid = { x: gx, z: gz };
              bestGridDist = Math.hypot(gx - world.x, gz - world.z);
            }
            // Pick whichever is closer to cursor
            if (bestVertex && bestGrid) {
              if (bestVertexDist <= bestGridDist) { world = bestVertex; nextSnapKind = 'vertex'; }
              else { world = bestGrid; nextSnapKind = 'grid'; }
            } else if (bestVertex) {
              world = bestVertex; nextSnapKind = 'vertex';
            } else if (bestGrid) {
              world = bestGrid; nextSnapKind = 'grid';
            }
          }
        }
        if (nextSnapKind !== snapKindRef.current) {
          snapKindRef.current = nextSnapKind;
          setSnapKind(nextSnapKind);
        }
        setCursor(world);
        if (dr.tool !== 'pan') {
          dr.handlePointerMove(world);
          return;
        }

        // === Drag logic ===
        if (dragShapeRef.current && !isDraggingRef.current) {
          // Check if mouse moved enough to start drag
          const dx = event.clientX - mouseDownPosRef.current.x;
          const dy = event.clientY - mouseDownPosRef.current.y;
          if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
            isDraggingRef.current = true;
            // Disable orbit controls during drag
            if (controlsRef.current) controlsRef.current.enabled = false;
            container.style.cursor = 'grabbing';

            // Select the shape being dragged
            onSelectFloorRef.current?.(dragShapeRef.current.floorId);
            onSelectShapeRef.current?.(dragShapeRef.current.shapeId);
          }
        }

        if (isDraggingRef.current && dragShapeRef.current) {
          // Project mouse onto drag plane
          raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
          if (raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, dragIntersectRef.current)) {
            const deltaX = dragIntersectRef.current.x - dragShapeRef.current.startX;
            const deltaZ = dragIntersectRef.current.z - dragShapeRef.current.startZ;

            const newX = Math.round((dragShapeRef.current.origX + deltaX) * 10) / 10;
            const newY = Math.round((dragShapeRef.current.origZ + deltaZ) * 10) / 10; // z in 3D → y in FloorShape

            onMoveShapeRef.current?.(
              dragShapeRef.current.floorId,
              dragShapeRef.current.shapeId,
              newX,
              newY
            );
          }
          return; // Don't process hover logic during drag
        }

        // === Normal hover logic ===
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(objectsGroupRef.current.children, true);

        let hoveringAdd = false;

        for (const hit of intersects) {
          const obj = hit.object;
          if (obj.userData?.isAddFloorZone || obj.userData?.isAddFloorButton) {
            hoveringAdd = true;
            break;
          }
        }

        if (hoveringAdd && !isHoveringRoof) {
          isHoveringRoof = true;
          container.style.cursor = 'pointer';
          if (hoverOverlayRef.current) {
            (hoverOverlayRef.current.material as THREE.MeshBasicMaterial).opacity = 0.15;
          }
          if (addButtonSpriteRef.current) {
            (addButtonSpriteRef.current.material as THREE.SpriteMaterial).opacity = 1;
          }
          if (tooltipRef.current) {
            tooltipRef.current.style.opacity = '1';
            tooltipRef.current.style.left = `${event.clientX - container.getBoundingClientRect().left}px`;
            tooltipRef.current.style.top = `${event.clientY - container.getBoundingClientRect().top - 40}px`;
          }
        } else if (!hoveringAdd && isHoveringRoof) {
          isHoveringRoof = false;
          container.style.cursor = 'default';
          if (hoverOverlayRef.current) {
            (hoverOverlayRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
          }
          if (addButtonSpriteRef.current) {
            (addButtonSpriteRef.current.material as THREE.SpriteMaterial).opacity = 0;
          }
          if (tooltipRef.current) {
            tooltipRef.current.style.opacity = '0';
          }
        }

        if (isHoveringRoof && tooltipRef.current) {
          tooltipRef.current.style.left = `${event.clientX - container.getBoundingClientRect().left}px`;
          tooltipRef.current.style.top = `${event.clientY - container.getBoundingClientRect().top - 40}px`;
        }

        // Check for floor/shape hover for cursor
        if (!hoveringAdd) {
          let foundShape = false;
          let foundClickable = false;
          for (const hit of intersects) {
            let current: THREE.Object3D | null = hit.object;
            while (current) {
              if (current.userData?.shapeId && current.userData?.floorId) {
                // Only show grab cursor for shapes on the editing floor
                if (editingFloorIdRef.current && current.userData.floorId === editingFloorIdRef.current) {
                  foundShape = true;
                }
                foundClickable = true;
                break;
              }
              if (current.userData?.floorId) {
                foundClickable = true;
                break;
              }
              current = current.parent;
            }
            if (foundClickable) break;
          }
          container.style.cursor = foundShape ? 'grab' : (foundClickable ? 'pointer' : 'default');
        }
      };

      const handleMouseUp = (event: MouseEvent) => {
        const dr = drawRef.current;
        if (dr.tool !== 'pan') {
          const dom = rendererRef.current?.domElement;
          const cam = cameraRef.current;
          const world = (dom && cam) ? groundRef.current.project(event, dom, cam) : null;
          dr.handlePointerUp(world, event as PointerEvent);
          return;
        }

        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          container.style.cursor = 'default';
          // Re-enable orbit controls
          if (controlsRef.current) controlsRef.current.enabled = true;
        } else {
          // Only treat as click if mouse didn't move much (not an orbit rotation)
          const dx = event.clientX - mouseDownPosRef.current.x;
          const dy = event.clientY - mouseDownPosRef.current.y;
          if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) {
            handleClickLogic(event);
          }
        }
        dragShapeRef.current = null;
      };

      const handleClickLogic = (event: MouseEvent) => {
        getMouseNDC(event);
        if (!cameraRef.current || !objectsGroupRef.current) return;

        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(objectsGroupRef.current.children, true);

        for (const hit of intersects) {
          const obj = hit.object;

          // Add floor button (only in view mode)
          if (!editingFloorIdRef.current && (obj.userData?.isAddFloorZone || obj.userData?.isAddFloorButton)) {
            onAddFloorRef.current?.();
            return;
          }

          let current: THREE.Object3D | null = obj;
          while (current) {
            if (current.userData?.shapeId && current.userData?.floorId) {
              const clickedFloorId = current.userData.floorId;

              if (editingFloorIdRef.current) {
                // In edit mode: only select shapes on the editing floor
                if (clickedFloorId === editingFloorIdRef.current) {
                  onSelectShapeRef.current?.(current.userData.shapeId);
                  onSelectFloorRef.current?.(clickedFloorId);
                }
              } else {
                // In view mode: click enters edit mode for that floor
                onSelectFloorRef.current?.(clickedFloorId);
                onSelectShapeRef.current?.(current.userData.shapeId);
                onEnterEditModeRef.current?.(clickedFloorId);
              }
              return;
            }
            if (current.userData?.floorId) {
              const clickedFloorId = current.userData.floorId;
              if (editingFloorIdRef.current) {
                // In edit mode: ignore clicks on non-editing floors
                if (clickedFloorId !== editingFloorIdRef.current) break;
              } else {
                // In view mode: click enters edit mode
                onSelectFloorRef.current?.(clickedFloorId);
                onEnterEditModeRef.current?.(clickedFloorId);
              }
              return;
            }
            current = current.parent;
          }
        }

        // Clicked on empty space in edit mode → exit edit mode
        if (editingFloorIdRef.current) {
          // Don't exit on empty click, user must click the exit button
        }
      };

      renderer.domElement.addEventListener('mousedown', handleMouseDown);
      renderer.domElement.addEventListener('mousemove', handleMouseMove);
      renderer.domElement.addEventListener('mouseup', handleMouseUp);
      // Prevent right-click browser menu (right-click is used for pan)
      renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

      // Modifier-key navigation overrides (works with any tool, also for trackpad users):
      //   Alt + LMB drag  = orbit
      //   Shift + LMB drag = pan
      //   Shift + MMB drag = pan (SketchUp convention)
      //   Cmd/Ctrl + drag = zoom (dolly)
      // We swap mouseButtons mappings at pointerdown and restore at pointerup.
      let savedMouseButtons: any = null;
      const swapButtons = (mapping: any) => {
        if (!controlsRef.current) return;
        if (!savedMouseButtons) savedMouseButtons = { ...controlsRef.current.mouseButtons };
        controlsRef.current.mouseButtons = mapping;
      };
      const restoreButtons = () => {
        if (controlsRef.current && savedMouseButtons) {
          controlsRef.current.mouseButtons = savedMouseButtons;
          savedMouseButtons = null;
        }
      };
      renderer.domElement.addEventListener('pointerdown', (e) => {
        if (e.button === 0 && (e.altKey || e.shiftKey || e.metaKey || e.ctrlKey)) {
          // Force LEFT to navigation mode for this drag
          const action = e.altKey ? THREE.MOUSE.ROTATE
            : e.shiftKey ? THREE.MOUSE.PAN
            : THREE.MOUSE.DOLLY; // metaKey/ctrlKey
          swapButtons({ LEFT: action, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN });
          return;
        }
        if (e.button === 1 && e.shiftKey) {
          swapButtons({ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN });
        }
      }, true);
      window.addEventListener('pointerup', restoreButtons);
      window.addEventListener('pointercancel', restoreButtons);

      const animate = () => {
        requestAnimationFrame(animate);
        if (controlsRef.current) controlsRef.current.update();
        if (rendererRef.current && sceneRef.current && cameraRef.current) rendererRef.current.render(sceneRef.current, cameraRef.current);
      };
      animate();

      const handleResize = () => {
        if (!container || !rendererRef.current || !cameraRef.current) return;
        cameraRef.current.aspect = container.clientWidth / container.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener('resize', handleResize);
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
      };
    };

    const timer = setTimeout(initScene, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', () => { });
      if (rendererRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement);
        } catch (e) { }
        rendererRef.current.dispose();
      }
    };
  }, [showCompass]);

  const [sceneReady, setSceneReady] = React.useState(false);

  // Saved perspective state used by both the manual top-view toggle and the 📐 request handler
  const savedCameraRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  // External request (from FloorManagerPanel 📐) → switch to top-view edit.
  // The lock-effect below handles save+set/restore on state change. Here we
  // only need to re-center the camera if already locked (no save touched).
  useEffect(() => {
    if (topViewRequestSeq == null) return;
    if (topViewRequestSeq === 0) return;
    topViewWasUserToggledRef.current = true;
    if (topViewLocked) {
      const cam = cameraRef.current;
      const ctrl = controlsRef.current;
      if (cam && ctrl) {
        const t = ctrl.target.clone();
        cam.position.set(t.x, 200, t.z);
        ctrl.target.set(t.x, 0, t.z);
        cam.up.set(0, 0, -1);
        ctrl.enableRotate = false;
        ctrl.update();
      }
    } else {
      setTopViewLocked(true); // lock-effect will save current perspective + apply top view
    }
    draw.setTool('select');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topViewRequestSeq]);

  // Auto-lock top-view when polyline tool is active (custom outline tool needs
  // a plan view + grid snap dots for accurate point input). Restore previous
  // camera state when leaving the tool, unless the user has manually toggled.
  useEffect(() => {
    if (draw.tool === 'polyline') {
      if (!topViewLocked) {
        topViewWasUserToggledRef.current = false;
        setTopViewLocked(true);
      }
    } else {
      // If we auto-locked (not user-toggled), restore on tool exit
      if (topViewLocked && !topViewWasUserToggledRef.current) {
        setTopViewLocked(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw.tool]);

  // Render visible snap-grid dots whenever snap is enabled (any view).
  useEffect(() => {
    const group = snapDotsGroupRef.current;
    if (!group) return;
    while (group.children.length) {
      const c = group.children[0];
      group.remove(c);
      (c as any).geometry?.dispose?.();
      (c as any).material?.dispose?.();
    }
    // Re-create the ground GridHelper at the current snap gridSize so visible
    // grid intersections always coincide with the snap dots.
    const scene = sceneRef.current;
    if (scene && gridHelperRef.current) {
      scene.remove(gridHelperRef.current);
      (gridHelperRef.current as any).geometry?.dispose?.();
      (gridHelperRef.current as any).material?.dispose?.();
      gridHelperRef.current = null;
    }
    if (scene) {
      const span = 200;
      const divisions = Math.max(1, Math.round(span / gridSize));
      const grid = new THREE.GridHelper(span, divisions, 0xcbd5e1, 0xe2e8f0);
      grid.position.y = activeFloorBaseY;
      gridHelperRef.current = grid;
      scene.add(grid);
    }

    if (!snapToGrid) return;

    const ctrl = controlsRef.current;
    const center = ctrl ? ctrl.target : new THREE.Vector3(0, 0, 0);
    const half = 60; // ±60m around target = 120m grid
    // Dot radius scales with grid spacing so it fits inside one cell, never too big or invisible.
    const dotR = Math.min(0.5, Math.max(0.08, gridSize * 0.18));
    const dotGeo = new THREE.CircleGeometry(dotR, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa, transparent: true, opacity: 0.75,
      depthTest: false, depthWrite: false,
    });
    const merged = new THREE.InstancedMesh(
      dotGeo,
      dotMat,
      Math.pow((Math.floor(half * 2 / gridSize) + 1), 2)
    );
    let i = 0;
    const tmp = new THREE.Object3D();
    const baseX = Math.round(center.x / gridSize) * gridSize;
    const baseZ = Math.round(center.z / gridSize) * gridSize;
    for (let dx = -half; dx <= half; dx += gridSize) {
      for (let dz = -half; dz <= half; dz += gridSize) {
        // CircleGeometry is in XY plane; rotate each instance to lie flat on XZ.
        tmp.position.set(baseX + dx, activeFloorBaseY + 0.06, baseZ + dz);
        tmp.rotation.set(-Math.PI / 2, 0, 0);
        tmp.updateMatrix();
        merged.setMatrixAt(i++, tmp.matrix);
      }
    }
    merged.count = i;
    merged.instanceMatrix.needsUpdate = true;
    merged.renderOrder = 998;
    group.add(merged);
  }, [snapToGrid, topViewLocked, gridSize, activeFloorBaseY]);

  // Anchor markers: small green dots at every shape's vertices + edge midpoints
  // when the Move tool is active. Helps the user see exactly where they can grip
  // and where the dragged shape can snap to.
  const anchorMarkersRef = useRef<THREE.Group | null>(null);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (!anchorMarkersRef.current) {
      const grp = new THREE.Group();
      scene.add(grp);
      anchorMarkersRef.current = grp;
    }
    const grp = anchorMarkersRef.current;
    while (grp.children.length) {
      const c = grp.children[0];
      grp.remove(c);
      (c as any).geometry?.dispose?.();
      (c as any).material?.dispose?.();
    }
    if (draw.tool !== 'move') return;
    if (!floors) return;
    const stateKind = draw.state.kind;
    const inSelectedPhase = stateKind === 'move-selected';
    const inPlacingPhase = stateKind === 'placing-move';
    const stShapeId = (inSelectedPhase || inPlacingPhase) ? (draw.state as any).shapeId : null;
    const stFloorId = (inSelectedPhase || inPlacingPhase) ? (draw.state as any).floorId : null;
    const activeFl = floors.find(f => f.id === (stFloorId ?? selectedFloorId));
    if (!activeFl) return;
    const ringGeo = new THREE.RingGeometry(0.3, 0.45, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e, transparent: true, opacity: 0.95,
      side: THREE.DoubleSide, depthTest: false, depthWrite: false,
    });
    const tmp = new THREE.Object3D();
    // Phase-aware anchor display:
    //   move-selected: highlight ONLY the selected shape's anchors (user picks grip)
    //   placing-move:   show anchors of OTHER shapes (snap targets)
    //   idle:            show all shapes' anchors (preview)
    const shapesToShow = inSelectedPhase
      ? activeFl.shapes.filter(sh => sh.id === stShapeId)
      : activeFl.shapes.filter(sh => !inPlacingPhase || sh.id !== stShapeId);
    for (const sh of shapesToShow) {
      const anchors = shapeAnchors(sh);
      for (const a of anchors) {
        const m = new THREE.Mesh(ringGeo, ringMat);
        tmp.position.set(a.x, activeFloorBaseY + 0.08, a.y);
        tmp.rotation.set(-Math.PI / 2, 0, 0);
        tmp.updateMatrix();
        m.matrix.copy(tmp.matrix);
        m.matrixAutoUpdate = false;
        m.renderOrder = 999;
        grp.add(m);
      }
    }
  }, [draw.tool, draw.state, floors, selectedFloorId, sceneReady]);

  // Snap indicator: a conspicuous ring + cross on the ground at the snapped
  // grid intersection — proves visually that the cursor is locked to grid.
  const cursorMarkerRef = useRef<THREE.Group | null>(null);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (!cursorMarkerRef.current) {
      const grp = new THREE.Group();
      // Filled disk that overlays the snap dot exactly when on grid.
      const disk = new THREE.Mesh(
        new THREE.CircleGeometry(1, 24),
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 1.0, side: THREE.DoubleSide, depthTest: false })
      );
      disk.rotation.x = -Math.PI / 2;
      disk.renderOrder = 1001; // above snap dots (998) and grid lines
      grp.add(disk);
      grp.visible = false;
      scene.add(grp);
      cursorMarkerRef.current = grp;
    }
    // Match the snap-dot radius so the marker overlays it 1:1 when aligned.
    const diskMesh = cursorMarkerRef.current.children[0] as THREE.Mesh;
    const dotR = Math.min(0.5, Math.max(0.08, gridSize * 0.18));
    diskMesh.scale.setScalar(dotR);
    const grp = cursorMarkerRef.current;
    if (!cursor || !snapToGrid || draw.tool === 'pan') {
      grp.visible = false;
      return;
    }
    // Use the drawing-tool's authoritative cursor (which has already been
    // snapped to grid / existing polyline points) so the visible marker matches
    // exactly where the next click will land. Falls back to the local cursor
    // when there's no in-progress placing.
    const drawCursor = (draw.state as any)?.cursor as { x: number; z: number } | undefined;
    const baseCursor = drawCursor ?? cursor;

    // Snap only against shapes on the active floor.
    let snapTarget: { x: number; z: number } | null = null;
    let bestDist = SNAP_THRESHOLD_M_MOVE;
    const draggedId = (draw.state as any)?.kind === 'placing-move' ? (draw.state as any).shapeId : null;
    const draggedFloorId = (draw.state as any)?.kind === 'placing-move' ? (draw.state as any).floorId : null;
    const activeFl = floors?.find(f => f.id === (draggedFloorId ?? selectedFloorId));
    if (activeFl) {
      for (const sh of activeFl.shapes) {
        if (sh.id === draggedId) continue;
        for (const a of shapeAnchors(sh)) {
          const d = Math.hypot(a.x - baseCursor.x, a.y - baseCursor.z);
          if (d < bestDist) { bestDist = d; snapTarget = { x: a.x, z: a.y }; }
        }
      }
    }
    grp.visible = true;
    const pos = snapTarget ?? baseCursor;
    grp.position.set(pos.x, activeFloorBaseY + 0.06, pos.z);
    // Color by snap kind: green = vertex, blue = edge, yellow = grid only.
    const color =
      snapKind === 'vertex' ? 0x22c55e :
      snapKind === 'edge'   ? 0x3b82f6 :
      snapKind === 'grid'   ? 0xfbbf24 :
      snapTarget            ? 0x22c55e : // legacy anchor snap (non-move tools)
      0xfbbf24;
    grp.traverse((c) => {
      const m = (c as any).material;
      if (m && 'color' in m) m.color.setHex(color);
    });
  }, [cursor, snapToGrid, gridSize, draw.tool, draw.state, sceneReady, floors, selectedFloorId, activeFloorBaseY, snapKind]);

  // Lock top-view: snap camera to top-down and disable rotation. Restore when unlocked.
  useEffect(() => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    if (topViewLocked) {
      savedCameraRef.current = {
        pos: cam.position.clone(),
        target: ctrl.target.clone(),
      };
      const t = ctrl.target.clone();
      cam.position.set(t.x, 200, t.z);
      ctrl.target.set(t.x, 0, t.z);
      ctrl.enableRotate = false;
      cam.up.set(0, 0, -1);
      ctrl.update();
    } else if (savedCameraRef.current) {
      cam.position.copy(savedCameraRef.current.pos);
      ctrl.target.copy(savedCameraRef.current.target);
      ctrl.enableRotate = true;
      cam.up.set(0, 1, 0);
      ctrl.update();
      savedCameraRef.current = null;
    }
  }, [topViewLocked]);

  // Camera controls remain enabled across tools — only the LEFT button is
  // remapped: in pan tool it orbits, otherwise it's reserved for drawing/select.
  // MIDDLE always orbits, RIGHT always pans, wheel always zooms.
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (ctrl) {
      ctrl.enabled = true;
      ctrl.mouseButtons = {
        LEFT: draw.tool === 'pan' ? THREE.MOUSE.ROTATE : null,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      } as any;
    }
    const dom = rendererRef.current?.domElement;
    if (dom) {
      dom.style.cursor =
        draw.tool === 'pan' ? '' :
        (draw.tool === 'select' || draw.tool === 'delete') ? 'pointer' :
        (draw.tool === 'move') ? 'move' :
        (draw.tool === 'rotate') ? 'crosshair' :
        'crosshair';
    }
  }, [draw.tool]);

  // Refs so the keydown listener (mounted once) always sees the latest callbacks
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  onUndoRef.current = onUndo;
  onRedoRef.current = onRedo;

  // Phase hint banner for the 3-step move flow
  const movePhaseHint = useMemo(() => {
    if (draw.tool !== 'move') return null;
    if (draw.state.kind === 'idle') return lang === 'zh' ? '步驟 1：點選要移動的形狀' : 'Step 1: Click a shape to move';
    if (draw.state.kind === 'move-selected') return lang === 'zh' ? '步驟 2：點選夾持點 (頂點/邊中點)' : 'Step 2: Click a vertex/midpoint as the grip';
    if (draw.state.kind === 'placing-move') return lang === 'zh' ? '步驟 3：點選其他形狀的頂點對齊' : 'Step 3: Click another shape\'s vertex to align';
    return null;
  }, [draw.tool, draw.state.kind, lang]);

  // Window keydown for ESC / Enter / Delete / Cmd-Z
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't intercept when typing in inputs / dialogs
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedoRef.current?.();
        else onUndoRef.current?.();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedoRef.current?.();
        return;
      }

      drawRef.current.handleKeyDown(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Render preview mesh based on drawing state
  useEffect(() => {
    const group = previewGroupRef.current;
    if (!group) return;
    while (group.children.length) {
      const c = group.children[0];
      group.remove(c);
      if ((c as any).geometry) (c as any).geometry.dispose?.();
      if ((c as any).material) {
        const mats = Array.isArray((c as any).material) ? (c as any).material : [(c as any).material];
        mats.forEach((m: any) => m.dispose?.());
      }
    }
    const s = draw.state;
    if (s.kind !== 'placing') return;

    // Always-on-top materials so preview is visible above existing buildings in top-view.
    const PREVIEW_MAT = new THREE.MeshBasicMaterial({
      color: 0x3b82f6, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
      depthTest: false, depthWrite: false,
    });
    const PREVIEW_LINE_MAT = new THREE.LineBasicMaterial({
      color: 0x3b82f6, transparent: true, opacity: 1.0, depthTest: false,
    });
    const PREVIEW_DASH_MAT = new THREE.LineDashedMaterial({
      color: 0x3b82f6, dashSize: 0.5, gapSize: 0.3, transparent: true, depthTest: false,
    });
    const PREVIEW_DOT_MAT = new THREE.MeshBasicMaterial({
      color: 0x3b82f6, depthTest: false,
    });
    const RENDER_ON_TOP = 1000;

    if (s.tool === 'box' && s.points.length === 1) {
      const a = s.points[0], c = s.cursor;
      const w = Math.abs(c.x - a.x), l = Math.abs(c.z - a.z);
      if (w < 0.01 || l < 0.01) return;
      const geo = new THREE.PlaneGeometry(w, l);
      const mesh = new THREE.Mesh(geo, PREVIEW_MAT);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((a.x + c.x) / 2, 0.05, (a.z + c.z) / 2);
      mesh.renderOrder = RENDER_ON_TOP;
      group.add(mesh);
      return;
    }
    // L / T multi-vertex polyline-style preview
    if ((s.tool === 'lShape' || s.tool === 'tShape') && s.points.length >= 1) {
      const Y = activeFloorBaseY + 0.05;
      const positions: number[] = [];
      for (const p of s.points) positions.push(p.x, Y, p.z);
      positions.push(s.cursor.x, Y, s.cursor.z);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const line = new THREE.Line(geo, PREVIEW_LINE_MAT);
      line.renderOrder = RENDER_ON_TOP;
      group.add(line);
      // Closing hint line back to first
      if (s.points.length >= 2) {
        const closePos = [s.cursor.x, Y, s.cursor.z, s.points[0].x, Y, s.points[0].z];
        const cgeo = new THREE.BufferGeometry();
        cgeo.setAttribute('position', new THREE.Float32BufferAttribute(closePos, 3));
        const cline = new THREE.Line(cgeo, PREVIEW_DASH_MAT);
        cline.computeLineDistances();
        cline.renderOrder = RENDER_ON_TOP;
        group.add(cline);
      }
      // Dots at placed vertices
      for (const p of s.points) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), PREVIEW_DOT_MAT);
        dot.position.set(p.x, Y, p.z);
        dot.renderOrder = RENDER_ON_TOP;
        group.add(dot);
      }
      return;
    }

    if ((s.tool === 'cylinder' || s.tool === 'polygon') && s.points.length === 1) {
      const c = s.points[0], r = s.cursor;
      const radius = Math.hypot(r.x - c.x, r.z - c.z);
      if (radius < 0.01) return;
      const segments = s.tool === 'cylinder' ? 32 : 6;
      const geo = new THREE.CircleGeometry(radius, segments);
      const mesh = new THREE.Mesh(geo, PREVIEW_MAT);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(c.x, 0.05, c.z);
      mesh.renderOrder = RENDER_ON_TOP;
      group.add(mesh);
      return;
    }

    if ((s.tool === 'arc' || s.tool === 'fan') && s.points.length >= 1) {
      const c = s.points[0];
      if (s.points.length === 1) {
        const r = Math.hypot(s.cursor.x - c.x, s.cursor.z - c.z);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(Math.max(r - 0.05, 0), r, 64),
          PREVIEW_MAT
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(c.x, 0.05, c.z);
        ring.renderOrder = RENDER_ON_TOP;
        group.add(ring);
      } else {
        const p0 = s.points[1];
        const radius = Math.hypot(p0.x - c.x, p0.z - c.z);
        const a0 = Math.atan2(p0.z - c.z, p0.x - c.x);
        const a1 = Math.atan2(s.cursor.z - c.z, s.cursor.x - c.x);
        let theta = a1 - a0;
        if (theta < 0) theta += Math.PI * 2;
        const inner = s.tool === 'fan' ? 0 : Math.max(radius - 0.5, 0);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(inner, radius, 64, 1, a0, theta),
          PREVIEW_MAT
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(c.x, 0.05, c.z);
        ring.renderOrder = RENDER_ON_TOP;
        group.add(ring);
      }
      return;
    }

    if (s.tool === 'ellipse' && s.points.length >= 1) {
      const c = s.points[0];
      if (s.points.length === 1) {
        const positions = [c.x, 0.05, c.z, s.cursor.x, 0.05, s.cursor.z];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const line = new THREE.Line(geo, PREVIEW_LINE_MAT);
        line.renderOrder = RENDER_ON_TOP;
        group.add(line);
      } else {
        const p0 = s.points[1];
        const major = Math.hypot(p0.x - c.x, p0.z - c.z);
        const dx = p0.x - c.x, dz = p0.z - c.z;
        const len = Math.hypot(dx, dz) || 1;
        const px = -dz / len, pz = dx / len;
        const minor = Math.abs((s.cursor.x - c.x) * px + (s.cursor.z - c.z) * pz);
        if (major < 0.01 || minor < 0.01) return;
        const shape = new THREE.Shape();
        shape.absellipse(0, 0, major, minor, 0, Math.PI * 2, false, 0);
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 64), PREVIEW_MAT);
        mesh.rotation.x = -Math.PI / 2;
        const angle = Math.atan2(dz, dx);
        mesh.rotation.z = -angle;
        mesh.position.set(c.x, 0.05, c.z);
        mesh.renderOrder = RENDER_ON_TOP;
        group.add(mesh);
      }
      return;
    }

    if (s.tool === 'polyline' && s.points.length >= 1) {
      // Keep preview at ground level (y≈0) to avoid parallax mismatch between
      // where the user clicks (raycast hits y=0) and where the rendered dot
      // appears on screen. depthTest:false ensures it's still visible above buildings.
      // Render preview at the active floor's plane so points/lines visually
      // align with the snap dots (which are also at activeFloorBaseY+0.06).
      const Y = activeFloorBaseY + 0.05;
      const positions: number[] = [];
      for (const p of s.points) positions.push(p.x, Y, p.z);
      positions.push(s.cursor.x, Y, s.cursor.z);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const line = new THREE.Line(geo, PREVIEW_LINE_MAT);
      line.renderOrder = RENDER_ON_TOP;
      group.add(line);

      if (s.points.length >= 2) {
        const closePos = [s.cursor.x, Y, s.cursor.z, s.points[0].x, Y, s.points[0].z];
        const cgeo = new THREE.BufferGeometry();
        cgeo.setAttribute('position', new THREE.Float32BufferAttribute(closePos, 3));
        const cline = new THREE.Line(cgeo, PREVIEW_DASH_MAT);
        cline.computeLineDistances();
        cline.renderOrder = RENDER_ON_TOP;
        group.add(cline);
      }

      for (const p of s.points) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 12, 12),
          PREVIEW_DOT_MAT
        );
        dot.position.set(p.x, Y, p.z);
        dot.renderOrder = RENDER_ON_TOP;
        group.add(dot);
      }
    }
  }, [draw.state, activeFloorBaseY]);

  // HUD hint string while drawing
  const drawHint = useMemo(() => {
    const s = draw.state;
    if (s.kind !== 'placing') return null;
    if (s.tool === 'box' && s.points.length === 1) {
      const a = s.points[0], c = s.cursor;
      return `${Math.abs(c.x - a.x).toFixed(2)} × ${Math.abs(c.z - a.z).toFixed(2)} m`;
    }
    if (s.tool === 'lShape') return `L 形 · ${s.points.length}/6 點`;
    if (s.tool === 'tShape') return `T 形 · ${s.points.length}/8 點`;
    if ((s.tool === 'cylinder' || s.tool === 'polygon') && s.points.length === 1) {
      const a = s.points[0], c = s.cursor;
      return `R = ${Math.hypot(c.x - a.x, c.z - a.z).toFixed(2)} m`;
    }
    if ((s.tool === 'arc' || s.tool === 'fan' || s.tool === 'ellipse') && s.points.length >= 1) {
      const a = s.points[0], c = s.cursor;
      return `R = ${Math.hypot(c.x - a.x, c.z - a.z).toFixed(2)} m, ${s.points.length}/3`;
    }
    if (s.tool === 'polyline') {
      return `${s.points.length} 點 · 點起點閉合`;
    }
    return null;
  }, [draw.state]);

  const activeFloor = floors?.find(f => f.id === selectedFloorId);

  // Render floors-based building
  useEffect(() => {
    if (!sceneReady || !objectsGroupRef.current) return;
    objectsGroupRef.current.clear();
    hoverOverlayRef.current = null;
    addButtonSpriteRef.current = null;

    if (floors && floors.length > 0) {
      let yOffset = 0;
      let maxBuildingW = 40, maxBuildingD = 30;

      floors.forEach((floor, floorIndex) => {
        const isSelectedFloor = floor.id === selectedFloorId;
        const isTopFloor = floorIndex === floors.length - 1;
        const isEditingFloor = editingFloorId === floor.id;
        const isNonEditingInEditMode = editingFloorId != null && !isEditingFloor;
        const floorGroup = new THREE.Group();
        floorGroup.position.y = yOffset;
        floorGroup.userData = { floorId: floor.id };

        let maxW = 0, maxD = 0;
        floor.shapes.forEach(shape => {
          const p = shape.params;
          if (shape.type === 'polyline' && p.points && p.points.length >= 3) {
            // Calculate bounding box from polyline points
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const pt of p.points) {
              minX = Math.min(minX, pt.x);
              maxX = Math.max(maxX, pt.x);
              minY = Math.min(minY, pt.y);
              maxY = Math.max(maxY, pt.y);
            }
            const polyW = maxX - minX;
            const polyD = maxY - minY;
            // Use the absolute extent (points are in world coordinates)
            maxW = Math.max(maxW, Math.max(Math.abs(maxX), Math.abs(minX)) * 2, polyW);
            maxD = Math.max(maxD, Math.max(Math.abs(maxY), Math.abs(minY)) * 2, polyD);
          } else {
            const w = p.width || p.l1 || (p.radius ? p.radius * 2 : 0) || (p.majorRadius ? p.majorRadius * 2 : 0) || (p.outerRadius ? p.outerRadius * 2 : 0) || 40;
            const d = p.length || p.w1 || (p.radius ? p.radius * 2 : 0) || (p.minorRadius ? p.minorRadius * 2 : 0) || (p.outerRadius ? p.outerRadius * 2 : 0) || 30;
            maxW = Math.max(maxW, w);
            maxD = Math.max(maxD, d);
          }
        });
        if (maxW === 0) maxW = 40;
        if (maxD === 0) maxD = 30;
        maxBuildingW = Math.max(maxBuildingW, maxW);
        maxBuildingD = Math.max(maxBuildingD, maxD);

        // Floor slab
        const slab = createFloorSlab(maxW, maxD, 0, isSelectedFloor && !isNonEditingInEditMode);
        slab.userData = { floorId: floor.id };
        if (isNonEditingInEditMode) {
          slab.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const mat = child.material as THREE.MeshPhongMaterial;
              mat.transparent = true;
              mat.opacity = 0.12;
              mat.depthWrite = false;
            }
          });
        }
        floorGroup.add(slab);

        // Shapes
        console.log(`[ThreeDViewer] Floor "${floor.name}" (${floor.id}): ${floor.shapes.length} shapes`, floor.shapes.map(s => ({ id: s.id, type: s.type, hasPoints: !!(s.params.points?.length) })));
        // Pre-compute heatmap normalization across all shapes on all floors.
        // Higher heat loss → hotter color. Estimate: WWR × wall_area × baseline_U.
        const heatLossByShape: Record<string, number> = {};
        if (heatmapMode) {
          (floors ?? []).forEach(f => {
            f.shapes.forEach(s => {
              if (heatmapDataByShape?.[s.id] !== undefined) {
                heatLossByShape[s.id] = heatmapDataByShape[s.id];
                return;
              }
              const wwrEst = s.params.wwr ?? 0.35;
              const w = s.params.width ?? 20;
              const l = s.params.length ?? 20;
              const wallPerim = 2 * (w + l);
              const wallArea = wallPerim * f.floorHeight;
              const opaqueU = 2.0;   // baseline Uaw (W/m²K)
              const glassU  = 3.03;  // baseline Ug
              const heatLoss = wallArea * (1 - wwrEst) * opaqueU + wallArea * wwrEst * glassU;
              heatLossByShape[s.id] = heatLoss;
            });
          });
        }
        const heatVals = Object.values(heatLossByShape);
        const heatMin = heatVals.length ? Math.min(...heatVals) : 0;
        const heatMax = heatVals.length ? Math.max(...heatVals) : 1;
        const heatRange = Math.max(1, heatMax - heatMin);

        floor.shapes.forEach(shape => {
          const wwr = shape.params.wwr ?? 0.35;
          const shadingType = shape.params.shadingType || 'None';
          const texture = createFacadeTexture(wwr, shadingType);
          const isSelectedShape = shape.id === selectedShapeId;

          // Brush color (if set on shape) overrides the default selection-based facade tint.
          // Heatmap mode overrides everything with a ramp colour computed from heat loss.
          const brushColorHex = shape.params.color;
          let facadeColor: number;
          if (heatmapMode) {
            const v = heatLossByShape[shape.id] ?? heatMin;
            const norm = (v - heatMin) / heatRange;
            facadeColor = heatColorAt(norm);
          } else if (brushColorHex) {
            facadeColor = new THREE.Color(brushColorHex).getHex();
          } else {
            facadeColor = isSelectedFloor ? (isSelectedShape ? 0xbfdbfe : 0xdbeafe) : 0xffffff;
          }

          const facadeMat = new THREE.MeshPhongMaterial({
            map: heatmapMode ? null : texture,
            color: facadeColor,
            ...(heatmapMode ? { emissive: facadeColor, emissiveIntensity: 0.25 } : {}),
          });
          const wallOnlyTex = createWallOnlyTexture();
          const wallOnlyMat = new THREE.MeshPhongMaterial({
            map: heatmapMode ? null : wallOnlyTex,
            color: facadeColor,
          });
          const roofMat = new THREE.MeshPhongMaterial({ color: isTopFloor ? 0x94a3b8 : 0xadb5bd, flatShading: true });
          const floorMat = new THREE.MeshPhongMaterial({ color: isSelectedFloor ? 0xdbeafe : 0xe2e8f0, flatShading: true });
          const noWindowFaces = new Set<string>(shape.params.noWindowFaces || []);

          const shapeGroup = buildShapeMesh({ type: shape.type, params: shape.params }, floor.floorHeight, facadeMat, wallOnlyMat, roofMat, floorMat, isTopFloor, noWindowFaces);
          shapeGroup.userData = { floorId: floor.id, shapeId: shape.id };

          // Tag all children with userData for raycasting
          shapeGroup.traverse((child) => {
            child.userData = { ...child.userData, floorId: floor.id, shapeId: shape.id };
          });

          shapeGroup.position.x = shape.position.x;
          shapeGroup.position.z = shape.position.y;
          shapeGroup.rotation.y = -(shape.rotation * Math.PI) / 180;

          // Make non-editing floor shapes transparent
          if (isNonEditingInEditMode) {
            shapeGroup.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((mat: THREE.Material) => {
                  if (mat instanceof THREE.MeshPhongMaterial) {
                    mat.transparent = true;
                    mat.opacity = 0.12;
                    mat.depthWrite = false;
                  }
                });
              }
            });
          }

          // Wireframe for selected shape (only on editing floor or in view mode)
          if (isSelectedShape && !isNonEditingInEditMode) {
            shapeGroup.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                const wireGeo = new THREE.EdgesGeometry(child.geometry);
                const wireMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
                const wireframe = new THREE.LineSegments(wireGeo, wireMat);
                wireframe.position.copy(child.position);
                wireframe.rotation.copy(child.rotation);
                shapeGroup.add(wireframe);
              }
            });
          }

          floorGroup.add(shapeGroup);
        });

        // Floor label
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 128;
        labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = isSelectedFloor ? '#3b82f6' : '#64748b';
          ctx.font = 'bold 32px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(floor.name, 64, 32);
          const labelTex = new THREE.CanvasTexture(labelCanvas);
          const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
          const sprite = new THREE.Sprite(labelMat);
          sprite.position.set(-(maxW / 2 + 8), floor.floorHeight / 2, 0);
          sprite.scale.set(12, 6, 1);
          floorGroup.add(sprite);
        }

        objectsGroupRef.current?.add(floorGroup);
        yOffset += floor.floorHeight;
      });

      // Add floor overlay on top of building (interactive "+" zone)
      const totalHeight = yOffset;
      const overlay = createAddFloorOverlay(maxBuildingW, maxBuildingD, totalHeight);
      objectsGroupRef.current.add(overlay);
      hoverOverlayRef.current = overlay;

      const addBtn = createAddButtonSprite(totalHeight);
      if (addBtn) {
        objectsGroupRef.current.add(addBtn);
        addButtonSpriteRef.current = addBtn;
      }

      // Update camera target
      if (controlsRef.current) {
        controlsRef.current.target.set(0, totalHeight / 2, 0);
        controlsRef.current.update();
      }

    } else {
      // Legacy mode
      objects.forEach(obj => {
        const p = obj.params;
        const wwr = p.wwr || 0.3;
        const shadingType = p.shadingType || 'None';
        const texture = createFacadeTexture(wwr, shadingType);
        const facadeMat = new THREE.MeshPhongMaterial({ map: texture, color: 0xffffff });
        const wallOnlyTex = createWallOnlyTexture();
        const wallOnlyMat = new THREE.MeshPhongMaterial({ map: wallOnlyTex, color: 0xffffff });
        const roofMat = new THREE.MeshPhongMaterial({ color: 0x94a3b8, flatShading: true });
        const floorMat = new THREE.MeshPhongMaterial({ color: 0xe2e8f0, flatShading: true });
        const noWindowFaces = new Set<string>((obj.params as any).noWindowFaces || []);

        const shapeGroup = buildShapeMesh({ type: obj.type, params: obj.params }, obj.params.height, facadeMat, wallOnlyMat, roofMat, floorMat, true, noWindowFaces);
        shapeGroup.rotation.y = -(p.azimuth * Math.PI) / 180;
        objectsGroupRef.current?.add(shapeGroup);
      });
    }
  }, [objects, floors, selectedFloorId, selectedShapeId, editingFloorId, sceneReady,
      heatmapMode, heatmapDataByShape]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-50">
      {/* Orientation label */}
      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-[12px] font-black text-slate-500 border border-slate-200 shadow-sm pointer-events-none z-10">
        {lang === 'zh' ? '方位：指北向上' : 'ORIENTATION: NORTH UP'}
      </div>

      {/* SketchUp-style drawing toolbar (Tasks 4, 6) */}
      <DrawingToolbar
        current={draw.tool}
        onPick={(k) => draw.setTool(k as ToolKind)}
        topViewLocked={topViewLocked}
        onToggleTopView={() => {
          topViewWasUserToggledRef.current = true;
          setTopViewLocked(v => !v);
        }}
        snapEnabled={snapToGrid}
        onToggleSnap={() => setSnapToGrid(v => !v)}
        lang={lang}
        disabled={!selectedFloorId}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        brushColor={draw.brushColor}
        onBrushColorChange={draw.setBrushColor}
      />

      {/* HUD: cursor coords + drawing hint */}
      <DrawingHUD
        cursor={cursor}
        hint={drawHint}
        snapEnabled={snapToGrid}
        topViewLocked={topViewLocked}
        gridSize={gridSize}
        onToggleSnap={() => setSnapToGrid(v => !v)}
        onToggleTopView={() => {
          topViewWasUserToggledRef.current = true;
          setTopViewLocked(v => !v);
        }}
        onSetGridSize={setGridSize}
        lang={lang}
      />

      {/* SketchUp-style param bar at the bottom (live values, type to override + Enter to commit) */}
      <DrawingParamBar
        tool={draw.tool}
        active={
          (draw.state.kind === 'placing' && draw.state.points.length >= 1) ||
          draw.state.kind === 'placing-move'
        }
        specs={draw.paramSpecs}
        onCommit={(values) => draw.commitWithDimensions(values)}
        onErase={draw.eraseLastPoint}
        lang={lang}
      />

      {/* Toast for "no active floor" warnings */}
      {toast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-lg">
          {toast}
        </div>
      )}

      {/* Move-tool phase hint banner */}
      {movePhaseHint && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-emerald-600/95 text-white px-4 py-1.5 rounded-lg text-[12px] font-black shadow-lg pointer-events-none">
          {movePhaseHint}
        </div>
      )}

      {/* Extrude height dialog (shared) */}
      <ExtrudeHeightDialog
        open={draw.extrudeOpen}
        initialHeight={activeFloor?.floorHeight ?? 3.5}
        floorHeightHint={activeFloor?.floorHeight}
        extraFields={draw.extraFields}
        lang={lang}
        onConfirm={(h, extras) => draw.confirmExtrude(h, extras)}
        onCancel={() => draw.cancelExtrude()}
      />

      {/* Hover tooltip for add floor */}
      <div
        ref={tooltipRef}
        className="absolute z-30 pointer-events-none transition-opacity duration-150"
        style={{ opacity: 0, transform: 'translateX(-50%)' }}
      >
        <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[13px] font-black shadow-xl whitespace-nowrap flex items-center gap-1.5">
          <span className="text-base">+</span>
          <span>{lang === 'zh' ? '點擊新增樓層' : 'Click to add floor'}</span>
        </div>
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-blue-600 mx-auto" />
      </div>

      {/* Edit Mode indicator + exit button */}
      {editingFloorId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
          <div className="bg-blue-600/90 backdrop-blur-xl text-white px-4 py-2 rounded-xl shadow-xl border border-blue-500/30 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[13px] font-black uppercase tracking-wide">
                {lang === 'zh' ? '編輯模式' : 'EDIT MODE'}
              </span>
              <span className="text-[12px] font-bold text-blue-200">
                {floors?.find(f => f.id === editingFloorId)?.name || ''}
              </span>
            </div>
            <div className="w-px h-5 bg-white/20" />
            <span className="text-[13px] text-blue-200">
              {lang === 'zh' ? '可拖曳移動形狀位置' : 'Drag shapes to reposition'}
            </span>
            <button
              onClick={onExitEditMode}
              className="ml-2 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[12px] font-black uppercase tracking-wide transition-all border border-white/20"
            >
              {lang === 'zh' ? '✓ 完成編輯' : '✓ Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeDViewer;
