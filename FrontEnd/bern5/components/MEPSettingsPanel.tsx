import React from 'react';
import {
    HVAC_SYSTEMS,
    LIGHTING_SYSTEMS,
    ELEVATOR_TYPES,
    DHW_SYSTEMS,
    getDisplayName,
} from '../data/bersnConfig';

import type { MepConfigLookup } from '../types/project';

type NamedSourceOption = {
    id: string;
    name: string;
    nameEn: string;
    source?: string;
};

type HvacOption = NamedSourceOption & {
    eac: number;
};

type LightingOption = NamedSourceOption & {
    el: number;
};

type ElevatorOption = NamedSourceOption & {
    et: number;
};

type DhwOption = NamedSourceOption & {
    ehw: number;
};

interface MEPSettingsPanelProps {
    lang: 'zh' | 'en';
    lookups?: MepConfigLookup;
    selectedHVAC: string;
    onHVACChange: (id: string) => void;
    selectedLighting: string;
    onLightingChange: (id: string) => void;
    selectedElevator: string;
    onElevatorChange: (id: string) => void;
    selectedDHW: string;
    onDHWChange: (id: string) => void;
    elevatorCount: number;
    onElevatorCountChange: (count: number) => void;
}

const MEPSettingsPanel: React.FC<MEPSettingsPanelProps> = ({
    lang,
    lookups,
    selectedHVAC,
    onHVACChange,
    selectedLighting,
    onLightingChange,
    selectedElevator,
    onElevatorChange,
    selectedDHW,
    onDHWChange,
    elevatorCount,
    onElevatorCountChange,
}) => {
    const t = lang === 'zh';
    const sectionClass = "bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2";
    const titleClass = "text-[10px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-2";
    const labelClass = "text-[8px] font-black text-slate-400 uppercase";
    const selectClass = "w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-400";
    const sourceClass = "text-[7px] font-bold text-slate-400";
    const sourceLabel = t ? '查表來源' : 'Lookup source';

    const hvacOptions: HvacOption[] = lookups?.hvacSystems?.length
        ? lookups.hvacSystems
        : HVAC_SYSTEMS.map(item => ({ id: item.id, name: item.name, nameEn: item.nameEn, eac: item.defaultEAC, source: t ? '本機備援資料' : 'Local fallback data' }));
    const lightingOptions: LightingOption[] = lookups?.lightingSystems?.length
        ? lookups.lightingSystems
        : LIGHTING_SYSTEMS.map(item => ({ id: item.id, name: item.name, nameEn: item.nameEn, el: item.defaultEL, source: t ? '本機備援資料' : 'Local fallback data' }));
    const elevatorOptions: ElevatorOption[] = lookups?.elevatorTypes?.length
        ? lookups.elevatorTypes
        : ELEVATOR_TYPES.map(item => ({ id: item.id, name: item.name, nameEn: item.nameEn, et: item.EtValue, source: t ? '本機備援資料' : 'Local fallback data' }));
    const dhwOptions: DhwOption[] = lookups?.dhwSystems?.length
        ? lookups.dhwSystems
        : DHW_SYSTEMS.map(item => ({ id: item.id, name: item.name, nameEn: item.nameEn, ehw: item.EHW, source: t ? '本機備援資料' : 'Local fallback data' }));

    const hvacData = hvacOptions.find(s => s.id === selectedHVAC);
    const lightingData = lightingOptions.find(s => s.id === selectedLighting);
    const elevatorData = elevatorOptions.find(s => s.id === selectedElevator);
    const dhwData = dhwOptions.find(s => s.id === selectedDHW);

    return (
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)] pr-1 custom-scrollbar">
            {/* HVAC System Section */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                    {t ? 'Step 4.1：空調系統 / EAC' : 'Step 4.1: HVAC / EAC'}
                </h3>
                <select
                    value={selectedHVAC}
                    onChange={(e) => onHVACChange(e.target.value)}
                    className={selectClass}
                >
                    {hvacOptions.map(sys => (
                        <option key={sys.id} value={sys.id}>
                            {getDisplayName(sys, lang)}
                        </option>
                    ))}
                </select>
                <p className={sourceClass}>{sourceLabel}: {hvacData?.source || (t ? '後端查表資料' : 'Backend lookup data')}</p>
                <div className="flex justify-between items-center p-1.5 bg-cyan-50 rounded-lg">
                    <span className="text-[8px] font-black text-cyan-600">{t ? '空調節能效率 EAC' : 'HVAC Efficiency EAC'}</span>
                    <span className="text-[10px] font-black text-cyan-700">
                        {hvacData?.eac || 1.0}
                    </span>
                </div>
            </section>

            {/* Lighting System Section */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    {t ? 'Step 4.2：照明系統 / EL' : 'Step 4.2: Lighting / EL'}
                </h3>
                <select
                    value={selectedLighting}
                    onChange={(e) => onLightingChange(e.target.value)}
                    className={selectClass}
                >
                    {lightingOptions.map(sys => (
                        <option key={sys.id} value={sys.id}>
                            {getDisplayName(sys, lang)}
                        </option>
                    ))}
                </select>
                <p className={sourceClass}>{sourceLabel}: {lightingData?.source || (t ? '後端查表資料' : 'Backend lookup data')}</p>
                <div className="flex justify-between items-center p-1.5 bg-yellow-50 rounded-lg">
                    <span className="text-[8px] font-black text-yellow-600">{t ? '照明節能效率 EL' : 'Lighting Efficiency EL'}</span>
                    <span className="text-[10px] font-black text-yellow-700">
                        {lightingData?.el || 1.0}
                    </span>
                </div>
            </section>

            {/* Elevator Section */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    {t ? 'Step 4.3：電梯系統 / Et' : 'Step 4.3: Elevator / Et'}
                </h3>
                <div className="space-y-2">
                    <div>
                        <label className={labelClass}>{t ? '電梯類型' : 'Type'}</label>
                        <select
                            value={selectedElevator}
                            onChange={(e) => onElevatorChange(e.target.value)}
                            className={selectClass}
                        >
                            {elevatorOptions.map(type => (
                                <option key={type.id} value={type.id}>
                                    {getDisplayName(type, lang)}
                                </option>
                            ))}
                        </select>
                        <p className={sourceClass}>{sourceLabel}: {elevatorData?.source || (t ? '後端查表資料' : 'Backend lookup data')}</p>
                    </div>
                    <div>
                        <label className={labelClass}>{t ? '電梯數量' : 'Count'}</label>
                        <input
                            type="number"
                            min="0"
                            value={elevatorCount}
                            onChange={(e) => onElevatorCountChange(parseInt(e.target.value) || 0)}
                            className={selectClass}
                        />
                    </div>
                </div>
                <div className="flex justify-between items-center p-1.5 bg-purple-50 rounded-lg">
                    <span className="text-[8px] font-black text-purple-600">{t ? '電梯節能效率 Et' : 'Elevator Efficiency Et'}</span>
                    <span className="text-[10px] font-black text-purple-700">
                        {elevatorData?.et || 1.0}
                    </span>
                </div>
            </section>

            {/* DHW Section */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    {t ? 'Step 4.4：中央熱水 / EHW' : 'Step 4.4: Central Hot Water / EHW'}
                </h3>
                <select
                    value={selectedDHW}
                    onChange={(e) => onDHWChange(e.target.value)}
                    className={selectClass}
                >
                    {dhwOptions.map(sys => (
                        <option key={sys.id} value={sys.id}>
                            {getDisplayName(sys, lang)}
                        </option>
                    ))}
                </select>
                <p className={sourceClass}>{sourceLabel}: {dhwData?.source || (t ? '後端查表資料' : 'Backend lookup data')}</p>
                <div className="flex justify-between items-center p-1.5 bg-red-50 rounded-lg">
                    <span className="text-[8px] font-black text-red-600">{t ? '熱水節能效率 EHW' : 'Hot Water Efficiency EHW'}</span>
                    <span className="text-[10px] font-black text-red-700">
                        {dhwData?.ehw || 0}
                    </span>
                </div>
            </section>

            {/* MEP Summary */}
            <section className={sectionClass + " bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700"}>
                <h3 className="text-[10px] font-black uppercase tracking-wide text-slate-300">
                    {t ? 'MEP 參數摘要' : 'MEP Summary'}
                </h3>
                <div className="space-y-1">
                    {[
                        { label: t ? '空調效率 EAC' : 'HVAC EAC', value: hvacData?.eac || 1.0, color: 'text-cyan-400' },
                        { label: t ? '照明效率 EL' : 'Lighting EL', value: lightingData?.el || 1.0, color: 'text-yellow-400' },
                        { label: t ? '電梯效率 Et' : 'Elevator Et', value: elevatorData?.et || 1.0, color: 'text-purple-400' },
                        { label: t ? '熱水效率 EHW' : 'Hot Water EHW', value: dhwData?.ehw || 0, color: 'text-red-400' },
                    ].map(item => (
                        <div key={item.label} className="flex justify-between items-center text-[9px]">
                            <span className="text-slate-400 font-bold">{item.label}</span>
                            <span className={`font-black ${item.color}`}>
                                {item.value.toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default MEPSettingsPanel;
