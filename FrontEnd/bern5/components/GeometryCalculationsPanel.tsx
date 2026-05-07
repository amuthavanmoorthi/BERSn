import React, { useMemo } from 'react';
import { GeometryObject, Floor } from '../types';
import type { GeometryPreviewMetrics } from '../types/project';
import { floorUnionArea, computeInternalEdgeLength } from '../services/areaUnion';

interface GeometryCalculationsProps {
    objects: GeometryObject[];
    floors?: Floor[];
    lang: 'zh' | 'en';
    selectedShading: string;
    backendMetrics?: GeometryPreviewMetrics | null;
    isBackendPreview?: boolean;
    previewError?: string;
    previewLoading?: boolean;
}

// Calculate geometry metrics from 3D objects
const calculateGeometryMetrics = (objects: GeometryObject[]) => {
    let totalWallNorth = 0, totalWallSouth = 0, totalWallEast = 0, totalWallWest = 0;
    let totalWinNorth = 0, totalWinSouth = 0, totalWinEast = 0, totalWinWest = 0;
    let totalRoofArea = 0;
    let totalWallArea = 0;
    let totalWindowArea = 0;

    objects.forEach(obj => {
        const p = obj.params;
        const height = p.height || 3.5;
        const wwr = p.wwr || 0.35;

        let objWallArea = 0;
        let objRoofArea = 0;

        switch (obj.type) {
            case 'box': {
                const width = p.width || 40;
                const length = p.length || 30;
                objWallArea = (width + length) * 2 * height;
                objRoofArea = width * length;
                break;
            }
            case 'lShape': {
                const l1 = p.l1 || 40, w1 = p.w1 || 20;
                const l2 = p.l2 || 20, w2 = p.w2 || 15;
                const perimeter = 2 * (l1 + w1) + 2 * (l2 + w2) - 2 * Math.min(w1, w2);
                objWallArea = perimeter * height;
                objRoofArea = l1 * w1 + l2 * w2;
                break;
            }
            case 'tShape': {
                const l1 = p.l1 || 40, w1 = p.w1 || 15;
                const l2 = p.l2 || 30, w2 = p.w2 || 20;
                const perimeter = 2 * (l1 + w1) + 2 * (l2 + w2) - 2 * Math.min(w1, l2);
                objWallArea = perimeter * height;
                objRoofArea = l1 * w1 + l2 * w2;
                break;
            }
            case 'cylinder': {
                const radius = p.radius || 15;
                objWallArea = 2 * Math.PI * radius * height;
                objRoofArea = Math.PI * radius * radius;
                break;
            }
            case 'ellipse': {
                const majorR = p.majorRadius || 25;
                const minorR = p.minorRadius || 15;
                const circumference = Math.PI * (3 * (majorR + minorR) - Math.sqrt((3 * majorR + minorR) * (majorR + 3 * minorR)));
                objWallArea = circumference * height;
                objRoofArea = Math.PI * majorR * minorR;
                break;
            }
            case 'arc': {
                // arcRadius = inner radius; depth extends outward
                const innerR = p.arcRadius || 30;
                const arcAngle = (p.arcAngle || 90) * Math.PI / 180;
                const depthVal = p.depth || 20;
                const outerR = innerR + depthVal;
                const perimeter = outerR * arcAngle + innerR * arcAngle + 2 * depthVal;
                objWallArea = perimeter * height;
                objRoofArea = (arcAngle / 2) * (outerR * outerR - innerR * innerR);
                break;
            }
            case 'fan': {
                const innerR = p.innerRadius || 10;
                const outerR = p.outerRadius || 30;
                const fanAngle = (p.fanAngle || 90) * Math.PI / 180;
                const perimeter = outerR * fanAngle + innerR * fanAngle + 2 * (outerR - innerR);
                objWallArea = perimeter * height;
                objRoofArea = (fanAngle / 2) * (outerR * outerR - innerR * innerR);
                break;
            }
            case 'polygon': {
                const sides = p.sides || 6;
                const circumR = p.circumradius || 20;
                const sideLen = 2 * circumR * Math.sin(Math.PI / sides);
                objWallArea = sides * sideLen * height;
                objRoofArea = 0.5 * sides * circumR * circumR * Math.sin(2 * Math.PI / sides);
                break;
            }
            case 'polyline': {
                const pts = p.points;
                if (pts && pts.length >= 3) {
                    // Shoelace formula for area
                    let area = 0;
                    for (let i = 0; i < pts.length; i++) {
                        const j = (i + 1) % pts.length;
                        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
                    }
                    objRoofArea = Math.abs(area) / 2;

                    // Perimeter-based wall area
                    const extH = p.extrudeHeight || height;
                    let perimeter = 0;
                    for (let i = 0; i < pts.length; i++) {
                        const j = (i + 1) % pts.length;
                        const dx = pts[j].x - pts[i].x;
                        const dy = pts[j].y - pts[i].y;
                        perimeter += Math.sqrt(dx * dx + dy * dy);
                    }
                    objWallArea = perimeter * extH;
                } else {
                    objWallArea = 0;
                    objRoofArea = 0;
                }
                break;
            }
            default: {
                const width = p.width || 40, length = p.length || 30;
                objWallArea = (width + length) * 2 * height;
                objRoofArea = width * length;
            }
        }

        // Distribute wall/window evenly to 4 orientations
        const qW = objWallArea / 4;
        const qWin = qW * wwr;
        totalWallNorth += qW; totalWinNorth += qWin;
        totalWallSouth += qW; totalWinSouth += qWin;
        totalWallEast += qW; totalWinEast += qWin;
        totalWallWest += qW; totalWinWest += qWin;

        totalRoofArea += objRoofArea;
        totalWallArea += objWallArea;
        totalWindowArea += objWallArea * wwr;
    });

    const overallWwr = totalWallArea > 0 ? totalWindowArea / totalWallArea : 0;

    return {
        wallNorth: totalWallNorth,
        wallSouth: totalWallSouth,
        wallEast: totalWallEast,
        wallWest: totalWallWest,
        totalWallArea,
        roofArea: totalRoofArea,
        wwr: overallWwr,
        winNorth: totalWinNorth,
        winSouth: totalWinSouth,
        winEast: totalWinEast,
        winWest: totalWinWest,
        totalWindowArea,
    };
};

// Shading coverage ratios based on type
const SHADING_COVERAGE: Record<string, number> = {
    'SH_NONE': 0,
    'SH_OVERHANG': 0.3,
    'SH_FIN': 0.2,
    'SH_EGGCRATE': 0.5,
    'SH_LOUVER': 0.4,
};

const GeometryCalculationsPanel: React.FC<GeometryCalculationsProps> = ({
    objects,
    floors,
    lang,
    selectedShading,
    backendMetrics,
    isBackendPreview,
    previewError,
    previewLoading,
}) => {
    const t = lang === 'zh';

    const metrics = useMemo(() => {
        if (isBackendPreview && backendMetrics) {
            return {
                wallNorth: backendMetrics.wallNorth,
                wallSouth: backendMetrics.wallSouth,
                wallEast: backendMetrics.wallEast,
                wallWest: backendMetrics.wallWest,
                winNorth: backendMetrics.winNorth,
                winSouth: backendMetrics.winSouth,
                winEast: backendMetrics.winEast,
                winWest: backendMetrics.winWest,
                totalWallArea: backendMetrics.totalWallArea,
                totalWindowArea: backendMetrics.totalWindowArea,
                roofArea: backendMetrics.roofArea,
                wwr: backendMetrics.overallWwr,
            };
        }
        const m = calculateGeometryMetrics(objects);
        if (floors && floors.length > 0) {
            // Roof area: per-floor union (avoid double-counting overlaps)
            const unionTotal = floors.reduce((sum, f) => sum + floorUnionArea(f.shapes), 0);
            // Window area: deduct shared / internal edge windows (faces that
            // overlap or sit inside another shape don't open windows).
            let internalWinDeduct = 0;
            for (const fl of floors) {
                for (const sh of fl.shapes) {
                    const internalLen = computeInternalEdgeLength(sh, fl.shapes);
                    if (internalLen <= 0) continue;
                    const wwr = sh.params.wwr ?? 0.35;
                    const h = (sh.params as any).extrudeHeight || fl.floorHeight || 3.5;
                    internalWinDeduct += internalLen * h * wwr;
                }
            }
            return {
                ...m,
                roofArea: unionTotal,
                totalWindowArea: Math.max(0, m.totalWindowArea - internalWinDeduct),
                wwr: m.totalWallArea > 0 ? Math.max(0, m.totalWindowArea - internalWinDeduct) / m.totalWallArea : 0,
            };
        }
        return m;
    }, [objects, floors, isBackendPreview, backendMetrics]);
    const shadingCoverage = SHADING_COVERAGE[selectedShading] || 0;

    const formatArea = (value: number) => value.toFixed(1);

    return (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl px-3 py-2 text-white">
            <div className="flex items-center gap-3">
                {/* Title */}
                <div className="flex items-center gap-1 shrink-0">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                    <span className="text-[12px] font-black uppercase tracking-wide text-blue-400">
                        {t ? '自動計算結果' : 'Auto-Calc'}
                    </span>
                </div>

                <div className="w-px h-6 bg-white/10 shrink-0" />

                {/* Wall/Window by orientation - compact */}
                {[
                    { label: t ? '北' : 'N', wall: metrics.wallNorth, win: metrics.winNorth, border: 'border-blue-500/30' },
                    { label: t ? '南' : 'S', wall: metrics.wallSouth, win: metrics.winSouth, border: 'border-orange-500/30' },
                    { label: t ? '東' : 'E', wall: metrics.wallEast, win: metrics.winEast, border: 'border-amber-500/30' },
                    { label: t ? '西' : 'W', wall: metrics.wallWest, win: metrics.winWest, border: 'border-purple-500/30' },
                ].map(item => (
                    <div key={item.label} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${item.border} bg-white/5`}>
                        <span className="text-[12px] font-black text-slate-300">{item.label}</span>
                        <div className="text-right">
                            <div className="text-[13px] font-black text-white leading-none">{formatArea(item.wall)}</div>
                            <div className="text-[12px] font-bold text-cyan-400 leading-none">{formatArea(item.win)}</div>
                        </div>
                    </div>
                ))}

                <div className="w-px h-6 bg-white/10 shrink-0" />

                {/* Totals */}
                <div className="flex items-center gap-3">
                    <div className="text-center">
                        <div className="text-[7px] text-slate-400 font-bold leading-none">{t ? '總牆面積' : 'Wall'}</div>
                        <div className="text-[12px] font-black text-white leading-tight">{formatArea(metrics.totalWallArea)}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[7px] text-slate-400 font-bold leading-none">{t ? '總窗面積' : 'Win'}</div>
                        <div className="text-[12px] font-black text-cyan-400 leading-tight">{formatArea(metrics.totalWindowArea)}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[7px] text-slate-400 font-bold leading-none">{t ? '屋頂面積' : 'Roof'}</div>
                        <div className="text-[12px] font-black text-amber-400 leading-tight">{formatArea(metrics.roofArea)}</div>
                    </div>
                </div>

                <div className="w-px h-6 bg-white/10 shrink-0" />

                {/* Ratios */}
                <div className="flex items-center gap-2">
                    <div className="px-2 py-1 bg-emerald-500/15 rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
                        <span className="text-[12px] font-bold text-emerald-400">WWR</span>
                        <span className="text-[12px] font-black text-emerald-300">{(metrics.wwr * 100).toFixed(0)}%</span>
                    </div>
                    <div className="px-2 py-1 bg-teal-500/15 rounded-lg border border-teal-500/30 flex items-center gap-1.5">
                        <span className="text-[12px] font-bold text-teal-400">{t ? '遮陽 Ki' : 'Shading Ki'}</span>
                        <span className="text-[12px] font-black text-teal-300">{(shadingCoverage * 100).toFixed(0)}%</span>
                    </div>
                </div>

                {/* EEV badge */}
                <span className="text-[7px] font-bold text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded ml-auto shrink-0">
                    {previewLoading ? (t ? '計算中...' : 'Calc...') : isBackendPreview ? 'BACKEND' : '→ EEV'}
                </span>
            </div>
            {previewError && (
                <div className="mt-1 text-[9px] font-bold text-red-300">
                    {previewError}
                </div>
            )}
        </div>
    );
};

export default GeometryCalculationsPanel;
