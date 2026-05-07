
import React from 'react';
import { ProjectBaseline, EnergyKPIs } from '../types';
import { translations } from '../translations';

interface ReportViewProps {
  baseline: ProjectBaseline;
  kpis: EnergyKPIs;
  lang: 'zh' | 'en';
}

const ReportView: React.FC<ReportViewProps> = ({ baseline, kpis, lang }) => {
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
                <div className="text-5xl font-black">Grade {kpis.grade}</div>
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
                { label: t.afe, value: `${kpis.afe.toFixed(1)} m²` },
                { label: lang === 'zh' ? '地區係數 (UR)' : 'Region Factor (UR)', value: baseline.ur.toFixed(2) },
                { label: t.aeuiBase, value: kpis.mepResults.aeui.toFixed(1) },
                { label: lang === 'zh' ? '照明基準 (LEUI)' : 'Lighting Base (LEUI)', value: kpis.mepResults.leui.toFixed(1) },
                { label: lang === 'zh' ? '基礎能耗 (EEUI)' : 'Base Consumption (EEUI)', value: '10.0' },
                { label: lang === 'zh' ? '外殼能效 (EEV)' : 'Envelope (EEV)', value: kpis.eevCalculation.calculatedEEV.toFixed(3) },
                { label: lang === 'zh' ? '空調能效 (EAC)' : 'HVAC (EAC)', value: kpis.mepResults.eac.toFixed(3) },
                { label: lang === 'zh' ? '照明能效 (EL)' : 'Lighting (EL)', value: kpis.mepResults.el.toFixed(3) },
                { label: lang === 'zh' ? '電梯能效 (Et)' : 'Elevator (Et)', value: kpis.mepResults.et.toFixed(3) },
                { label: lang === 'zh' ? '外殼敏感度 (Es)' : 'Envelope Sensitivity (Es)', value: kpis.mepResults.es.toFixed(2) },
                { label: lang === 'zh' ? '能效指標 (EEI)' : 'Indicator (EEI)', value: kpis.eei.toFixed(3) },
                { label: lang === 'zh' ? '能效分數 (Score)' : 'Efficiency Score', value: kpis.score.toFixed(1) },
                { label: lang === 'zh' ? '目前等級' : 'Current Grade', value: kpis.grade, bold: true },
                { label: lang === 'zh' ? '認證日期' : 'Certified Date', value: currentDate }
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
                     <div><p className="text-slate-400">{t.wall}</p><p className="font-bold">{baseline.envelope.wallMaterial}</p></div>
                     <div><p className="text-slate-400">{t.uValue}</p><p className="font-bold">{baseline.envelope.wallUValue} W/m²K</p></div>
                     <div><p className="text-slate-400">{t.glassEta}</p><p className="font-bold">{baseline.envelope.glassEtaI} / {baseline.envelope.glassUValue}</p></div>
                     <div><p className="text-slate-400">{lang === 'zh' ? '外遮陽係數 (Ki)' : 'External Shading Coefficient (Ki)'}</p><p className="font-bold text-blue-600">{baseline.envelope.shadingKi}</p></div>
                  </div>
               </div>
               <div className="bg-slate-50 p-6 rounded-3xl">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">{lang === 'zh' ? '機電性能' : 'MEP Performance'}</h4>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                     <div><p className="text-slate-400">{t.hvacParams}</p><p className="font-bold">COP: {baseline.mep.hvac.cop}</p></div>
                     <div><p className="text-slate-400">{t.elevatorParams}</p><p className="font-bold">{baseline.mep.elevator.numElevators} Units</p></div>
                     <div><p className="text-slate-400">{lang === 'zh' ? '照明密度' : 'LPD'}</p><p className="font-bold">{baseline.mep.lighting.lpd} W/m²</p></div>
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
