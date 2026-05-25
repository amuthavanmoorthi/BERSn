import React from 'react';
import {
    WALL_CONSTRUCTIONS,
    ROOF_CONSTRUCTIONS,
    SHADING_TYPES,
    GLAZING_TYPES,
    getDisplayName,
} from '../data/bersnConfig';
import ModeBadge from './workspace/ModeBadge';

interface EnvelopeSettingsPanelProps {
    lang: 'zh' | 'en';
    selectedWall: string;
    onWallChange: (id: string) => void;
    selectedRoof: string;
    onRoofChange: (id: string) => void;
    selectedShading: string;
    onShadingChange: (id: string) => void;
    selectedGlazing: string;
    onGlazingChange: (id: string) => void;
}

const EnvelopeSettingsPanel: React.FC<EnvelopeSettingsPanelProps> = ({
    lang,
    selectedWall,
    onWallChange,
    selectedRoof,
    onRoofChange,
    selectedShading,
    onShadingChange,
    selectedGlazing,
    onGlazingChange,
}) => {
    const t = lang === 'zh';
    const sectionClass = "bg-[color:var(--color-card)] p-3 rounded-xl border border-[color:var(--color-border)] shadow-sm space-y-2";
    const titleClass = "text-[10px] font-black text-[color:var(--color-text)] uppercase tracking-wide flex items-center gap-2";
    const selectClass = "w-full p-1.5 bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-lg text-[9px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-400";

    const wallData = WALL_CONSTRUCTIONS.find(w => w.id === selectedWall);
    const roofData = ROOF_CONSTRUCTIONS.find(r => r.id === selectedRoof);
    const shadingData = SHADING_TYPES.find(s => s.id === selectedShading);
    const glazingData = GLAZING_TYPES.find(g => g.id === selectedGlazing);

    return (
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)] pr-1 custom-scrollbar">
            {/* Wall Construction */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    <span className="flex-1">{t ? '外牆構造' : 'Wall Construction'}</span>
                    <ModeBadge mode="manual" lang={lang} />
                </h3>
                <select
                    value={selectedWall}
                    onChange={(e) => onWallChange(e.target.value)}
                    className={selectClass}
                >
                    {WALL_CONSTRUCTIONS.map(item => (
                        <option key={item.id} value={item.id}>
                            {getDisplayName(item, lang)}
                        </option>
                    ))}
                </select>
                <div className="flex items-center gap-2 p-1.5 bg-amber-50 rounded-lg">
                    <ModeBadge mode="lookup" lang={lang} />
                    <span className="text-[8px] font-black text-amber-600 flex-1">U-value</span>
                    <span className="text-[10px] font-black text-amber-700">
                        {wallData?.uValue || 0} W/m²·K
                    </span>
                </div>
            </section>

            {/* Roof Construction */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
                    <span className="flex-1">{t ? '屋頂構造' : 'Roof Construction'}</span>
                    <ModeBadge mode="manual" lang={lang} />
                </h3>
                <select
                    value={selectedRoof}
                    onChange={(e) => onRoofChange(e.target.value)}
                    className={selectClass}
                >
                    {ROOF_CONSTRUCTIONS.map(item => (
                        <option key={item.id} value={item.id}>
                            {getDisplayName(item, lang)}
                        </option>
                    ))}
                </select>
                <div className="flex items-center gap-2 p-1.5 bg-[color:var(--color-bg)] rounded-lg">
                    <ModeBadge mode="lookup" lang={lang} />
                    <span className="text-[8px] font-black text-[color:var(--color-muted)] flex-1">U-value</span>
                    <span className="text-[10px] font-black text-[color:var(--color-text)]">
                        {roofData?.uValue || 0} W/m²·K
                    </span>
                </div>
            </section>

            {/* Shading Type */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                    <span className="flex-1">{t ? '外遮陽類型' : 'Shading Type'}</span>
                    <ModeBadge mode="manual" lang={lang} />
                </h3>
                <select
                    value={selectedShading}
                    onChange={(e) => onShadingChange(e.target.value)}
                    className={selectClass}
                >
                    {SHADING_TYPES.map(item => (
                        <option key={item.id} value={item.id}>
                            {getDisplayName(item, lang)} (Ki: {item.Ki})
                        </option>
                    ))}
                </select>
                <div className="flex items-center gap-2 p-1.5 bg-teal-50 rounded-lg">
                    <ModeBadge mode="lookup" lang={lang} />
                    <span className="text-[8px] font-black text-teal-600 flex-1">Ki ({t ? '遮陽係數' : 'Shading Coef.'})</span>
                    <span className="text-[10px] font-black text-teal-700">
                        {shadingData?.Ki || 1.0}
                    </span>
                </div>
            </section>

            {/* Glazing Type */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
                    <span className="flex-1">{t ? '玻璃類型' : 'Glazing Type'}</span>
                    <ModeBadge mode="manual" lang={lang} />
                </h3>
                <select
                    value={selectedGlazing}
                    onChange={(e) => onGlazingChange(e.target.value)}
                    className={selectClass}
                >
                    {GLAZING_TYPES.map(item => (
                        <option key={item.id} value={item.id}>
                            {getDisplayName(item, lang)}
                        </option>
                    ))}
                </select>
                <div className="grid grid-cols-2 gap-1 mt-1">
                    <div className="flex items-center gap-1.5 p-1.5 bg-sky-50 rounded-lg">
                        <ModeBadge mode="lookup" lang={lang} />
                        <span className="text-[7px] font-black text-sky-500 flex-1">Ug</span>
                        <span className="text-[9px] font-black text-sky-700">
                            {glazingData?.U || 0}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 bg-sky-50 rounded-lg">
                        <ModeBadge mode="lookup" lang={lang} />
                        <span className="text-[7px] font-black text-sky-500 flex-1">ηi</span>
                        <span className="text-[9px] font-black text-sky-700">
                            {glazingData?.eta_i || 0}
                        </span>
                    </div>
                </div>
            </section>

            {/* Envelope Summary */}
            <section className={sectionClass + " bg-gradient-to-br from-amber-900 to-slate-900 text-white border-amber-700"}>
                <h3 className="text-[10px] font-black uppercase tracking-wide text-amber-300 flex items-center gap-2">
                    <span className="flex-1">{t ? '外殼參數摘要' : 'Envelope Summary'}</span>
                    <ModeBadge mode="calculated" lang={lang} />
                </h3>
                <div className="space-y-1">
                    {[
                        { label: t ? '外牆 U' : 'Wall U', value: wallData?.uValue || 0, unit: 'W/m²·K', color: 'text-amber-400' },
                        { label: t ? '屋頂 U' : 'Roof U', value: roofData?.uValue || 0, unit: 'W/m²·K', color: 'text-[color:var(--color-muted)]' },
                        { label: 'Ki', value: shadingData?.Ki || 1.0, unit: '', color: 'text-teal-400' },
                        { label: 'Ug', value: glazingData?.U || 0, unit: 'W/m²·K', color: 'text-sky-400' },
                        { label: 'ηi', value: glazingData?.eta_i || 0, unit: '', color: 'text-sky-300' },
                    ].map(item => (
                        <div key={item.label} className="flex justify-between items-center text-[9px]">
                            <span className="text-[color:var(--color-muted)] font-bold">{item.label}</span>
                            <span className={`font-black ${item.color}`}>
                                {item.value.toFixed(2)}
                                {item.unit && <span className="text-[7px] text-[color:var(--color-muted)] ml-1">{item.unit}</span>}
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default EnvelopeSettingsPanel;
