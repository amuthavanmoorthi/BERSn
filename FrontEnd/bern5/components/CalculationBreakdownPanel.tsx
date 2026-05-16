import React from 'react';

/**
 * Strongly-typed shape of the KPI object the calculation breakdown reads.
 *
 * EVERY field here is sourced from the Python `_calculate_performance`
 * output (see Backend/python/bersn_geometry_preview.py) via the
 * `displayKpis` memo in App.tsx — there is no hard-coded fallback in
 * this component. Missing values render as an em-dash placeholder so
 * the user can immediately tell which inputs the backend has not
 * supplied yet.
 */
export interface BreakdownKpis {
    af?: number;
    afe?: number;
    exemptTotal?: number;
    eei?: number;
    esr?: number;
    score?: number;
    grade?: string;
    euiG?: number;
    euiM?: number;
    euiMax?: number;
    euiN?: number;
    weights?: {
        a?: number;
        b?: number;
        c?: number;
        d?: number;
    };
    mepResults?: {
        aeui?: number;
        leui?: number;
        eeui?: number;
        eac?: number;
        el?: number;
        et?: number;
        es?: number;
        etEui?: number;
    };
    eevCalculation?: {
        calculatedEEV?: number;
        wallU?: number;
        glassU?: number;
        eta?: number;
        shadingKi?: number;
    };
    breakdown?: {
        hvac?: number;
        lighting?: number;
        elevator?: number;
        dhw?: number;
    };
}

interface CalcStep {
    id: string;
    title: string;
    formula: string;
    inputs: { label: string; value: string; unit?: string }[];
    result: { label: string; value: string; unit?: string };
    status: 'complete' | 'warning' | 'error';
    note?: string;
}

interface CalculationBreakdownPanelProps {
    kpis: BreakdownKpis;
    lang: 'zh' | 'en';
}

const MISSING = '—';

/** Format a numeric value for display, or fall back to "—" when absent. */
function formatNumber(value: number | null | undefined, fractionDigits = 3): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return MISSING;
    return value.toLocaleString(undefined, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
}

/** Like {@link formatNumber} but with a fixed digit-count for compact area/EUI values. */
function formatInteger(value: number | null | undefined): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return MISSING;
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const CalculationBreakdownPanel: React.FC<CalculationBreakdownPanelProps> = ({ kpis, lang }) => {
    const t = lang === 'zh' ? {
        title: '計算過程詳解',
        subtitle: '9-Step Process',
        step1: '有效冷房面積',
        step2: '外殼效率',
        step3: '權重係數',
        step4: '能效指標',
        step5: '能效得分',
        step6: '能效等級',
        af: '總樓地板面積',
        exempt: '免計面積',
        afe: '有效面積',
        eev: '外殼節能效率 EEV',
        weights: '權重',
        eei: '能效指標 EEI',
        score: '能效得分 SCOREee',
        grade: '等級',
        wallU: '外牆熱傳 U',
        glassU: '玻璃熱傳 Ug',
        eta: '日射透過 ηi',
        shadingKi: '外遮陽係數 Ki',
        weightA: '空調權重 a（AEUI）',
        weightB: '照明權重 b（LEUI）',
        weightC: '電梯權重 c（EtEUI）',
        sumLabel: '總和 Σ',
        mep: '機電效率（EAC、EL、Et）',
        eac: '空調節能效率 EAC',
        el: '照明節能效率 EL',
        et: '電梯節能效率 Et',
        mepParams: '機電參數',
        hvacTerm: '空調項 a(EAC−EEV×Es)',
        lightingTerm: '照明項 bEL',
        elevatorTerm: '電梯項 cEt',
        formulaTypeLabel: '公式類型',
        formulaHigh: '高效型',
        formulaNormal: '一般型',
        esr: '節能率 (ESR)',
        esrResult: '節能率 ESR',
        euiTitle: 'EUI 基準尺標',
        euiN: '近零碳基準 EUI-n',
        euiG: '優良基準 EUI-g',
        euiM: '合格基準 EUI-m',
        euiMax: '最大基準 EUI-max',
        scoreUnit: '分',
        ready: '就緒',
        notReady: '尚未提供',
    } : {
        title: 'Calculation Breakdown',
        subtitle: '9-Step Process',
        step1: 'Effective Area',
        step2: 'Envelope Efficiency',
        step3: 'Weight Coefficients',
        step4: 'Energy Index',
        step5: 'Energy Score',
        step6: 'Energy Grade',
        af: 'Total Floor Area',
        exempt: 'Exempt Area',
        afe: 'Effective Area',
        eev: 'Envelope Efficiency EEV',
        weights: 'Weights',
        eei: 'Energy Efficiency Index EEI',
        score: 'Energy Score SCOREee',
        grade: 'Grade',
        wallU: 'Wall Thermal U',
        glassU: 'Glass U Ug',
        eta: 'Solar Transmittance ηi',
        shadingKi: 'External Shading Coefficient Ki',
        weightA: 'HVAC Weight a (AEUI)',
        weightB: 'Lighting Weight b (LEUI)',
        weightC: 'Elevator Weight c (EtEUI)',
        sumLabel: 'Σ',
        mep: 'MEP Efficiency (EAC, EL, Et)',
        eac: 'HVAC Efficiency EAC',
        el: 'Lighting Efficiency EL',
        et: 'Elevator Efficiency Et',
        mepParams: 'MEP Parameters',
        hvacTerm: 'HVAC Term a(EAC−EEV×Es)',
        lightingTerm: 'Lighting Term bEL',
        elevatorTerm: 'Elevator Term cEt',
        formulaTypeLabel: 'Formula',
        formulaHigh: 'High-efficiency',
        formulaNormal: 'Standard',
        esr: 'Energy Saving Rate (ESR)',
        esrResult: 'Energy Saving Rate ESR',
        euiTitle: 'EUI Baseline Scale',
        euiN: 'Near-Zero Baseline EUI-n',
        euiG: 'Good Baseline EUI-g',
        euiM: 'Median Baseline EUI-m',
        euiMax: 'Maximum Baseline EUI-max',
        scoreUnit: 'pts',
        ready: 'Ready',
        notReady: 'Not yet available',
    };

    const af = kpis.af;
    const afe = kpis.afe;
    const exempt = kpis.exemptTotal;
    const eev = kpis.eevCalculation?.calculatedEEV;
    const wallU = kpis.eevCalculation?.wallU;
    const glassU = kpis.eevCalculation?.glassU;
    const eta = kpis.eevCalculation?.eta;
    const shadingKi = kpis.eevCalculation?.shadingKi;
    const weightA = kpis.weights?.a;
    const weightB = kpis.weights?.b;
    const weightC = kpis.weights?.c;
    const eac = kpis.mepResults?.eac;
    const el = kpis.mepResults?.el;
    const et = kpis.mepResults?.et;
    const hvacTerm = kpis.breakdown?.hvac;
    const lightingTerm = kpis.breakdown?.lighting;
    const elevatorTerm = kpis.breakdown?.elevator;
    const eei = kpis.eei;
    const esr = kpis.esr;
    const score = kpis.score;
    const grade = kpis.grade;
    const euiN = kpis.euiN;
    const euiG = kpis.euiG;
    const euiM = kpis.euiM;
    const euiMax = kpis.euiMax;

    // The MEP step is considered ready only when every MEP coefficient
    // has been provided by the backend. Anything else falls back to a
    // neutral "not yet available" label rather than an invented value.
    const mepReady = typeof eac === 'number' && typeof el === 'number' && typeof et === 'number';
    const weightsReady = typeof weightA === 'number' && typeof weightB === 'number' && typeof weightC === 'number';
    const weightsSum = weightsReady ? (weightA! + weightB! + weightC!) : null;

    const isHighEfficiencyFormula = typeof eei === 'number' && eei <= 0.8;
    const scoreFormula = typeof eei !== 'number'
        ? '—'
        : isHighEfficiencyFormula
            ? 'SCOREee = 50 + 40×(0.8−EEI)/0.3'
            : 'SCOREee = 50×(2.0−EEI)/1.2';

    const steps: CalcStep[] = [
        {
            id: 'afe',
            title: `1. ${t.step1} (AFe)`,
            formula: 'AFe = AF − ΣAfk',
            inputs: [
                { label: `${t.af} (AF)`, value: formatInteger(af), unit: 'm²' },
                { label: `${t.exempt} (ΣAfk)`, value: formatInteger(exempt), unit: 'm²' },
            ],
            result: { label: `${t.afe} (AFe)`, value: formatInteger(afe), unit: 'm²' },
            status: typeof afe === 'number' && afe > 0 ? 'complete' : 'error',
        },
        {
            id: 'eev',
            title: `2. ${t.step2} (EEV)`,
            formula: 'EEV = Σ(U×A×η×Ki) / ΣA',
            inputs: [
                { label: t.wallU, value: formatNumber(wallU, 2), unit: 'W/m²K' },
                { label: t.glassU, value: formatNumber(glassU, 2), unit: 'W/m²K' },
                { label: t.eta, value: formatNumber(eta, 2) },
                { label: t.shadingKi, value: formatNumber(shadingKi, 2) },
            ],
            result: { label: t.eev, value: formatNumber(eev) },
            status: typeof eev === 'number' && eev < 1.5 ? 'complete' : (typeof eev === 'number' ? 'warning' : 'error'),
        },
        {
            id: 'weights',
            title: `3. ${t.step3} (a,b,c)`,
            formula: 'a=AEUI/Σ, b=LEUI/Σ, c=EtEUI/Σ',
            inputs: [
                { label: t.weightA, value: formatNumber(weightA) },
                { label: t.weightB, value: formatNumber(weightB) },
                { label: t.weightC, value: formatNumber(weightC) },
            ],
            result: { label: t.sumLabel, value: formatNumber(weightsSum) },
            status: weightsReady ? 'complete' : 'error',
        },
        {
            id: 'mep',
            title: `4. ${t.mep}`,
            formula: 'EAC, EL, Et — backend MEP solver',
            inputs: [
                { label: t.eac, value: formatNumber(eac) },
                { label: t.el, value: formatNumber(el) },
                { label: t.et, value: formatNumber(et) },
            ],
            result: { label: t.mepParams, value: mepReady ? t.ready : t.notReady },
            status: mepReady ? 'complete' : 'error',
        },
        {
            id: 'eei',
            title: `5. ${t.step4} (EEI)`,
            formula: 'EEI = a(EAC−EEV×Es) + bEL + cEt',
            inputs: [
                { label: t.hvacTerm, value: formatNumber(hvacTerm, 4) },
                { label: t.lightingTerm, value: formatNumber(lightingTerm, 4) },
                { label: t.elevatorTerm, value: formatNumber(elevatorTerm, 4) },
            ],
            result: { label: t.eei, value: formatNumber(eei) },
            status: typeof eei === 'number'
                ? (eei <= 0.8 ? 'complete' : eei <= 1.0 ? 'warning' : 'error')
                : 'error',
        },
        {
            id: 'score',
            title: `6. ${t.step5} (SCOREee)`,
            formula: scoreFormula,
            inputs: [
                { label: t.eei, value: formatNumber(eei) },
                { label: t.formulaTypeLabel, value: typeof eei === 'number' ? (isHighEfficiencyFormula ? t.formulaHigh : t.formulaNormal) : MISSING },
            ],
            result: { label: t.score, value: formatNumber(score, 1), unit: t.scoreUnit },
            status: typeof score === 'number' ? 'complete' : 'error',
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
            result: { label: t.grade, value: grade ?? MISSING },
            status: grade ? 'complete' : 'error',
        },
        {
            id: 'esr',
            title: `8. ${t.esr}`,
            formula: 'ESR = (1 − EEI) × 100%',
            inputs: [
                { label: t.eei, value: formatNumber(eei) },
            ],
            result: { label: t.esrResult, value: formatNumber(esr, 1), unit: '%' },
            status: typeof esr === 'number'
                ? (esr >= 50 ? 'complete' : esr >= 20 ? 'warning' : 'error')
                : 'error',
        },
        {
            id: 'eui',
            title: `9. ${t.euiTitle}`,
            formula: 'EUIx = UR × (factor × ΣEUI + EEUI)',
            inputs: [
                { label: t.euiN, value: formatInteger(euiN), unit: 'kWh/m²' },
                { label: t.euiG, value: formatInteger(euiG), unit: 'kWh/m²' },
                { label: t.euiM, value: formatInteger(euiM), unit: 'kWh/m²' },
            ],
            result: { label: t.euiMax, value: formatInteger(euiMax), unit: 'kWh/m²' },
            status: typeof euiMax === 'number' ? 'complete' : 'error',
        },
    ];

    const getStatusColor = (status: CalcStep['status']) => {
        switch (status) {
            case 'complete': return 'bg-emerald-500';
            case 'warning': return 'bg-amber-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-slate-400';
        }
    };

    const getStatusBg = (status: CalcStep['status']) => {
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
                                {step.result.value}
                                {step.result.unit ? ` ${step.result.unit}` : ''}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CalculationBreakdownPanel;
