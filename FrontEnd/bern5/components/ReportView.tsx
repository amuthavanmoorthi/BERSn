
import React from 'react';
import { ProjectBaseline, EnergyKPIs } from '../types';
import { GeometryPreview } from '../types/project';
import { translations } from '../translations';

interface ReportViewProps {
  baseline: ProjectBaseline;
  kpis: EnergyKPIs;
  /**
   * Raw backend preview payload for the active project. Every value
   * the report renders must trace back to this object (or to `kpis`,
   * which itself is derived from `geometryPreview.performance`). The
   * legacy `baseline` prop is kept only for the project NAME and for
   * demo / non-backend projects that have no preview yet.
   */
  geometryPreview: GeometryPreview | null;
  lang: 'zh' | 'en';
}

// ── Backend value extraction helpers ────────────────────────────────
//
// The python preview script types the deep envelope / mep / inputsUsed
// payload as `unknown`. These helpers walk the tree defensively so a
// rename in python returns "—" instead of crashing the report.

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return null;
}

/**
 * Pick a localised label out of a backend catalog item. The BERSn
 * configLookupService returns catalog items shaped like
 *   { id, name: '中文名稱', nameEn: 'English name', ... }
 * so we resolve the field that matches the active UI language and
 * fall back to the other locale, then the raw id.
 */
function pickCatalogLabel(item: Record<string, unknown> | null, lang: 'zh' | 'en'): string | null {
  if (!item) return null;
  if (lang === 'en') {
    return asString(item.nameEn) ?? asString(item.name) ?? asString(item.id);
  }
  return asString(item.name) ?? asString(item.nameEn) ?? asString(item.id);
}

const MISSING = '—';

function fmt(value: number | null, fractionDigits = 3): string {
  if (value === null) return MISSING;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function fmtInt(value: number | null): string {
  if (value === null) return MISSING;
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const ReportView: React.FC<ReportViewProps> = ({ baseline, kpis, geometryPreview, lang }) => {
  const t = translations[lang];

  const handlePrint = async () => {
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const reportEl = document.querySelector('.bg-slate-50.min-h-screen') as HTMLElement | null;
      if (!reportEl) { window.print(); return; }
      const canvas = await html2canvas(reportEl, { scale: 2, logging: false, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      const ts = new Date().toISOString().slice(0, 10);
      pdf.save(`BERSn-Report-${baseline.name || 'project'}-${ts}.pdf`);
    } catch {
      window.print();   // fallback if jsPDF/html2canvas fail to load
    }
  };

  const currentDate = new Date().toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Pull every renderable value out of the backend payload ───────
  // (kpis.* fields are already wired by displayKpis in App.tsx, which
  // mirrors geometryPreview.performance into the EnergyKPIs shape.)
  const performance = geometryPreview?.performance;
  const inputsUsed = asRecord(performance?.inputsUsed);
  const envelopePage = asRecord(geometryPreview?.envelope);
  const envelopeSummary = asRecord(envelopePage?.summary);
  const wallCons = asRecord(envelopePage?.wallConstruction);
  const glazingCons = asRecord(envelopePage?.glazingType);
  const shadingCons = asRecord(envelopePage?.shadingType);
  const mepPage = asRecord(geometryPreview?.mep);
  const hvacSystem = asRecord(mepPage?.hvacSystem);
  const lightingSystem = asRecord(mepPage?.lightingSystem);
  const elevatorSystem = asRecord(mepPage?.elevatorSystem);
  const mepSummary = asRecord(mepPage?.summary);

  // UR (region factor) and EEUI (base consumption) come straight from
  // the python solver's `inputsUsed` block — same source the analysis
  // breakdown uses. Falls back to em-dash so a backend without these
  // values shows that fact instead of fabricating a default.
  const ur = asNumber(inputsUsed?.UR);
  const eeui = kpis.mepResults?.eeui ?? null;

  // Envelope construction labels: pulled from the backend catalog so
  // the report names the actual selected wall / glass / shading on
  // the Config page, not a hard-coded string. The catalog uses
  // `name` (zh) / `nameEn` (en); pickCatalogLabel resolves both.
  const wallLabel = pickCatalogLabel(wallCons, lang);
  const glazingLabel = pickCatalogLabel(glazingCons, lang);
  const shadingLabel = pickCatalogLabel(shadingCons, lang);
  const wallU = kpis.eevCalculation?.wallU ?? asNumber(envelopeSummary?.wallUValue) ?? asNumber(wallCons?.uValue);
  const glassU = kpis.eevCalculation?.glassU ?? asNumber(envelopeSummary?.ug);
  const glassEta = kpis.eevCalculation?.eta ?? asNumber(envelopeSummary?.etaI);
  const shadingKi = kpis.eevCalculation?.shadingKi ?? asNumber(envelopeSummary?.ki);

  // MEP catalog details. The BERSn catalog does NOT expose legacy
  // values like COP or LPD; it stores the energy-adjustment
  // coefficients (EAC, EL, Et) used by the formula chain directly.
  // The report therefore names the selected system and shows its
  // canonical coefficient straight from the backend payload.
  const hvacLabel = pickCatalogLabel(hvacSystem, lang);
  const hvacEac = asNumber(hvacSystem?.eac) ?? kpis.mepResults?.eac ?? null;
  const lightingLabel = pickCatalogLabel(lightingSystem, lang);
  const lightingEl = asNumber(lightingSystem?.el) ?? kpis.mepResults?.el ?? null;
  const elevatorLabel = pickCatalogLabel(elevatorSystem, lang);
  const elevatorEt = asNumber(elevatorSystem?.et) ?? kpis.mepResults?.et ?? null;
  const elevatorCount = asNumber(mepSummary?.elevatorCount) ?? asNumber(elevatorSystem?.count);

  // Demo / non-backend projects keep working off the legacy baseline
  // so the report still renders something useful before a project has
  // been previewed against the python solver.
  const hasBackend = Boolean(performance);
  const reportUr = ur ?? (hasBackend ? null : baseline.ur);
  const reportWallLabel = wallLabel ?? (hasBackend ? null : baseline.envelope.wallMaterial);
  const reportWallU = wallU ?? (hasBackend ? null : baseline.envelope.wallUValue);
  const reportGlassU = glassU ?? (hasBackend ? null : baseline.envelope.glassUValue);
  const reportGlassEta = glassEta ?? (hasBackend ? null : baseline.envelope.glassEtaI);
  const reportShadingKi = shadingKi ?? (hasBackend ? null : baseline.envelope.shadingKi);
  const reportElevatorCount = elevatorCount ?? (hasBackend ? null : baseline.mep.elevator.numElevators);

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm print:hidden">
          <div>
            <h2 className="text-xl font-black text-slate-800">{lang === 'zh' ? 'BERSn 節能性能計量計算書' : 'BERSn Energy Assessment Report'}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t.genDate}: {currentDate}</p>
          </div>
          <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-3 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h10a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            {t.exportPDF}
          </button>
        </div>

        <div className="bg-white p-16 sm:p-24 rounded-[3rem] border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0">
          <div className="border-b-8 border-slate-900 pb-10 mb-12 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-4">{lang === 'zh' ? 'BERSn 節能計量計算報告' : 'BERSn Calculation Report'}</h1>
              <p className="text-slate-500 font-bold tracking-[0.2em] text-sm uppercase">{lang === 'zh' ? '建築能效等級認證系統 v5.2' : 'Building Energy Efficiency Rating System v5.2'}</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="bg-blue-600 text-white px-8 py-4 rounded-3xl shadow-xl shadow-blue-200">
                <div className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-1">{lang === 'zh' ? '能效等級' : 'Efficiency Grade'}</div>
                <div className="text-5xl font-black">Grade {kpis.grade ?? MISSING}</div>
              </div>
            </div>
          </div>

          <section className="mb-16">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <span className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center rounded-lg text-xs">01</span>
              {lang === 'zh' ? 'BERSn 計算總表' : 'BERSn Summary Table'}
            </h3>
            <div className="grid grid-cols-4 gap-0 border-2 border-slate-900">
              {[
                { label: t.afe, value: `${fmt(kpis.afe ?? null, 1)} m²` },
                { label: lang === 'zh' ? '地區係數 (UR)' : 'Region Factor (UR)', value: fmt(reportUr, 2) },
                { label: t.aeuiBase, value: fmt(kpis.mepResults?.aeui ?? null, 1) },
                { label: lang === 'zh' ? '照明基準 (LEUI)' : 'Lighting Base (LEUI)', value: fmt(kpis.mepResults?.leui ?? null, 1) },
                { label: lang === 'zh' ? '基礎能耗 (EEUI)' : 'Base Consumption (EEUI)', value: fmt(eeui, 1) },
                { label: lang === 'zh' ? '外殼能效 (EEV)' : 'Envelope (EEV)', value: fmt(kpis.eevCalculation?.calculatedEEV ?? null) },
                { label: lang === 'zh' ? '空調能效 (EAC)' : 'HVAC (EAC)', value: fmt(kpis.mepResults?.eac ?? null) },
                { label: lang === 'zh' ? '照明能效 (EL)' : 'Lighting (EL)', value: fmt(kpis.mepResults?.el ?? null) },
                { label: lang === 'zh' ? '電梯能效 (Et)' : 'Elevator (Et)', value: fmt(kpis.mepResults?.et ?? null) },
                { label: lang === 'zh' ? '外殼敏感度 (Es)' : 'Envelope Sensitivity (Es)', value: fmt(kpis.mepResults?.es ?? null, 2) },
                { label: lang === 'zh' ? '能效指標 (EEI)' : 'Indicator (EEI)', value: fmt(kpis.eei ?? null) },
                { label: lang === 'zh' ? '能效分數 (Score)' : 'Efficiency Score', value: fmt(kpis.score ?? null, 1) },
                { label: lang === 'zh' ? '目前等級' : 'Current Grade', value: kpis.grade ?? MISSING, bold: true },
                { label: lang === 'zh' ? '認證日期' : 'Certified Date', value: currentDate },
              ].map((item, idx) => (
                <div key={idx} className="p-4 border border-slate-200 flex flex-col justify-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</span>
                  <span className={`text-base font-black ${item.bold ? 'text-blue-600' : 'text-slate-800'}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-16">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <span className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center rounded-lg text-xs">02</span>
              {lang === 'zh' ? '系統能效審核詳表' : 'Efficiency Audit Details'}
            </h3>
            <div className="space-y-4">
              <div className="bg-slate-50 p-6 rounded-3xl">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">{lang === 'zh' ? '外殼性能' : 'Envelope Performance'}</h4>
                <div className="grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400">{t.wall}</p>
                    <p className="font-bold">{reportWallLabel ?? MISSING}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">{t.uValue}</p>
                    <p className="font-bold">{reportWallU !== null ? `${fmt(reportWallU, 2)} W/m²K` : MISSING}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">{t.glassEta}</p>
                    <p className="font-bold">{fmt(reportGlassEta, 2)} / {fmt(reportGlassU, 2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">{lang === 'zh' ? '外遮陽係數 (Ki)' : 'External Shading Coefficient (Ki)'}</p>
                    <p className="font-bold text-blue-600">{fmt(reportShadingKi, 2)}</p>
                  </div>
                </div>
                {(glazingLabel || shadingLabel) && (
                  <div className="mt-3 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    {glazingLabel && <span className="mr-3">{lang === 'zh' ? '玻璃' : 'Glazing'}: {glazingLabel}</span>}
                    {shadingLabel && <span>{lang === 'zh' ? '遮陽' : 'Shading'}: {shadingLabel}</span>}
                  </div>
                )}
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">{lang === 'zh' ? '機電性能' : 'MEP Performance'}</h4>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400">{lang === 'zh' ? '空調系統 / EAC' : 'HVAC / EAC'}</p>
                    <p className="font-bold">
                      {hvacLabel ?? MISSING}
                      {hvacEac !== null ? ` · EAC ${fmt(hvacEac, 3)}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">{lang === 'zh' ? '電梯系統 / Et' : 'Elevator / Et'}</p>
                    <p className="font-bold">
                      {elevatorLabel ? `${elevatorLabel} · ` : ''}
                      {reportElevatorCount !== null ? `${fmtInt(reportElevatorCount)} ${lang === 'zh' ? '部' : 'Units'}` : MISSING}
                      {elevatorEt !== null ? ` · Et ${fmt(elevatorEt, 3)}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">{lang === 'zh' ? '照明系統 / EL' : 'Lighting / EL'}</p>
                    <p className="font-bold">
                      {lightingLabel ?? MISSING}
                      {lightingEl !== null ? ` · EL ${fmt(lightingEl, 3)}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="pt-20 border-t-2 border-slate-100 flex justify-between items-center opacity-50">
            <div className="text-[10px] font-bold text-slate-400 italic">
              * BERSn-Pro Auto-generated Report • v5.3.2<br/>
              * Validations based on energy efficiency legislation.
            </div>
            <div className="text-center">
              <div className="w-32 h-32 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center mb-2">
                <span className="text-[9px] font-black uppercase text-slate-300">{lang === 'zh' ? '審核單位' : 'AUDIT STAMP'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportView;
