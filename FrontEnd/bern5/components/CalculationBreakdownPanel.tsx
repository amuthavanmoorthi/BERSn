import React from 'react';

interface CalcStep {
    id: string;
    title: string;
    formula: string;
    inputs: { label: string; value: string | number; unit?: string }[];
    result: { label: string; value: number | string; unit?: string };
    status: 'complete' | 'warning' | 'error';
    note?: string;
}

interface CalculationBreakdownPanelProps {
    kpis: any;
    lang: 'zh' | 'en';
}

const CalculationBreakdownPanel: React.FC<CalculationBreakdownPanelProps> = ({ kpis, lang }) => {
    const t = lang === 'zh' ? {
        title: '計算過程詳解',
        subtitle: 'Calculation Breakdown',
        step1: '有效冷房面積',
        step2: '外殼效率',
        step3: '權重係數',
        step4: '能效指標',
        step5: '能效得分',
        step6: '能效等級',
        formula: '公式',
        result: '結果',
        af: '總樓地板面積',
        exempt: '免計面積',
        afe: '有效面積',
        eev: 'EEV值',
        weights: '權重',
        eei: 'EEI',
        score: '得分',
        grade: '等級',
    } : {
        title: 'Calculation Breakdown',
        subtitle: '9-Step Process',
        step1: 'Effective Area',
        step2: 'Envelope Efficiency',
        step3: 'Weight Coefficients',
        step4: 'Energy Index',
        step5: 'Energy Score',
        step6: 'Energy Grade',
        formula: 'Formula',
        result: 'Result',
        af: 'Total Floor Area',
        exempt: 'Exempt Area',
        afe: 'Effective Area',
        eev: 'EEV',
        weights: 'Weights',
        eei: 'EEI',
        score: 'Score',
        grade: 'Grade',
    };

    const steps: CalcStep[] = [
        {
            id: 'afe',
            title: `1. ${t.step1} (AFe)`,
            formula: 'AFe = AF − ΣAfk',
            inputs: [
                { label: `${t.af} (AF)`, value: kpis.af?.toLocaleString() || '5,000', unit: 'm²' },
                { label: `${t.exempt} (ΣAfk)`, value: kpis.exemptTotal?.toLocaleString() || '1,000', unit: 'm²' },
            ],
            result: { label: `${t.afe} (AFe)`, value: kpis.afe, unit: 'm²' },
            status: kpis.afe > 0 ? 'complete' : 'error',
        },
        {
            id: 'eev',
            title: `2. ${t.step2} (EEV)`,
            formula: 'EEV = Σ(U×A×η×Ki) / ΣA',
            inputs: [
                { label: lang === 'zh' ? '外牆熱傳 U' : 'Wall Thermal U', value: '1.8', unit: 'W/m²K' },
                { label: lang === 'zh' ? '玻璃熱傳 Ug' : 'Glass U Ug', value: kpis.glassU?.toFixed(1) || '2.8', unit: 'W/m²K' },
                { label: lang === 'zh' ? '日射透過 ηi' : 'Solar Transmittance ηi', value: kpis.eta?.toFixed(2) || '0.70' },
                { label: lang === 'zh' ? '外遮陽係數 Ki' : 'External Shading Coefficient Ki', value: kpis.shadingKi?.toFixed(2) || '1.00' },
            ],
            result: { label: lang === 'zh' ? '外殼節能效率 EEV' : 'Envelope Efficiency EEV', value: kpis.eev?.toFixed(3) || '1.000', unit: '' },
            status: kpis.eev < 1.5 ? 'complete' : 'warning',
        },
        {
            id: 'weights',
            title: `3. ${t.step3} (a,b,c)`,
            formula: 'a=AEUI/Σ, b=LEUI/Σ, c=EtEUI/Σ',
            inputs: [
                { label: lang === 'zh' ? '空調權重 a（AEUI）' : 'HVAC Weight a (AEUI)', value: kpis.weights?.a?.toFixed(3) || '0.789' },
                { label: lang === 'zh' ? '照明權重 b（LEUI）' : 'Lighting Weight b (LEUI)', value: kpis.weights?.b?.toFixed(3) || '0.184' },
                { label: lang === 'zh' ? '電梯權重 c（EtEUI）' : 'Elevator Weight c (EtEUI)', value: kpis.weights?.c?.toFixed(3) || '0.026' },
            ],
            result: { label: 'Σ', value: '1.000', unit: '' },
            status: 'complete',
        },
        {
            id: 'mep',
            title: lang === 'zh' ? '4. 機電效率（EAC、EL、Et）' : '4. MEP Efficiency (EAC, EL, Et)',
            formula: 'EAC = f(COP, η_aux)',
            inputs: [
                { label: lang === 'zh' ? '空調節能效率 EAC' : 'HVAC Efficiency EAC', value: kpis.mepResults?.eac?.toFixed(3) || '0.850' },
                { label: lang === 'zh' ? '照明節能效率 EL' : 'Lighting Efficiency EL', value: kpis.mepResults?.el?.toFixed(3) || '0.900' },
                { label: lang === 'zh' ? '電梯節能效率 Et' : 'Elevator Efficiency Et', value: kpis.mepResults?.et?.toFixed(3) || '0.600' },
            ],
            result: { label: lang === 'zh' ? '機電參數' : 'MEP Parameters', value: 'Ready', unit: '' },
            status: 'complete',
        },
        {
            id: 'eei',
            title: `5. ${t.step4} (EEI)`,
            formula: 'EEI = a(EAC−EEV×Es) + bEL + cEt',
            inputs: [
                { label: lang === 'zh' ? '空調項 a(EAC−EEV×Es)' : 'HVAC Term a(EAC−EEV×Es)', value: kpis.breakdown?.hvac?.toFixed(4) || '0.000' },
                { label: lang === 'zh' ? '照明項 bEL' : 'Lighting Term bEL', value: kpis.breakdown?.lighting?.toFixed(4) || '0.000' },
                { label: lang === 'zh' ? '電梯項 cEt' : 'Elevator Term cEt', value: kpis.breakdown?.elevator?.toFixed(4) || '0.000' },
            ],
            result: { label: lang === 'zh' ? '能效指標 EEI' : 'Energy Efficiency Index EEI', value: kpis.eei, unit: '' },
            status: kpis.eei <= 0.8 ? 'complete' : kpis.eei <= 1.0 ? 'warning' : 'error',
        },
        {
            id: 'score',
            title: `6. ${t.step5} (SCOREee)`,
            formula: kpis.eei <= 0.8
                ? 'SCOREee = 50 + 40×(0.8−EEI)/0.3'
                : 'SCOREee = 50×(2.0−EEI)/1.2',
            inputs: [
                { label: lang === 'zh' ? '能效指標 EEI' : 'Energy Efficiency Index EEI', value: kpis.eei?.toFixed(3) || '0.000' },
                { label: lang === 'zh' ? '公式類型' : 'Formula', value: kpis.eei <= 0.8 ? '高效型' : '一般型' },
            ],
            result: { label: lang === 'zh' ? '能效得分 SCOREee' : 'Energy Score SCOREee', value: kpis.score, unit: lang === 'zh' ? '分' : 'pts' },
            status: 'complete',
        },
        {
            id: 'grade',
            title: `7. ${t.step6}`,
            formula: 'Grade = f(EEI)',
            inputs: [
                { label: '1+ (NZCB)', value: 'EEI ≤ 0.50' },
                { label: '1', value: 'EEI ≤ 0.60' },
                { label: '2', value: 'EEI ≤ 0.70' },
                { label: '3', value: 'EEI ≤ 0.80' },
                { label: '4', value: 'EEI ≤ 1.00' },
            ],
            result: { label: t.grade, value: kpis.grade, unit: '' },
            status: 'complete',
        },
        {
            id: 'esr',
            title: `8. 節能率 (ESR)`,
            formula: 'ESR = (1 − EEI) × 100%',
            inputs: [
                { label: lang === 'zh' ? '能效指標 EEI' : 'Energy Efficiency Index EEI', value: kpis.eei?.toFixed(3) || '0.000' },
            ],
            result: { label: lang === 'zh' ? '節能率 ESR' : 'Energy Saving Rate ESR', value: kpis.esr?.toFixed(1) || '0.0', unit: '%' },
            status: kpis.esr >= 50 ? 'complete' : kpis.esr >= 20 ? 'warning' : 'error',
        },
        {
            id: 'eui',
            title: `9. EUI 基準尺標`,
            formula: 'EUIx = UR × (factor × ΣEUI + EEUI)',
            inputs: [
                { label: lang === 'zh' ? '近零碳基準 EUI-n' : 'Near-Zero Baseline EUI-n', value: kpis.euiN?.toFixed(0) || '0', unit: 'kWh/m²' },
                { label: lang === 'zh' ? '優良基準 EUI-g' : 'Good Baseline EUI-g', value: kpis.euiG?.toFixed(0) || '0', unit: 'kWh/m²' },
                { label: lang === 'zh' ? '合格基準 EUI-m' : 'Median Baseline EUI-m', value: kpis.euiM?.toFixed(0) || '0', unit: 'kWh/m²' },
            ],
            result: { label: lang === 'zh' ? '最大基準 EUI-max' : 'Maximum Baseline EUI-max', value: kpis.euiMax?.toFixed(0) || '0', unit: 'kWh/m²' },
            status: 'complete',
        },
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'complete': return 'bg-emerald-500';
            case 'warning': return 'bg-amber-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-slate-400';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'complete': return 'border-emerald-200 bg-emerald-50/50';
            case 'warning': return 'border-amber-200 bg-amber-50/50';
            case 'error': return 'border-red-200 bg-red-50/50';
            default: return 'border-slate-200 bg-slate-50';
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h4 className="text-sm font-black text-slate-600 uppercase tracking-widest">{t.title}</h4>
                    <p className="text-[10px] text-slate-400">{t.subtitle}</p>
                </div>
                <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                    {steps.length} Steps
                </span>
            </div>

            <div className="space-y-2.5 max-h-[calc(100vh-400px)] overflow-y-auto pr-1 custom-scrollbar">
                {steps.map((step, idx) => (
                    <div
                        key={step.id}
                        className={`rounded-xl border p-2.5 transition-all hover:shadow-sm ${getStatusBg(step.status)}`}
                    >
                        {/* Header */}
                        <div className="flex items-start gap-2 mb-2">
                            <div className={`w-5 h-5 rounded-full ${getStatusColor(step.status)} flex items-center justify-center text-white text-[10px] font-black flex-shrink-0`}>
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-black text-[11px] text-slate-700 truncate">{step.title}</div>
                                <div className="text-[9px] font-mono text-slate-400 truncate">{step.formula}</div>
                            </div>
                        </div>

                        {/* Inputs */}
                        <div className="ml-7 space-y-1 mb-2">
                            {step.inputs.slice(0, 3).map((inp, i) => (
                                <div key={i} className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 truncate">{inp.label}</span>
                                    <span className="font-bold text-slate-600 flex-shrink-0">
                                        {inp.value}{inp.unit ? ` ${inp.unit}` : ''}
                                    </span>
                                </div>
                            ))}
                            {step.inputs.length > 3 && (
                                <div className="text-[8px] text-slate-400">+{step.inputs.length - 3} more...</div>
                            )}
                        </div>

                        {/* Result */}
                        <div className="ml-7 flex justify-between items-center pt-2 border-t border-slate-200/50">
                            <span className="text-[10px] font-bold text-slate-500">{step.result.label}</span>
                            <span className={`text-[12px] font-black ${step.status === 'complete' ? 'text-emerald-600' :
                                step.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                {typeof step.result.value === 'number'
                                    ? step.result.value.toFixed?.(3) ?? step.result.value
                                    : step.result.value}
                                {step.result.unit ? ` ${step.result.unit}` : ''}
                            </span>
                        </div>

                        {/* Warning Note */}
                        {step.note && (
                            <div className="ml-6 mt-1 text-[6px] text-amber-700 bg-amber-100/50 px-1.5 py-0.5 rounded">
                                ⚠️ {step.note}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CalculationBreakdownPanel;
