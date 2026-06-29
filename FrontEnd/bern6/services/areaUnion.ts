// Compute the union (no-double-count) footprint area of a list of FloorShape
// instances by rasterizing each shape outline to polygons and grid-sampling.
//
// Scope per design decision (B): only roof / footprint area. Walls and windows
// are unchanged.
import { FloorShape } from '../types';

type Pt = { x: number; y: number };

const CIRCLE_SEGMENTS = 48;
const ELLIPSE_SEGMENTS = 64;
const ARC_SEGMENTS = 24;

/** Rotate a point around origin by angleDeg (degrees, CCW). */
function rotate(p: Pt, angleDeg: number): Pt {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function translate(p: Pt, dx: number, dy: number): Pt {
  return { x: p.x + dx, y: p.y + dy };
}

/** Convert one FloorShape to a polygon outline in world coordinates. */
export function shapeToPolygon(shape: FloorShape): Pt[] {
  const p = shape.params;
  const { x: ox, y: oy } = shape.position;
  const rot = shape.rotation || 0;
  const local: Pt[] = [];

  switch (shape.type) {
    case 'box': {
      const w = (p.width || 30) / 2;
      const l = (p.length || 30) / 2;
      local.push({ x: -w, y: -l }, { x: w, y: -l }, { x: w, y: l }, { x: -w, y: l });
      break;
    }
    case 'cylinder': {
      const r = p.radius || 15;
      for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
        const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
        local.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      break;
    }
    case 'polygon': {
      const sides = Math.max(3, p.sides || 6);
      const r = p.circumradius || 20;
      const start = ((p.startAngle || 0) * Math.PI) / 180;
      for (let i = 0; i < sides; i++) {
        const a = start + (i / sides) * Math.PI * 2;
        local.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      break;
    }
    case 'ellipse': {
      const a = p.majorRadius || 25;
      const b = p.minorRadius || 15;
      for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
        const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
        local.push({ x: Math.cos(t) * a, y: Math.sin(t) * b });
      }
      break;
    }
    case 'arc': {
      // arcRadius = inner radius; depth extends outward
      const innerR = p.arcRadius || 30;
      const angle = ((p.arcAngle || 90) * Math.PI) / 180;
      const depth = p.depth || 20;
      const outerR = innerR + depth;
      for (let i = 0; i <= ARC_SEGMENTS; i++) {
        const t = (i / ARC_SEGMENTS) * angle;
        local.push({ x: Math.cos(t) * outerR, y: Math.sin(t) * outerR });
      }
      for (let i = ARC_SEGMENTS; i >= 0; i--) {
        const t = (i / ARC_SEGMENTS) * angle;
        local.push({ x: Math.cos(t) * innerR, y: Math.sin(t) * innerR });
      }
      break;
    }
    case 'fan': {
      const outer = p.outerRadius || 30;
      const inner = Math.max(0, p.innerRadius ?? 0);
      const angle = ((p.fanAngle || 90) * Math.PI) / 180;
      if (inner <= 0.01) {
        // Pie slice: center + outer arc
        local.push({ x: 0, y: 0 });
        for (let i = 0; i <= ARC_SEGMENTS; i++) {
          const t = (i / ARC_SEGMENTS) * angle;
          local.push({ x: Math.cos(t) * outer, y: Math.sin(t) * outer });
        }
      } else {
        for (let i = 0; i <= ARC_SEGMENTS; i++) {
          const t = (i / ARC_SEGMENTS) * angle;
          local.push({ x: Math.cos(t) * outer, y: Math.sin(t) * outer });
        }
        for (let i = ARC_SEGMENTS; i >= 0; i--) {
          const t = (i / ARC_SEGMENTS) * angle;
          local.push({ x: Math.cos(t) * inner, y: Math.sin(t) * inner });
        }
      }
      break;
    }
    case 'lShape': {
      const l1 = p.l1 || 40, w1 = p.w1 || 20;
      const l2 = p.l2 || 20, w2 = p.w2 || 15;
      // Main body centered at origin (l1 along X, w1 along Y)
      // Wing positioned per direction
      const dir = p.lDirection || 'TopLeft';
      // Main body corners
      const mx = l1 / 2, my = w1 / 2;
      const wx = l2, wy = w2;
      // Compose using two rectangles, output the L outline
      // For simplicity emit vertices in order for the four common configs
      // TopLeft = wing extends up-left from main body's top-left corner
      const main = [
        { x: -mx, y: -my }, { x: mx, y: -my }, { x: mx, y: my }, { x: -mx, y: my },
      ];
      let wing: Pt[];
      if (dir === 'TopLeft')      wing = [{ x: -mx, y: my }, { x: -mx + wx, y: my }, { x: -mx + wx, y: my + wy }, { x: -mx, y: my + wy }];
      else if (dir === 'TopRight') wing = [{ x: mx - wx, y: my }, { x: mx, y: my }, { x: mx, y: my + wy }, { x: mx - wx, y: my + wy }];
      else if (dir === 'BottomLeft') wing = [{ x: -mx, y: -my - wy }, { x: -mx + wx, y: -my - wy }, { x: -mx + wx, y: -my }, { x: -mx, y: -my }];
      else                          wing = [{ x: mx - wx, y: -my - wy }, { x: mx, y: -my - wy }, { x: mx, y: -my }, { x: mx - wx, y: -my }];
      // Use union via rasterization later — push two separate sub-polygons by returning concatenated marker?
      // For our area calc we sample inside main OR wing; we encode by returning
      // a polygon that's the L outline. Easiest: rasterize each sub-rect separately.
      // Push main polygon first, then wing as a separate polygon by appending a sentinel? not great.
      // Simpler: for L/T, return TWO polygons via a special marker; for now we'll
      // approximate by returning the main rectangle here, callers should handle L/T as multi-poly.
      // ↳ We instead provide shapeToPolygons (plural) below.
      // (This branch keeps a fallback single-poly bbox.)
      local.push(...main);
      // wing is dropped here in the single-polygon API
      void wing;
      break;
    }
    case 'tShape': {
      const l1 = p.l1 || 40, w1 = p.w1 || 15;
      // Single-poly fallback: main body only
      local.push({ x: -l1 / 2, y: -w1 / 2 }, { x: l1 / 2, y: -w1 / 2 }, { x: l1 / 2, y: w1 / 2 }, { x: -l1 / 2, y: w1 / 2 });
      break;
    }
    case 'polyline': {
      // Polyline points are stored as { x: world.x, y: -world.z } (compensates
      // for the -π/2 rotation in 3D rendering). Convert to world (x, z) AND
      // apply the shape's position+rotation so anchors track moves/rotates.
      const pts = p.points || [];
      const polylineLocal = pts.map(pp => ({ x: pp.x, y: -pp.y })); // (X, Z) shape-local
      return polylineLocal.map(pt => translate(rotate(pt, rot), ox, oy));
    }
    default:
      break;
  }

  return local.map(pt => translate(rotate(pt, rot), ox, oy));
}

/** Return one or more polygons that together represent the shape footprint. */
export function shapeToPolygons(shape: FloorShape): Pt[][] {
  const p = shape.params;
  const { x: ox, y: oy } = shape.position;
  const rot = shape.rotation || 0;
  const xform = (pts: Pt[]) => pts.map(pp => translate(rotate(pp, rot), ox, oy));

  if (shape.type === 'lShape') {
    // Freehand-drawn L: use stored polyline points if present.
    if (p.points && p.points.length >= 3) {
      const local = p.points.map(pp => ({ x: pp.x, y: -pp.y }));
      return [local.map(pt => translate(rotate(pt, rot), ox, oy))];
    }
    // Single L outline (6 vertices) — matches ThreeDViewer rendering.
    const l1 = p.l1 || 40, w1 = p.w1 || 20;
    const l2 = p.l2 || 20, w2 = p.w2 || 15;
    const dir = p.lDirection || 'TopLeft';
    const mx = l1 / 2, my = w1 / 2;
    let outline: Pt[];
    if (dir === 'TopLeft') {
      outline = [
        { x: -mx, y: -my }, { x: mx, y: -my }, { x: mx, y: my },
        { x: -mx + l2, y: my }, { x: -mx + l2, y: my + w2 }, { x: -mx, y: my + w2 },
      ];
    } else if (dir === 'TopRight') {
      outline = [
        { x: -mx, y: -my }, { x: mx, y: -my }, { x: mx, y: my + w2 },
        { x: mx - l2, y: my + w2 }, { x: mx - l2, y: my }, { x: -mx, y: my },
      ];
    } else if (dir === 'BottomLeft') {
      outline = [
        { x: -mx, y: -my - w2 }, { x: -mx + l2, y: -my - w2 }, { x: -mx + l2, y: -my },
        { x: mx, y: -my }, { x: mx, y: my }, { x: -mx, y: my },
      ];
    } else {
      outline = [
        { x: mx - l2, y: -my - w2 }, { x: mx, y: -my - w2 }, { x: mx, y: my },
        { x: -mx, y: my }, { x: -mx, y: -my }, { x: mx - l2, y: -my },
      ];
    }
    return [xform(outline)];
  }
  if (shape.type === 'tShape') {
    // Freehand-drawn T: use stored polyline points if present.
    if (p.points && p.points.length >= 3) {
      const local = p.points.map(pp => ({ x: pp.x, y: -pp.y }));
      return [local.map(pt => translate(rotate(pt, rot), ox, oy))];
    }
    // Single T outline (8 vertices) — matches ThreeDViewer rendering.
    const l1 = p.l1 || 40, w1 = p.w1 || 15;
    const l2 = p.l2 || 30, w2 = p.w2 || 20;
    const wingPos = p.wingPosition || 'top';
    let outline: Pt[];
    if (wingPos === 'top') {
      const ww = Math.min(l2, l1) / 2;
      outline = [
        { x: -l1/2, y: -w1/2 }, { x: l1/2, y: -w1/2 }, { x: l1/2, y: w1/2 },
        { x: ww, y: w1/2 }, { x: ww, y: w1/2 + w2 },
        { x: -ww, y: w1/2 + w2 }, { x: -ww, y: w1/2 }, { x: -l1/2, y: w1/2 },
      ];
    } else if (wingPos === 'bottom') {
      const ww = Math.min(l2, l1) / 2;
      outline = [
        { x: -l1/2, y: -w1/2 }, { x: -ww, y: -w1/2 }, { x: -ww, y: -w1/2 - w2 },
        { x: ww, y: -w1/2 - w2 }, { x: ww, y: -w1/2 },
        { x: l1/2, y: -w1/2 }, { x: l1/2, y: w1/2 }, { x: -l1/2, y: w1/2 },
      ];
    } else if (wingPos === 'left') {
      const wd = Math.min(l2, w1) / 2;
      outline = [
        { x: -l1/2, y: -w1/2 }, { x: l1/2, y: -w1/2 }, { x: l1/2, y: w1/2 },
        { x: -l1/2, y: w1/2 }, { x: -l1/2, y: wd },
        { x: -l1/2 - w2, y: wd }, { x: -l1/2 - w2, y: -wd }, { x: -l1/2, y: -wd },
      ];
    } else {
      const wd = Math.min(l2, w1) / 2;
      outline = [
        { x: -l1/2, y: -w1/2 }, { x: l1/2, y: -w1/2 }, { x: l1/2, y: -wd },
        { x: l1/2 + w2, y: -wd }, { x: l1/2 + w2, y: wd },
        { x: l1/2, y: wd }, { x: l1/2, y: w1/2 }, { x: -l1/2, y: w1/2 },
      ];
    }
    return [xform(outline)];
  }
  return [shapeToPolygon(shape)];
}

/** World-space anchor points (corners + edge midpoints) for snap-to-edge. */
export function shapeAnchors(shape: FloorShape): Pt[] {
  const polys = shapeToPolygons(shape);
  const out: Pt[] = [];
  const seen = new Set<string>();
  const push = (p: Pt) => {
    const k = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(p);
  };
  for (const poly of polys) {
    if (poly.length < 2) continue;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      push(a);
      push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  }
  return out;
}

function pointInPolygon(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** For one shape, compute total length of edges that are "internal" — either
 * shared (collinear-overlapping) with another shape's edge, or falling inside
 * another shape's polygon. Used to exclude shared faces from window-area calc. */
export function computeInternalEdgeLength(shape: FloorShape, others: FloorShape[]): number {
  const ownPolys = shapeToPolygons(shape);
  const otherPolys: Pt[][] = [];
  for (const o of others) {
    if (o.id === shape.id) continue;
    for (const p of shapeToPolygons(o)) if (p.length >= 3) otherPolys.push(p);
  }
  if (otherPolys.length === 0) return 0;

  const SAMPLES = 20; // points per edge
  const TOL = 0.05;   // tolerance for collinearity / overlap (m)

  let totalInternal = 0;
  for (const poly of ownPolys) {
    const N = poly.length;
    for (let i = 0; i < N; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % N];
      const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (edgeLen < 0.01) continue;

      // Sample inside-ness at points slightly offset INWARD perpendicular to the edge
      const dx = (b.x - a.x) / edgeLen;
      const dy = (b.y - a.y) / edgeLen;
      const nx = -dy, ny = dx; // inward normal (assuming CCW outline; sign may flip but we test BOTH directions)
      let internalSamples = 0;
      for (let s = 1; s <= SAMPLES; s++) {
        const t = (s - 0.5) / SAMPLES;
        const px = a.x + t * (b.x - a.x);
        const py = a.y + t * (b.y - a.y);
        // Test both sides slightly offset to handle CW/CCW outlines
        for (const sign of [1, -1] as const) {
          const tx = px + sign * nx * TOL * 2;
          const ty = py + sign * ny * TOL * 2;
          let inside = false;
          for (const op of otherPolys) {
            if (pointInPolygon(tx, ty, op)) { inside = true; break; }
          }
          if (inside) { internalSamples++; break; }
        }
      }
      totalInternal += (internalSamples / SAMPLES) * edgeLen;
    }
  }
  return totalInternal;
}

/** Compute the union footprint area of all shapes via grid rasterization. */
export function floorUnionArea(shapes: FloorShape[], cellSize = 0.5): number {
  if (shapes.length === 0) return 0;
  const polys: Pt[][] = [];
  for (const s of shapes) {
    for (const poly of shapeToPolygons(s)) {
      if (poly.length >= 3) polys.push(poly);
    }
  }
  if (polys.length === 0) return 0;

  // Bounding box of all polygons
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const poly of polys) for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX, h = maxY - minY;
  if (w <= 0 || h <= 0) return 0;

  // Cap grid size to keep performance reasonable (~250×250 max)
  const cells = Math.ceil(w / cellSize) * Math.ceil(h / cellSize);
  let cs = cellSize;
  if (cells > 250 * 250) cs = Math.max(w, h) / 250;

  const nx = Math.ceil(w / cs);
  const ny = Math.ceil(h / cs);
  const cellArea = cs * cs;
  let inside = 0;
  for (let i = 0; i < nx; i++) {
    const cx = minX + (i + 0.5) * cs;
    for (let j = 0; j < ny; j++) {
      const cy = minY + (j + 0.5) * cs;
      for (const poly of polys) {
        if (pointInPolygon(cx, cy, poly)) { inside++; break; }
      }
    }
  }
  return inside * cellArea;
}
