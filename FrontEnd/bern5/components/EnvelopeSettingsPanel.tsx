import React from 'react';
import {
    WALL_CONSTRUCTIONS,
    ROOF_CONSTRUCTIONS,
    SHADING_TYPES,
    GLAZING_TYPES,
    getDisplayName,
} from '../data/bersnConfig';

import type { EnvelopeConfigLookup } from '../types/project';

type NamedSourceOption = {
    id: string;
    name: string;
    nameEn: string;
    source?: string;
};

type ThermalOption = NamedSourceOption & {
    uValue: number;
};

type ShadingOption = NamedSourceOption & {
    ki: number;
};

type GlazingOption = NamedSourceOption & {
    ug: number;
    etaI: number;
};

interface EnvelopeSettingsPanelProps {
    lang: 'zh' | 'en';
    lookups?: EnvelopeConfigLookup;
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
    lookups,
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
    const sectionClass = "bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2";
    const titleClass = "text-[10px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-2";
    const selectClass = "w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-400";
    const sourceClass = "text-[7px] font-bold text-slate-400";

    const wallOptions: ThermalOption[] = lookups?.wallConstructions?.length
        ? lookups.wallConstructions
        : WALL_CONSTRUCTIONS.map(item => ({ ...item, source: t ? '本機備援資料' : 'Local fallback data' }));
    const roofOptions: ThermalOption[] = lookups?.roofConstructions?.length
        ? lookups.roofConstructions
        : ROOF_CONSTRUCTIONS.map(item => ({ ...item, source: t ? '本機備援資料' : 'Local fallback data' }));
    const shadingOptions: ShadingOption[] = lookups?.shadingTypes?.length
        ? lookups.shadingTypes
        : SHADING_TYPES.map(item => ({ id: item.id, name: item.name, nameEn: item.nameEn, ki: item.Ki, source: t ? '本機備援資料' : 'Local fallback data' }));
    const glazingOptions: GlazingOption[] = lookups?.glazingTypes?.length
        ? lookups.glazingTypes
        : GLAZING_TYPES.map(item => ({ id: item.id, name: item.name, nameEn: item.nameEn, ug: item.U, etaI: item.eta_i, source: t ? '本機備援資料' : 'Local fallback data' }));

    const wallData = wallOptions.find(w => w.id === selectedWall);
    const roofData = roofOptions.find(r => r.id === selectedRoof);
    const shadingData = shadingOptions.find(s => s.id === selectedShading);
    const glazingData = glazingOptions.find(g => g.id === selectedGlazing);
    const sourceLabel = t ? '查表來源' : 'Lookup source';

    return (
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)] pr-1 custom-scrollbar">
            {/* Wall Construction */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    {t ? 'Step 3.1：外牆構造 / U 值' : 'Step 3.1: Wall Construction / U-value'}
                </h3>
                <select
                    value={selectedWall}
                    onChange={(e) => onWallChange(e.target.value)}
                    className={selectClass}
                >
                    {wallOptions.map(item => (
                        <option key={item.id} value={item.id}>
                            {getDisplayName(item, lang)}
                        </option>
                    ))}
                </select>
                <p className={sourceClass}>{sourceLabel}: {wallData?.source || (t ? '後端查表資料' : 'Backend lookup data')}</p>
                <div className="flex justify-between items-center p-1.5 bg-amber-50 rounded-lg">
                    <span className="text-[8px] font-black text-amber-600">{t ? '熱傳透率 U 值' : 'Thermal Transmittance U-value'}</span>
                    <span className="text-[10px] font-black text-amber-700">
                        {wallData?.uValue || 0} W/m²·K
                    </span>
                </div>
            </section>

            {/* Roof Construction */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-slate-500 rounded-full"></span>
                    {t ? 'Step 3.2：屋頂構造 / U 值' : 'Step 3.2: Roof Construction / U-value'}
                </h3>
                <select
                    value={selectedRoof}
                    onChange={(e) => onRoofChange(e.target.value)}
                    className={selectClass}
                >
                    {roofOptions.map(item => (
                        <option key={item.id} value={item.id}>
                            {getDisplayName(item, lang)}
                        </option>
                    ))}
                </select>
                <p className={sourceClass}>{sourceLabel}: {roofData?.source || (t ? '後端查表資料' : 'Backend lookup data')}</p>
                <div className="flex justify-between items-center p-1.5 bg-slate-100 rounded-lg">
                    <span className="text-[8px] font-black text-slate-500">{t ? '熱傳透率 U 值' : 'Thermal Transmittance U-value'}</span>
                    <span className="text-[10px] font-black text-slate-700">
                        {roofData?.uValue || 0} W/m²·K
                    </span>
                </div>
            </section>

            {/* Glazing Type */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
                    {t ? 'Step 3.3：玻璃性能 / Ug / ηi' : 'Step 3.3: Glazing / Ug / ηi'}
                </h3>
                <select
                    value={selectedGlazing}
                    onChange={(e) => onGlazingChange(e.target.value)}
                    className={selectClass}
                >
                    {glazingOptions.map(item => (
                        <option key={item.id} value={item.id}>
                            {getDisplayName(item, lang)}
                        </option>
                    ))}
                </select>
                <p className={sourceClass}>{sourceLabel}: {glazingData?.source || (t ? '後端查表資料' : 'Backend lookup data')}</p>
                <div className="grid grid-cols-2 gap-1 mt-1">
                    <div className="flex justify-between items-center p-1.5 bg-sky-50 rounded-lg">
                        <span className="text-[7px] font-black text-sky-500">{t ? '玻璃熱傳 Ug' : 'Glass U Ug'}</span>
                        <span className="text-[9px] font-black text-sky-700">
                            {glazingData?.ug || 0}
                        </span>
                    </div>
                    <div className="flex justify-between items-center p-1.5 bg-sky-50 rounded-lg">
                        <span className="text-[7px] font-black text-sky-500">{t ? '日射透過 ηi' : 'Solar Transmittance ηi'}</span>
                        <span className="text-[9px] font-black text-sky-700">
                            {glazingData?.etaI || 0}
                        </span>
                    </div>
                </div>
            </section>

            {/* Shading Type */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                    {t ? 'Step 3.4：外遮陽形式 / Ki' : 'Step 3.4: External Shading / Ki'}
                </h3>
                <select
                    value={selectedShading}
                    onChange={(e) => onShadingChange(e.target.value)}
                    className={selectClass}
                >
                    {shadingOptions.map(item => (
                        <option key={item.id} value={item.id}>
                            {getDisplayName(item, lang)} (Ki: {item.ki})
                        </option>
                    ))}
                </select>
                <p className={sourceClass}>{sourceLabel}: {shadingData?.source || (t ? '後端查表資料' : 'Backend lookup data')}</p>
                <div className="flex justify-between items-center p-1.5 bg-teal-50 rounded-lg">
                    <span className="text-[8px] font-black text-teal-600">{t ? '外遮陽係數 Ki' : 'External Shading Coefficient Ki'}</span>
                    <span className="text-[10px] font-black text-teal-700">
                        {shadingData?.ki || 1.0}
                    </span>
                </div>
            </section>

            {/* Envelope Summary */}
            <section className={sectionClass + " bg-gradient-to-br from-amber-900 to-slate-900 text-white border-amber-700"}>
                <h3 className="text-[10px] font-black uppercase tracking-wide text-amber-300">
                    {t ? '外殼參數摘要' : 'Envelope Summary'}
                </h3>
                <div className="space-y-1">
                    {[
                        { label: t ? '外牆熱傳 U' : 'Wall Thermal U', value: wallData?.uValue || 0, unit: 'W/m²·K', color: 'text-amber-400' },
                        { label: t ? '屋頂熱傳 U' : 'Roof Thermal U', value: roofData?.uValue || 0, unit: 'W/m²·K', color: 'text-slate-300' },
                        { label: t ? '外遮陽 Ki' : 'Shading Ki', value: shadingData?.ki || 1.0, unit: '', color: 'text-teal-400' },
                        { label: t ? '玻璃熱傳 Ug' : 'Glass U Ug', value: glazingData?.ug || 0, unit: 'W/m²·K', color: 'text-sky-400' },
                        { label: t ? '日射透過 ηi' : 'Solar ηi', value: glazingData?.etaI || 0, unit: '', color: 'text-sky-300' },
                    ].map(item => (
                        <div key={item.label} className="flex justify-between items-center text-[9px]">
                            <span className="text-slate-400 font-bold">{item.label}</span>
                            <span className={`font-black ${item.color}`}>
                                {item.value.toFixed(2)}
                                {item.unit && <span className="text-[7px] text-slate-500 ml-1">{item.unit}</span>}
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default EnvelopeSettingsPanel;
