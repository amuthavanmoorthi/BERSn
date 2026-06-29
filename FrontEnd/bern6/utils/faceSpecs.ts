import { FloorShape } from '../types';

export interface FaceToggleSpec {
  key: string;
  label: string;
}

export const getFaceSpecs = (shape: FloorShape, lang: 'zh' | 'en'): FaceToggleSpec[] => {
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
    case 'ellipse':
      // Round shapes have no natural edge boundary — one face for the whole curve.
      return [{ key: 'side', label: t ? '曲面' : 'Curve' }];
    case 'polygon': {
      // A polygon has N flat edges, same as lShape/tShape — each gets its own face.
      const n = p.sides || 6;
      return Array.from({ length: n }, (_, i) => ({ key: `edge-${i}`, label: `${t ? '邊' : 'E'}${i + 1}` }));
    }
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
      // If freehand-drawn (p.points set), use actual point count; otherwise use fixed 6/8.
      const n = p.points?.length ?? (shape.type === 'lShape' ? 6 : 8);
      return Array.from({ length: n }, (_, i) => ({ key: `edge-${i}`, label: `${t ? '邊' : 'E'}${i + 1}` }));
    }
    default:
      return [];
  }
};
