import React from 'react';
import { GeometryObject, GeometryType, LShapeDirection, TShapeWingPosition } from '../types';

interface GeometryControlPanelProps {
    activeObj: GeometryObject;
    onUpdate: (updates: Partial<GeometryObject['params']>) => void;
    onTypeChange: (type: GeometryType) => void;
    lang: 'zh' | 'en';
}

const GEOMETRY_LABELS: Record<GeometryType, { zh: string; en: string }> = {
    box: { zh: '長方體/稜柱體', en: 'Box/Prism' },
    lShape: { zh: 'L形複合體', en: 'L-Shape' },
    tShape: { zh: 'T形複合體', en: 'T-Shape' },
    cylinder: { zh: '圓柱體', en: 'Cylinder' },
    arc: { zh: '圓弧拉伸體', en: 'Arc Extrusion' },
    ellipse: { zh: '橢圓柱/橢圓拉伸', en: 'Ellipse' },
    fan: { zh: '扇形/扇形拉伸', en: 'Fan/Sector' },
    polygon: { zh: '多邊形拉伸', en: 'Polygon Extrusion' },
    polyline: { zh: '折線輪廓拉伸', en: 'Polyline Extrusion' },
};

const GeometryControlPanel: React.FC<GeometryControlPanelProps> = ({
    activeObj,
    onUpdate,
    onTypeChange,
    lang,
}) => {
    const t = lang === 'zh';

    const inputClass = "p-2 bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-white focus:bg-white focus:text-slate-900 outline-none transition-all text-center w-full";
    const labelClass = "text-[8px] font-black text-slate-400 uppercase tracking-wide";

    // Render inputs based on geometry type
    const renderTypeSpecificInputs = () => {
        switch (activeObj.type) {
            case 'box':
                return (
                    <>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '長度 (L)' : 'Length'}</label>
                            <input type="number" value={activeObj.params.length || 30} onChange={(e) => onUpdate({ length: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '寬度 (W)' : 'Width'}</label>
                            <input type="number" value={activeObj.params.width || 40} onChange={(e) => onUpdate({ width: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '高度 (H)' : 'Height'}</label>
                            <input type="number" value={activeObj.params.height} onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                    </>
                );

            case 'lShape':
                return (
                    <>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '主體長度 (L1)' : 'Main L'}</label>
                            <input type="number" value={activeObj.params.l1 || 40} onChange={(e) => onUpdate({ l1: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '主體寬度 (W1)' : 'Main W'}</label>
                            <input type="number" value={activeObj.params.w1 || 20} onChange={(e) => onUpdate({ w1: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '次體長度 (L2)' : 'Ext L'}</label>
                            <input type="number" value={activeObj.params.l2 || 20} onChange={(e) => onUpdate({ l2: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '次體寬度 (W2)' : 'Ext W'}</label>
                            <input type="number" value={activeObj.params.w2 || 15} onChange={(e) => onUpdate({ w2: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '高度' : 'Height'}</label>
                            <input type="number" value={activeObj.params.height} onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '轉折方向' : 'Direction'}</label>
                            <select value={activeObj.params.lDirection || 'right'} onChange={(e) => onUpdate({ lDirection: e.target.value as LShapeDirection })} className={inputClass}>
                                <option value="left">{t ? '左' : 'Left'}</option>
                                <option value="right">{t ? '右' : 'Right'}</option>
                            </select>
                        </div>
                    </>
                );

            case 'tShape':
                return (
                    <>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '主幹長度 (L1)' : 'Main L'}</label>
                            <input type="number" value={activeObj.params.l1 || 40} onChange={(e) => onUpdate({ l1: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '主幹寬度 (W1)' : 'Main W'}</label>
                            <input type="number" value={activeObj.params.w1 || 15} onChange={(e) => onUpdate({ w1: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '翼部長度 (L2)' : 'Wing L'}</label>
                            <input type="number" value={activeObj.params.l2 || 30} onChange={(e) => onUpdate({ l2: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '翼部寬度 (W2)' : 'Wing W'}</label>
                            <input type="number" value={activeObj.params.w2 || 20} onChange={(e) => onUpdate({ w2: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '高度' : 'Height'}</label>
                            <input type="number" value={activeObj.params.height} onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '翼部位置' : 'Wing Pos'}</label>
                            <select value={activeObj.params.wingPosition || 'center'} onChange={(e) => onUpdate({ wingPosition: e.target.value as TShapeWingPosition })} className={inputClass}>
                                <option value="center">{t ? '中央' : 'Center'}</option>
                                <option value="left">{t ? '左側' : 'Left'}</option>
                                <option value="right">{t ? '右側' : 'Right'}</option>
                            </select>
                        </div>
                    </>
                );

            case 'cylinder':
                return (
                    <>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '半徑 (R)' : 'Radius'}</label>
                            <input type="number" value={activeObj.params.radius || 15} onChange={(e) => onUpdate({ radius: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '高度 (H)' : 'Height'}</label>
                            <input type="number" value={activeObj.params.height} onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                    </>
                );

            case 'arc':
                return (
                    <>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '圓弧半徑' : 'Arc R'}</label>
                            <input type="number" value={activeObj.params.arcRadius || 30} onChange={(e) => onUpdate({ arcRadius: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '圓弧角度 (°)' : 'Arc Angle'}</label>
                            <input type="number" value={activeObj.params.arcAngle || 90} onChange={(e) => onUpdate({ arcAngle: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '拉伸深度' : 'Depth'}</label>
                            <input type="number" value={activeObj.params.depth || 20} onChange={(e) => onUpdate({ depth: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '高度' : 'Height'}</label>
                            <input type="number" value={activeObj.params.height} onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                    </>
                );

            case 'ellipse':
                return (
                    <>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '長軸半徑' : 'Major R'}</label>
                            <input type="number" value={activeObj.params.majorRadius || 25} onChange={(e) => onUpdate({ majorRadius: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '短軸半徑' : 'Minor R'}</label>
                            <input type="number" value={activeObj.params.minorRadius || 15} onChange={(e) => onUpdate({ minorRadius: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '高度' : 'Height'}</label>
                            <input type="number" value={activeObj.params.height} onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                    </>
                );

            case 'fan':
                return (
                    <>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '內半徑' : 'Inner R'}</label>
                            <input type="number" value={activeObj.params.innerRadius || 10} onChange={(e) => onUpdate({ innerRadius: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '外半徑' : 'Outer R'}</label>
                            <input type="number" value={activeObj.params.outerRadius || 30} onChange={(e) => onUpdate({ outerRadius: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '扇形角度 (°)' : 'Fan Angle'}</label>
                            <input type="number" value={activeObj.params.fanAngle || 90} onChange={(e) => onUpdate({ fanAngle: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>{t ? '高度' : 'Height'}</label>
                            <input type="number" value={activeObj.params.height} onChange={(e) => onUpdate({ height: parseFloat(e.target.value) || 0 })} className={inputClass} />
                        </div>
                    </>
                );
        }
    };

    return (
        <div className="p-4 bg-slate-900 rounded-xl text-white space-y-4">
            {/* Top Row: Type Selector + Common Controls */}
            <div className="flex flex-wrap gap-3 items-end">
                {/* Geometry Type Selector */}
                <div className="space-y-1 min-w-[140px]">
                    <label className="text-[8px] font-black text-blue-400 uppercase tracking-wide">
                        {t ? '幾何形狀' : 'Geometry Type'}
                    </label>
                    <select
                        value={activeObj.type}
                        onChange={(e) => onTypeChange(e.target.value as GeometryType)}
                        className={inputClass}
                    >
                        {Object.entries(GEOMETRY_LABELS).map(([value, labels]) => (
                            <option key={value} value={value}>
                                {t ? labels.zh : labels.en}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Azimuth/Orientation */}
                <div className="space-y-1 min-w-[80px]">
                    <label className="text-[8px] font-black text-purple-400 uppercase tracking-wide">
                        {t ? '方位角 (°)' : 'Azimuth'}
                    </label>
                    <input
                        type="number"
                        value={activeObj.params.azimuth || 0}
                        onChange={(e) => onUpdate({ azimuth: parseFloat(e.target.value) || 0 })}
                        className={inputClass}
                    />
                </div>

                {/* WWR */}
                <div className="space-y-1 flex-1 min-w-[150px]">
                    <label className="text-[8px] font-black text-orange-400 uppercase tracking-wide">
                        {t ? '開窗率' : 'WWR'} %
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="0"
                            max="0.9"
                            step="0.05"
                            value={activeObj.params.wwr || 0.35}
                            onChange={(e) => onUpdate({ wwr: parseFloat(e.target.value) })}
                            className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500"
                        />
                        <span className="text-sm font-black text-white bg-white/10 px-2 py-1 rounded-lg min-w-[45px] text-center">
                            {((activeObj.params.wwr || 0) * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Type-Specific Parameters - Grid Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {renderTypeSpecificInputs()}
            </div>
        </div>
    );
};

export default GeometryControlPanel;

