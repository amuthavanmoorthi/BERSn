import React from 'react';
import {
    USE_CATEGORIES,
    EUI_TABLE,
    ES_TABLE,
    ELEVATOR_HEIGHT_CATEGORIES,
    ELEVATOR_TYPES,
    HVAC_SYSTEMS,
    LIGHTING_SYSTEMS,
    DHW_SYSTEMS,
    getDisplayName,
    UseCategoryId,
} from '../data/bersnConfig';

interface ParameterSettingsProps {
    lang: 'zh' | 'en';
    selectedUseCategory: UseCategoryId;
    onUseCategoryChange: (id: UseCategoryId) => void;
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

const ParameterSettingsPanel: React.FC<ParameterSettingsProps> = ({
    lang,
    selectedUseCategory,
    onUseCategoryChange,
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
    const euiData = EUI_TABLE[selectedUseCategory];
    const esValue = ES_TABLE[selectedUseCategory];

    const sectionClass = "bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2";
    const titleClass = "text-[10px] font-black text-slate-700 uppercase tracking-wide flex items-center gap-2";
    const labelClass = "text-[8px] font-black text-slate-400 uppercase";
    const selectClass = "w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-400";
    const valueClass = "text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded";

    return (
        <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-300px)] pr-1 custom-scrollbar">
            {/* Use Category Section */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    {t ? '建築用途類別' : 'Building Use Category'}
                </h3>
                <select
                    value={selectedUseCategory}
                    onChange={(e) => onUseCategoryChange(e.target.value as UseCategoryId)}
                    className={selectClass}
                >
                    {USE_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>
                            {getDisplayName(cat, lang)}
                        </option>
                    ))}
                </select>

                {/* EUI Display */}
                <div className="grid grid-cols-3 gap-1 mt-2">
                    <div className="text-center p-1.5 bg-blue-50 rounded-lg">
                        <div className="text-[7px] font-black text-blue-400 uppercase">AEUI</div>
                        <div className="text-[11px] font-black text-blue-600">{euiData.AEUI}</div>
                    </div>
                    <div className="text-center p-1.5 bg-emerald-50 rounded-lg">
                        <div className="text-[7px] font-black text-emerald-400 uppercase">LEUI</div>
                        <div className="text-[11px] font-black text-emerald-600">{euiData.LEUI}</div>
                    </div>
                    <div className="text-center p-1.5 bg-orange-50 rounded-lg">
                        <div className="text-[7px] font-black text-orange-400 uppercase">EEUI</div>
                        <div className="text-[11px] font-black text-orange-600">{euiData.EEUI}</div>
                    </div>
                </div>

                {/* Es Display */}
                <div className="flex justify-between items-center mt-1 p-1.5 bg-slate-50 rounded-lg">
                    <span className="text-[8px] font-black text-slate-400">
                        Es ({t ? '水耗標準' : 'Water Standard'})
                    </span>
                    <span className={valueClass}>{esValue.toFixed(2)}</span>
                </div>
            </section>

            {/* HVAC System Section */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                    {t ? '空調系統' : 'HVAC System'}
                </h3>
                <select
                    value={selectedHVAC}
                    onChange={(e) => onHVACChange(e.target.value)}
                    className={selectClass}
                >
                    {HVAC_SYSTEMS.map(sys => (
                        <option key={sys.id} value={sys.id}>
                            {getDisplayName(sys, lang)} (EAC: {sys.defaultEAC})
                        </option>
                    ))}
                </select>
                <div className="flex justify-between text-[8px] text-slate-400 px-1">
                    <span>EAC</span>
                    <span className="font-bold text-cyan-600">
                        {HVAC_SYSTEMS.find(s => s.id === selectedHVAC)?.defaultEAC || 1.0}
                    </span>
                </div>
            </section>

            {/* Lighting System Section */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    {t ? '照明系統' : 'Lighting System'}
                </h3>
                <select
                    value={selectedLighting}
                    onChange={(e) => onLightingChange(e.target.value)}
                    className={selectClass}
                >
                    {LIGHTING_SYSTEMS.map(sys => (
                        <option key={sys.id} value={sys.id}>
                            {getDisplayName(sys, lang)} (EL: {sys.defaultEL})
                        </option>
                    ))}
                </select>
                <div className="flex justify-between text-[8px] text-slate-400 px-1">
                    <span>EL</span>
                    <span className="font-bold text-yellow-600">
                        {LIGHTING_SYSTEMS.find(s => s.id === selectedLighting)?.defaultEL || 1.0}
                    </span>
                </div>
            </section>

            {/* Elevator Section */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    {t ? '電梯系統' : 'Elevator System'}
                </h3>
                <div className="space-y-2">
                    <div>
                        <label className={labelClass}>{t ? '電梯類型' : 'Type'}</label>
                        <select
                            value={selectedElevator}
                            onChange={(e) => onElevatorChange(e.target.value)}
                            className={selectClass}
                        >
                            {ELEVATOR_TYPES.map(type => (
                                <option key={type.id} value={type.id}>
                                    {getDisplayName(type, lang)} (Et: {type.EtValue})
                                </option>
                            ))}
                        </select>
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
                <div className="flex justify-between text-[8px] text-slate-400 px-1">
                    <span>Et</span>
                    <span className="font-bold text-purple-600">
                        {ELEVATOR_TYPES.find(t => t.id === selectedElevator)?.EtValue || 1.0}
                    </span>
                </div>
            </section>

            {/* DHW Section */}
            <section className={sectionClass}>
                <h3 className={titleClass}>
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    {t ? '熱水系統' : 'DHW System'}
                </h3>
                <select
                    value={selectedDHW}
                    onChange={(e) => onDHWChange(e.target.value)}
                    className={selectClass}
                >
                    {DHW_SYSTEMS.map(sys => (
                        <option key={sys.id} value={sys.id}>
                            {getDisplayName(sys, lang)} (EHW: {sys.EHW})
                        </option>
                    ))}
                </select>
                <div className="flex justify-between text-[8px] text-slate-400 px-1">
                    <span>EHW</span>
                    <span className="font-bold text-red-600">
                        {DHW_SYSTEMS.find(s => s.id === selectedDHW)?.EHW || 0}
                    </span>
                </div>
            </section>

            {/* Summary Table */}
            <section className={sectionClass + " bg-slate-900 text-white border-slate-700"}>
                <h3 className="text-[10px] font-black uppercase tracking-wide text-slate-300">
                    {t ? '計算參數摘要' : 'Parameter Summary'}
                </h3>
                <div className="space-y-1">
                    {[
                        { label: 'AEUI', value: euiData.AEUI, unit: 'kWh/m²·yr', color: 'text-blue-400' },
                        { label: 'LEUI', value: euiData.LEUI, unit: 'kWh/m²·yr', color: 'text-emerald-400' },
                        { label: 'EEUI', value: euiData.EEUI, unit: 'kWh/m²·yr', color: 'text-orange-400' },
                        { label: 'Es', value: esValue, unit: '', color: 'text-slate-300' },
                        { label: 'EAC', value: HVAC_SYSTEMS.find(s => s.id === selectedHVAC)?.defaultEAC || 1.0, unit: '', color: 'text-cyan-400' },
                        { label: 'EL', value: LIGHTING_SYSTEMS.find(s => s.id === selectedLighting)?.defaultEL || 1.0, unit: '', color: 'text-yellow-400' },
                        { label: 'Et', value: ELEVATOR_TYPES.find(t => t.id === selectedElevator)?.EtValue || 1.0, unit: '', color: 'text-purple-400' },
                        { label: 'EHW', value: DHW_SYSTEMS.find(s => s.id === selectedDHW)?.EHW || 0, unit: '', color: 'text-red-400' },
                    ].map(item => (
                        <div key={item.label} className="flex justify-between items-center text-[9px]">
                            <span className="text-slate-400 font-bold">{item.label}</span>
                            <span className={`font-black ${item.color}`}>
                                {typeof item.value === 'number' ? item.value.toFixed(2) : item.value}
                                {item.unit && <span className="text-[7px] text-slate-500 ml-1">{item.unit}</span>}
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default ParameterSettingsPanel;
