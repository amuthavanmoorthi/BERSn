import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Floor, FloorShape, PolylinePoint } from '../types';
import ExtrudeHeightDialog from './drawing/ExtrudeHeightDialog';

interface TopViewCanvasProps {
  floors: Floor[];
  onFloorsChange: (floors: Floor[]) => void;
  activeFloorId: string;
  selectedShapeId: string | null;
  onSelectShape: (shapeId: string | null) => void;
  onSelectFloor?: (floorId: string) => void;
  onAddFloor?: () => void;
  onExit: () => void;
  lang: 'zh' | 'en';
}

type DrawMode = 'draw' | 'select';
type CanvasState = 'IDLE' | 'DRAWING' | 'EDITING';

interface ViewTransform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

// Grid size options (meters)
const GRID_OPTIONS = [1, 5, 10];
const SNAP_THRESHOLD = 0.5; // meters - snap within this distance

// Drawing constants
const CLOSE_THRESHOLD_PX = 14;
const NODE_RADIUS = 6;
const MIDPOINT_RADIUS = 4;

let polylineCounter = 1000;

// Helper: Shoelace formula for polygon area
const calcPolygonArea = (pts: PolylinePoint[]): number => {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
};

// Helper: polygon perimeter
const calcPerimeter = (pts: PolylinePoint[]): number => {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const dx = pts[j].x - pts[i].x;
    const dy = pts[j].y - pts[i].y;
    p += Math.sqrt(dx * dx + dy * dy);
  }
  return p;
};

// Helper: point-to-segment distance
const pointToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number): { dist: number; t: number } => {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: Math.sqrt((px - ax) ** 2 + (py - ay) ** 2), t: 0 };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return { dist: Math.sqrt((px - projX) ** 2 + (py - projY) ** 2), t };
};

// Helper: point inside polygon (ray casting)
const pointInPolygon = (px: number, py: number, pts: PolylinePoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

const TopViewCanvas: React.FC<TopViewCanvasProps> = ({
  floors, onFloorsChange, activeFloorId, selectedShapeId, onSelectShape, onSelectFloor, onAddFloor, onExit, lang
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = lang === 'zh';

  // View state
  const [view, setView] = useState<ViewTransform>({ offsetX: 0, offsetY: 0, scale: 8 }); // 8 px/meter
  const [mode, setMode] = useState<DrawMode>('draw');
  const [canvasState, setCanvasState] = useState<CanvasState>('IDLE');
  const [gridSize, setGridSize] = useState(5);
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Drawing state
  const [drawingPoints, setDrawingPoints] = useState<PolylinePoint[]>([]);
  const [mouseWorld, setMouseWorld] = useState<PolylinePoint>({ x: 0, y: 0 });
  const [nearClose, setNearClose] = useState(false);

  // Editing state
  const [dragNodeIdx, setDragNodeIdx] = useState<number | null>(null);
  const [dragShape, setDragShape] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<PolylinePoint | null>(null);

  // Extrude height dialog
  const [showExtrudeDialog, setShowExtrudeDialog] = useState(false);
  const [pendingPoints, setPendingPoints] = useState<PolylinePoint[]>([]);
  const [extrudeHeight, setExtrudeHeight] = useState(3.5);

  // Panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; offX: number; offY: number } | null>(null);
  const wasPanningRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const activeFloor = floors.find(f => f.id === activeFloorId);
  const polylineShapes = activeFloor?.shapes.filter(s => s.type === 'polyline' && s.params.isClosed) || [];
  const selectedShape = activeFloor?.shapes.find(s => s.id === selectedShapeId && s.type === 'polyline');

  // Coordinate transforms (CSS pixel space — canvas uses setTransform(dpr,...))
  const worldToScreen = useCallback((wx: number, wy: number): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const dpr = window.devicePixelRatio || 1;
    const cx = canvas.width / dpr / 2;
    const cy = canvas.height / dpr / 2;
    return [
      cx + (wx * view.scale) + view.offsetX,
      cy - (wy * view.scale) + view.offsetY // Y flipped
    ];
  }, [view]);

  const screenToWorld = useCallback((sx: number, sy: number): PolylinePoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const dpr = window.devicePixelRatio || 1;
    const cx = canvas.width / dpr / 2;
    const cy = canvas.height / dpr / 2;
    return {
      x: (sx - cx - view.offsetX) / view.scale,
      y: -(sy - cy - view.offsetY) / view.scale // Y flipped
    };
  }, [view]);

  const snapPoint = useCallback((p: PolylinePoint): PolylinePoint => {
    if (!snapToGrid) return p;
    return {
      x: Math.round(p.x / gridSize) * gridSize,
      y: Math.round(p.y / gridSize) * gridSize,
    };
  }, [snapToGrid, gridSize]);

  // Update floors helper
  const updateFloorShapes = useCallback((newShapes: FloorShape[]) => {
    onFloorsChange(floors.map(f => f.id === activeFloorId ? { ...f, shapes: newShapes } : f));
  }, [floors, activeFloorId, onFloorsChange]);

  // ===== Canvas Rendering =====
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
    };
    resize();

    const obs = new ResizeObserver(resize);
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = canvas.width / dpr;
    const H = canvas.height / dpr;

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    const gridPxSize = gridSize * view.scale;
    if (gridPxSize > 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;

      const [originX, originY] = worldToScreen(0, 0);
      const startX = ((originX % gridPxSize) + gridPxSize) % gridPxSize;
      const startY = ((originY % gridPxSize) + gridPxSize) % gridPxSize;

      for (let x = startX; x < W; x += gridPxSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = startY; y < H; y += gridPxSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Axis lines
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(W, originY); ctx.stroke();
    }

    // Draw reference floors (below active floor) as transparent outlines
    const activeFloorIdx = floors.findIndex(f => f.id === activeFloorId);
    for (let fi = 0; fi < floors.length; fi++) {
      if (fi === activeFloorIdx) continue; // skip active floor, draw it separately
      const refFloor = floors[fi];
      const isBelow = fi < activeFloorIdx;
      const alpha = isBelow ? 0.25 : 0.12;
      const color = isBelow ? '59, 130, 246' : '148, 163, 184';

      refFloor.shapes.forEach(shape => {
        if (shape.type === 'polyline' && shape.params.isClosed && shape.params.points) {
          const pts = shape.params.points;
          if (pts.length < 3) return;
          ctx.beginPath();
          const [fx, fy] = worldToScreen(pts[0].x, pts[0].y);
          ctx.moveTo(fx, fy);
          for (let i = 1; i < pts.length; i++) {
            const [px, py] = worldToScreen(pts[i].x, pts[i].y);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(${color}, ${alpha * 0.3})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(${color}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (shape.type !== 'polyline') {
          // Draw bounding box for built-in shapes
          const p = shape.params;
          let w = p.width || p.l1 || (p.radius ? p.radius * 2 : 0) || (p.majorRadius ? p.majorRadius * 2 : 0) || (p.circumradius ? p.circumradius * 2 : 0) || 30;
          let h = p.length || p.w1 || (p.radius ? p.radius * 2 : 0) || (p.minorRadius ? p.minorRadius * 2 : 0) || (p.circumradius ? p.circumradius * 2 : 0) || 30;
          const cx = shape.position.x;
          const cy = shape.position.y;
          const [sx, sy] = worldToScreen(cx - w / 2, cy + h / 2);
          const [ex, ey] = worldToScreen(cx + w / 2, cy - h / 2);
          ctx.fillStyle = `rgba(${color}, ${alpha * 0.2})`;
          ctx.fillRect(sx, sy, ex - sx, ey - sy);
          ctx.strokeStyle = `rgba(${color}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(sx, sy, ex - sx, ey - sy);
          ctx.setLineDash([]);
        }
      });

      // Floor label for reference floors
      if (refFloor.shapes.length > 0) {
        const firstShape = refFloor.shapes[0];
        let lx = 0, ly = 0;
        if (firstShape.type === 'polyline' && firstShape.params.points?.length) {
          const pts = firstShape.params.points;
          lx = pts.reduce((s: number, p: PolylinePoint) => s + p.x, 0) / pts.length;
          ly = pts.reduce((s: number, p: PolylinePoint) => s + p.y, 0) / pts.length;
        } else {
          lx = firstShape.position.x;
          ly = firstShape.position.y;
        }
        const [slx, sly] = worldToScreen(lx, ly);
        ctx.fillStyle = `rgba(${color}, ${alpha * 1.5})`;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(refFloor.name, slx, sly + 4);
      }
    }

    // Draw existing built-in shapes (non-polyline) on ACTIVE floor as grey outlines
    if (activeFloor) {
      activeFloor.shapes.forEach(shape => {
        if (shape.type === 'polyline') return;
        const p = shape.params;
        let w = p.width || p.l1 || (p.radius ? p.radius * 2 : 0) || (p.majorRadius ? p.majorRadius * 2 : 0) || (p.circumradius ? p.circumradius * 2 : 0) || 30;
        let h = p.length || p.w1 || (p.radius ? p.radius * 2 : 0) || (p.minorRadius ? p.minorRadius * 2 : 0) || (p.circumradius ? p.circumradius * 2 : 0) || 30;

        const cx = shape.position.x;
        const cy = shape.position.y;
        const [sx, sy] = worldToScreen(cx - w / 2, cy + h / 2);
        const [ex, ey] = worldToScreen(cx + w / 2, cy - h / 2);

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(sx, sy, ex - sx, ey - sy);
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const label = shape.type === 'box' ? 'Box' : shape.type === 'cylinder' ? 'Cyl' : shape.type;
        ctx.fillText(label, (sx + ex) / 2, (sy + ey) / 2 + 4);
      });
    }

    // Draw closed polyline shapes
    polylineShapes.forEach(shape => {
      const pts = shape.params.points || [];
      if (pts.length < 3) return;

      const isSelected = shape.id === selectedShapeId;

      // Fill
      ctx.beginPath();
      const [fx, fy] = worldToScreen(pts[0].x, pts[0].y);
      ctx.moveTo(fx, fy);
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = worldToScreen(pts[i].x, pts[i].y);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.08)';
      ctx.fill();

      // Outline
      ctx.strokeStyle = isSelected ? '#60a5fa' : 'rgba(148, 163, 184, 0.6)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Nodes (only for selected)
      if (isSelected && mode === 'select') {
        pts.forEach((p, idx) => {
          const [nx, ny] = worldToScreen(p.x, p.y);
          ctx.beginPath();
          ctx.arc(nx, ny, NODE_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = dragNodeIdx === idx ? '#3b82f6' : '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          ctx.stroke();
        });

        // Midpoints (for inserting nodes)
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          const mx = (pts[i].x + pts[j].x) / 2;
          const my = (pts[i].y + pts[j].y) / 2;
          const [sx, sy] = worldToScreen(mx, my);
          ctx.beginPath();
          ctx.arc(sx, sy, MIDPOINT_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Area + Perimeter label
        const area = calcPolygonArea(pts);
        const perim = calcPerimeter(pts);
        const centroidX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const centroidY = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const [lx, ly] = worldToScreen(centroidX, centroidY);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${area.toFixed(1)} m²`, lx, ly - 6);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${t ? '周長' : 'P'}: ${perim.toFixed(1)} m`, lx, ly + 10);
      }
    });

    // Draw current polyline being drawn
    if (canvasState === 'DRAWING' && drawingPoints.length > 0) {
      ctx.beginPath();
      const [sx, sy] = worldToScreen(drawingPoints[0].x, drawingPoints[0].y);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < drawingPoints.length; i++) {
        const [px, py] = worldToScreen(drawingPoints[i].x, drawingPoints[i].y);
        ctx.lineTo(px, py);
      }
      // Rubber band to mouse
      const snapped = snapToGrid ? snapPoint(mouseWorld) : mouseWorld;
      const [mx, my] = worldToScreen(snapped.x, snapped.y);
      ctx.lineTo(mx, my);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw nodes
      drawingPoints.forEach((p, idx) => {
        const [nx, ny] = worldToScreen(p.x, p.y);
        ctx.beginPath();
        ctx.arc(nx, ny, idx === 0 && nearClose ? NODE_RADIUS + 4 : NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 && nearClose ? '#f97316' : '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Close indicator pulse
      if (nearClose && drawingPoints.length >= 3) {
        const [cx, cy] = worldToScreen(drawingPoints[0].x, drawingPoints[0].y);
        const pulse = (Date.now() % 1000) / 1000;
        const r = NODE_RADIUS + 4 + pulse * 8;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(249, 115, 22, ${1 - pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Snap crosshair at mouse
      if (snapToGrid) {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx - 10, my); ctx.lineTo(mx + 10, my); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx, my - 10); ctx.lineTo(mx, my + 10); ctx.stroke();
      }
    }

    // North arrow
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', W - 30, 30);
    ctx.beginPath();
    ctx.moveTo(W - 30, 36);
    ctx.lineTo(W - 26, 46);
    ctx.lineTo(W - 34, 46);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // Coordinate display
    const snapped = snapToGrid ? snapPoint(mouseWorld) : mouseWorld;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`(${snapped.x.toFixed(1)}, ${snapped.y.toFixed(1)}) m`, 12, H - 12);

    // Continuous redraw for animations
    if (canvasState === 'DRAWING' && nearClose) {
      requestAnimationFrame(() => {
        // Trigger re-render
        setMouseWorld(prev => ({ ...prev }));
      });
    }
  }, [view, drawingPoints, mouseWorld, nearClose, canvasState, polylineShapes, selectedShapeId, mode, dragNodeIdx, activeFloor, worldToScreen, snapToGrid, snapPoint, gridSize, t]);

  // ===== Event Handlers =====
  const getCanvasPos = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Pan: middle-click, right-click, Alt+left-click, or space+left-click
    if (e.button === 1 || e.button === 2 || (e.button === 0 && (e.altKey || spaceHeld))) {
      const pos = getCanvasPos(e);
      setIsPanning(true);
      setPanStart({ x: pos.x, y: pos.y, offX: view.offsetX, offY: view.offsetY });
      e.preventDefault();
      return;
    }

    if (e.button !== 0) return;
    const pos = getCanvasPos(e);
    const world = screenToWorld(pos.x, pos.y);

    if (mode === 'select' && selectedShape && selectedShape.params.points) {
      const pts = selectedShape.params.points;

      // Check if Alt+click on edge midpoint → insert node
      if (e.altKey) {
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          const mx = (pts[i].x + pts[j].x) / 2;
          const my = (pts[i].y + pts[j].y) / 2;
          const [sx, sy] = worldToScreen(mx, my);
          const dist = Math.sqrt((pos.x - sx) ** 2 + (pos.y - sy) ** 2);
          if (dist < MIDPOINT_RADIUS + 6) {
            // Insert node
            const newPts = [...pts];
            newPts.splice(j, 0, { x: mx, y: my });
            if (activeFloor) {
              const newShapes = activeFloor.shapes.map(s =>
                s.id === selectedShapeId ? { ...s, params: { ...s.params, points: newPts } } : s
              );
              updateFloorShapes(newShapes);
            }
            setDragNodeIdx(j);
            setDragStart(world);
            return;
          }
        }
      }

      // Check node drag
      for (let i = 0; i < pts.length; i++) {
        const [nx, ny] = worldToScreen(pts[i].x, pts[i].y);
        const dist = Math.sqrt((pos.x - nx) ** 2 + (pos.y - ny) ** 2);
        if (dist < NODE_RADIUS + 4) {
          setDragNodeIdx(i);
          setDragStart(world);
          return;
        }
      }

      // Check if inside polygon → start shape drag
      if (pointInPolygon(world.x, world.y, pts)) {
        setDragShape(true);
        setDragStart(world);
        return;
      }
    }

    if (mode === 'select') {
      // Try selecting a polyline shape
      if (activeFloor) {
        for (const shape of [...activeFloor.shapes].reverse()) {
          if (shape.type !== 'polyline' || !shape.params.isClosed || !shape.params.points) continue;
          if (pointInPolygon(world.x, world.y, shape.params.points)) {
            onSelectShape(shape.id);
            return;
          }
        }
        onSelectShape(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);

    // Panning
    if (isPanning && panStart) {
      setView(v => ({
        ...v,
        offsetX: panStart.offX + (pos.x - panStart.x),
        offsetY: panStart.offY + (pos.y - panStart.y),
      }));
      return;
    }

    const world = screenToWorld(pos.x, pos.y);
    setMouseWorld(world);

    // Drawing mode: check close proximity
    if (canvasState === 'DRAWING' && drawingPoints.length >= 3) {
      const [sx, sy] = worldToScreen(drawingPoints[0].x, drawingPoints[0].y);
      const dist = Math.sqrt((pos.x - sx) ** 2 + (pos.y - sy) ** 2);
      setNearClose(dist < CLOSE_THRESHOLD_PX);
    }

    // Node drag
    if (dragNodeIdx !== null && selectedShape && selectedShape.params.points && activeFloor) {
      const snapped = snapPoint(world);
      const newPts = [...selectedShape.params.points];
      newPts[dragNodeIdx] = { x: snapped.x, y: snapped.y };
      const newShapes = activeFloor.shapes.map(s =>
        s.id === selectedShapeId ? { ...s, params: { ...s.params, points: newPts } } : s
      );
      updateFloorShapes(newShapes);
    }

    // Shape drag
    if (dragShape && dragStart && selectedShape && selectedShape.params.points && activeFloor) {
      const dx = world.x - dragStart.x;
      const dy = world.y - dragStart.y;
      const newPts = selectedShape.params.points.map(p => ({
        x: p.x + dx, y: p.y + dy
      }));
      setDragStart(world);
      const newShapes = activeFloor.shapes.map(s =>
        s.id === selectedShapeId ? { ...s, params: { ...s.params, points: newPts } } : s
      );
      updateFloorShapes(newShapes);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      wasPanningRef.current = true;
      setIsPanning(false);
      setPanStart(null);
      return;
    }
    setDragNodeIdx(null);
    setDragShape(false);
    setDragStart(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Suppress click that fires right after a pan ends
    if (wasPanningRef.current) {
      wasPanningRef.current = false;
      return;
    }
    if (isPanning || dragNodeIdx !== null || dragShape) return;
    if (mode !== 'draw') return;
    if (e.button !== 0) return;

    const pos = getCanvasPos(e);
    const world = screenToWorld(pos.x, pos.y);
    const snapped = snapPoint(world);

    if (canvasState === 'DRAWING' && nearClose && drawingPoints.length >= 3) {
      // Close the polyline
      setPendingPoints([...drawingPoints]);
      setExtrudeHeight(activeFloor?.floorHeight || 3.5);
      setShowExtrudeDialog(true);
      setDrawingPoints([]);
      setCanvasState('IDLE');
      setNearClose(false);
      return;
    }

    // Add point
    setDrawingPoints(prev => [...prev, snapped]);
    if (canvasState !== 'DRAWING') setCanvasState('DRAWING');
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const worldBefore = screenToWorld(pos.x, pos.y);

    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(1, Math.min(60, view.scale * factor));

    setView(v => {
      const newOx = pos.x - (canvasRef.current?.width || 0) / (2 * (window.devicePixelRatio || 1)) - worldBefore.x * newScale;
      const newOy = pos.y - (canvasRef.current?.height || 0) / (2 * (window.devicePixelRatio || 1)) + worldBefore.y * newScale;
      return { offsetX: newOx, offsetY: newOy, scale: newScale };
    });
  };

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space held for pan
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      if (showExtrudeDialog) return;

      if (e.key === 'Escape') {
        if (canvasState === 'DRAWING') {
          setDrawingPoints([]);
          setCanvasState('IDLE');
          setNearClose(false);
        } else {
          onExit();
        }
        return;
      }

      if (e.key === 'Enter' && canvasState === 'DRAWING' && drawingPoints.length >= 3) {
        // Force close
        setPendingPoints([...drawingPoints]);
        setExtrudeHeight(activeFloor?.floorHeight || 3.5);
        setShowExtrudeDialog(true);
        setDrawingPoints([]);
        setCanvasState('IDLE');
        setNearClose(false);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && mode === 'select' && selectedShape) {
        if (dragNodeIdx !== null && selectedShape.params.points && selectedShape.params.points.length > 3) {
          // Delete node
          const newPts = selectedShape.params.points.filter((_, i) => i !== dragNodeIdx);
          if (activeFloor) {
            const newShapes = activeFloor.shapes.map(s =>
              s.id === selectedShapeId ? { ...s, params: { ...s.params, points: newPts } } : s
            );
            updateFloorShapes(newShapes);
          }
          setDragNodeIdx(null);
        } else {
          // Delete shape
          if (activeFloor) {
            const newShapes = activeFloor.shapes.filter(s => s.id !== selectedShapeId);
            updateFloorShapes(newShapes);
            onSelectShape(null);
          }
        }
        return;
      }

      // Undo last point while drawing
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && canvasState === 'DRAWING') {
        setDrawingPoints(prev => prev.slice(0, -1));
        if (drawingPoints.length <= 1) setCanvasState('IDLE');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvasState, drawingPoints, mode, selectedShape, dragNodeIdx, activeFloor, selectedShapeId, showExtrudeDialog, onExit, onSelectShape, updateFloorShapes]);

  // Confirm extrude
  const confirmExtrude = (heightOverride?: number) => {
    if (pendingPoints.length < 3 || !activeFloor) {
      console.warn('[TopViewCanvas] confirmExtrude: invalid state, pendingPoints=', pendingPoints.length, 'activeFloor=', !!activeFloor);
      return;
    }

    const finalHeight = heightOverride ?? extrudeHeight;

    // Deep copy points to prevent any reference issues
    const copiedPoints = pendingPoints.map(p => ({ x: p.x, y: p.y }));

    const newShape: FloorShape = {
      id: `polyline-${Date.now()}-${polylineCounter++}`,
      type: 'polyline',
      params: {
        points: copiedPoints,
        extrudeHeight: finalHeight,
        isClosed: true,
        wwr: 0.35,
        glassType: 'Double',
        shadingType: 'None',
      },
      position: { x: 0, y: 0 },
      rotation: 0,
    };

    console.log('[TopViewCanvas] confirmExtrude: creating polyline shape', {
      id: newShape.id,
      points: copiedPoints.length,
      extrudeHeight,
      floorId: activeFloorId,
      existingShapes: activeFloor.shapes.length,
      pointData: copiedPoints,
    });

    const newShapes = [...activeFloor.shapes, newShape];
    updateFloorShapes(newShapes);
    onSelectShape(newShape.id);
    setShowExtrudeDialog(false);
    setPendingPoints([]);
    // Stay in draw mode for next shape
  };

  const cancelExtrude = () => {
    setShowExtrudeDialog(false);
    setPendingPoints([]);
  };

  const zoomPercent = Math.round(view.scale / 8 * 100);

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: '#0f172a' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/95 border-b border-white/10 backdrop-blur-xl z-10 flex-shrink-0">
        {/* Mode toggles */}
        <div className="flex bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => { setMode('draw'); setCanvasState('IDLE'); setDrawingPoints([]); onSelectShape(null); }}
            className={`px-3 py-1.5 rounded-md text-[12px] font-black uppercase tracking-wide transition-all ${mode === 'draw' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            🖊️ {t ? '繪製' : 'Draw'}
          </button>
          <button
            onClick={() => { setMode('select'); setCanvasState('IDLE'); setDrawingPoints([]); }}
            className={`px-3 py-1.5 rounded-md text-[12px] font-black uppercase tracking-wide transition-all ${mode === 'select' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            ✋ {t ? '選取' : 'Select'}
          </button>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Snap toggle */}
        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          className={`px-2.5 py-1.5 rounded-lg text-[12px] font-bold transition-all ${snapToGrid ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-500 border border-transparent'}`}
        >
          ⊞ {t ? '吸附' : 'Snap'}: {snapToGrid ? 'ON' : 'OFF'}
        </button>

        {/* Grid size */}
        <div className="flex items-center gap-1">
          <span className="text-[13px] text-slate-500 font-bold">{t ? '格線' : 'Grid'}:</span>
          {GRID_OPTIONS.map(g => (
            <button
              key={g}
              onClick={() => setGridSize(g)}
              className={`px-2 py-1 rounded text-[12px] font-bold transition-all ${gridSize === g ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {g}m
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Delete selected */}
        {mode === 'select' && selectedShape && (
          <button
            onClick={() => {
              if (activeFloor) {
                updateFloorShapes(activeFloor.shapes.filter(s => s.id !== selectedShapeId));
                onSelectShape(null);
              }
            }}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-all"
          >
            🗑️ {t ? '刪除' : 'Delete'}
          </button>
        )}

        <div className="flex-1" />

        {/* Floor Switcher */}
        <div className="flex items-center gap-1">
          <span className="text-[13px] font-black text-slate-500 mr-1">{t ? '樓層' : 'Floor'}:</span>
          <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
            {floors.map((f, idx) => (
              <button
                key={f.id}
                onClick={() => onSelectFloor?.(f.id)}
                className={`px-2 py-1 rounded-md text-[13px] font-black transition-all ${
                  f.id === activeFloorId
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {f.name}
              </button>
            ))}
            {onAddFloor && (
              <button
                onClick={onAddFloor}
                className="px-2 py-1 rounded-md text-[13px] font-black text-emerald-400 hover:bg-emerald-600/20 transition-all"
                title={t ? '新增樓層' : 'Add Floor'}
              >
                +
              </button>
            )}
          </div>
          <span className="text-[12px] text-slate-500 ml-1">
            {polylineShapes.length} {t ? '個輪廓' : 'outlines'}
          </span>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView(v => ({ ...v, scale: Math.max(1, v.scale * 0.8) }))}
            className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 text-[13px] font-bold flex items-center justify-center transition-all"
            title="Zoom out"
          >
            −
          </button>
          <span className="text-[12px] font-bold text-slate-500 min-w-[36px] text-center">{zoomPercent}%</span>
          <button
            onClick={() => setView(v => ({ ...v, scale: Math.min(60, v.scale * 1.25) }))}
            className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 text-[13px] font-bold flex items-center justify-center transition-all"
            title="Zoom in"
          >
            +
          </button>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Reset View */}
        <button
          onClick={() => setView({ offsetX: 0, offsetY: 0, scale: 8 })}
          className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-white/10"
          title={t ? '重置視圖至原點' : 'Reset view to origin'}
        >
          ⌂ {t ? '原點' : 'Reset'}
        </button>

        <div className="w-px h-6 bg-white/10" />

        {/* Exit */}
        <button
          onClick={onExit}
          className="px-3 py-1.5 rounded-lg text-[12px] font-black bg-slate-700 text-white hover:bg-slate-600 transition-all border border-white/10"
        >
          ↩️ {t ? '退出' : 'Exit'}
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            cursor: isPanning ? 'grabbing' :
              spaceHeld ? 'grab' :
              mode === 'draw' ? 'crosshair' :
                dragNodeIdx !== null ? 'grabbing' :
                  dragShape ? 'move' : 'default'
          }}
        />

        {/* Drawing hints */}
        {canvasState === 'DRAWING' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 text-center">
            <p className="text-[13px] font-bold text-white">
              {drawingPoints.length < 3
                ? (t ? `已放置 ${drawingPoints.length} 個節點，至少需要 3 個` : `${drawingPoints.length} points placed, need at least 3`)
                : nearClose
                  ? (t ? '🔶 點擊起點以閉合輪廓' : '🔶 Click start point to close')
                  : (t ? '繼續點擊新增節點，或按 Enter 強制閉合' : 'Click to add points, or press Enter to close')
              }
            </p>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {t ? 'Esc 取消 · Ctrl+Z 回退 · 右鍵/Space拖曳平移' : 'Esc to cancel · Ctrl+Z to undo · Right-click/Space to pan'}
            </p>
          </div>
        )}

        {/* Select mode hints */}
        {mode === 'select' && !selectedShape && canvasState !== 'DRAWING' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10">
            <p className="text-[12px] text-slate-400 font-bold">
              {t ? '點擊選取輪廓 · Alt+點擊邊中點可插入節點 · Delete 刪除' : 'Click to select · Alt+click midpoint to insert · Delete to remove'}
            </p>
          </div>
        )}

        {mode === 'select' && selectedShape && (
          <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-xl p-3 rounded-xl border border-blue-500/30 w-56 space-y-2">
            <p className="text-[12px] font-black text-blue-400 uppercase tracking-wide">{t ? '選取的輪廓' : 'Selected Shape'}</p>

            {/* Extrude height */}
            <div className="space-y-0.5">
              <label className="text-[12px] font-black text-slate-400 uppercase">{t ? '擠出高度' : 'Extrude H'}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={selectedShape.params.extrudeHeight || activeFloor?.floorHeight || 3.5}
                  step={0.1}
                  min={0.5}
                  onChange={(e) => {
                    if (activeFloor) {
                      const val = parseFloat(e.target.value) || 3.5;
                      onFloorsChange(floors.map(f =>
                        f.id === activeFloorId
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
                    }
                  }}
                  className="w-full p-1.5 bg-white/10 border border-white/10 rounded-lg text-[13px] font-bold text-white focus:bg-white focus:text-slate-900 outline-none text-center"
                />
                <span className="text-[13px] text-slate-500">m</span>
              </div>
            </div>

            {/* Stats */}
            {selectedShape.params.points && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                <div>
                  <span className="text-[12px] text-slate-500 font-bold block">{t ? '面積' : 'Area'}</span>
                  <span className="text-[13px] font-black text-white">{calcPolygonArea(selectedShape.params.points).toFixed(1)} m²</span>
                </div>
                <div>
                  <span className="text-[12px] text-slate-500 font-bold block">{t ? '節點' : 'Nodes'}</span>
                  <span className="text-[13px] font-black text-white">{selectedShape.params.points.length}</span>
                </div>
              </div>
            )}

            {/* Per-shape WWR */}
            <div className="pt-1 border-t border-white/10 space-y-0.5">
              <label className="text-[12px] font-black text-orange-400 uppercase">
                {t ? '開窗率' : 'WWR'} {((selectedShape?.params.wwr ?? 0.35) * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="5"
                max="90"
                step="1"
                value={(selectedShape?.params.wwr ?? 0.35) * 100}
                onChange={(e) => {
                  if (!activeFloor || !selectedShape) return;
                  const newWwr = parseInt(e.target.value) / 100;
                  const newShapes = activeFloor.shapes.map(s =>
                    s.id === selectedShape.id ? { ...s, params: { ...s.params, wwr: newWwr } } : s
                  );
                  updateFloorShapes(newShapes);
                }}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </div>
        )}
      </div>

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
        onConfirm={(h) => { setExtrudeHeight(h); confirmExtrude(h); }}
        onCancel={cancelExtrude}
      />
    </div>
  );
};

export default TopViewCanvas;
