/**
 * STEP 5 — 方案比對 (AFE)
 *
 * Vertical-flow layout designed for the narrow left-pane column (~280–440px).
 * Three sub-tabs:
 *   - 方案 (Measures library):   compact one-per-row cards
 *   - 排名 (CP Ranking):         dense list of eligible measures by cost-perf
 *   - 情境 (Scenarios):          select a scenario; result panel pinned below
 *
 * Uses CSS-variable theme tokens (var(--color-*)) so it adapts to the active
 * palette switch in the top nav.
 */
import React, { useState } from 'react';
import type { Scenario } from '../../types';
import { MEASURE_LIBRARY } from '../../constants';
import { translations } from '../../translations';

export interface ScenariosViewProps {
  lang: 'zh' | 'en';
  measureImpacts: any[];
  scenarios: Scenario[];
  selectedScenarioId: string | null;
  onSelectScenario: (id: string | null) => void;
  activeScenarioResults: any | null;
}

type SubTab = 'measures' | 'ranking' | 'scenarios';

const ScenariosView: React.FC<ScenariosViewProps> = ({
  lang,
  measureImpacts,
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  activeScenarioResults,
}) => {
  const t = translations[lang];
  const [sub, setSub] = useState<SubTab>('measures');

  const fmtNum = (n: number, digits = 0) =>
    n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });

  const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--color-muted)' }}>
      {children}
    </div>
  );

  // ─────────── Sub-tab: Measures library ───────────
  const MeasuresList = () => (
    <div className="flex flex-col gap-2">
      <SectionLabel>{t.measureLibrary} · {MEASURE_LIBRARY.length} {t.measuresAnalyzed}</SectionLabel>
      {MEASURE_LIBRARY.map(m => {
        const impact = measureImpacts.find(imp => imp.measureId === m.id);
        const measureName = t[`${m.id}_name` as keyof typeof t] || m.name;
        const measureDesc = t[`${m.id}_desc` as keyof typeof t] || m.description;
        const categoryName = t[`cat_${m.category}` as keyof typeof t] || m.category;
        const eligible = impact?.isEligible;
        return (
          <div
            key={m.id}
            className="rounded-lg p-3 transition-all"
            style={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              opacity: eligible ? 1 : 0.55,
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span
                className="text-[10px] font-black uppercase px-2 py-0.5 rounded"
                style={{
                  background: 'var(--color-step-active-bg)',
                  color: 'var(--color-step-active-text)',
                }}
              >
                {categoryName}
              </span>
              <span
                className="text-[10px] font-black flex items-center gap-1"
                style={{ color: eligible ? '#10b981' : '#dc2626' }}
                title={impact?.ineligibleReason}
              >
                {eligible ? `✅ ${t.eligible}` : `⛔ ${t.ineligible}`}
              </span>
            </div>
            <h4 className="font-black text-sm leading-tight mb-1" style={{ color: 'var(--color-text)' }}>
              {measureName}
            </h4>
            <p className="text-[11px] mb-2 line-clamp-2" style={{ color: 'var(--color-muted)' }}>
              {measureDesc}
            </p>
            <div
              className="flex items-center justify-between pt-2 text-[11px]"
              style={{ borderTop: '1px solid var(--color-border)' }}
            >
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase" style={{ color: 'var(--color-muted)' }}>{t.deltaEEI}</span>
                <span className="font-black" style={{ color: 'var(--color-val-good)' }}>
                  -{impact?.deltaEEI?.toFixed(3) || '0.000'}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[9px] font-black uppercase" style={{ color: 'var(--color-muted)' }}>{t.cost}</span>
                <span className="font-black" style={{ color: 'var(--color-text)' }}>
                  ${fmtNum(impact?.cost || 0)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─────────── Sub-tab: CP Ranking ───────────
  const RankingList = () => {
    const eligible = measureImpacts.filter(i => i.isEligible);
    return (
      <div className="flex flex-col gap-1">
        <SectionLabel>{t.cpRanking}</SectionLabel>
        {eligible.length === 0 && (
          <div className="text-xs italic py-4 text-center" style={{ color: 'var(--color-muted)' }}>
            {lang === 'zh' ? '尚無可用方案' : 'No eligible measures yet'}
          </div>
        )}
        {eligible.map((imp, idx) => {
          const m = MEASURE_LIBRARY.find(ml => ml.id === imp.measureId)!;
          const measureName = t[`${m.id}_name` as keyof typeof t] || m.name;
          const isTop = idx === 0;
          return (
            <div
              key={imp.measureId}
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
            >
              <div
                className="w-7 h-7 flex items-center justify-center rounded text-[11px] font-black flex-shrink-0"
                style={{
                  background: isTop ? '#10b981' : 'var(--color-step-active-bg)',
                  color: isTop ? '#ffffff' : 'var(--color-step-active-text)',
                }}
              >
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black truncate" style={{ color: 'var(--color-text)' }}>
                  {measureName}
                </div>
                <div className="text-[10px] flex items-center gap-2" style={{ color: 'var(--color-muted)' }}>
                  <span>-{imp.deltaEEI.toFixed(3)}</span>
                  <span>·</span>
                  <span>${fmtNum(imp.cost)}</span>
                </div>
              </div>
              <div
                className="text-[11px] font-black px-2 py-0.5 rounded flex-shrink-0"
                style={{
                  background: isTop ? '#10b981' : 'var(--color-card)',
                  color: isTop ? '#ffffff' : 'var(--color-text)',
                  border: isTop ? 'none' : '1px solid var(--color-border)',
                }}
                title={t.cpValue}
              >
                {imp.cpValue.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─────────── Sub-tab: Scenarios ───────────
  const ScenariosList = () => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center mb-1">
        <SectionLabel>{t.scenarios}</SectionLabel>
        <button
          className="text-[10px] font-black px-2 py-1 rounded"
          style={{
            background: 'var(--color-accent)',
            color: 'var(--color-accent-fg)',
            opacity: 0.5,
            cursor: 'not-allowed',
          }}
          disabled
          title={lang === 'zh' ? '新增方案（尚未實作）' : 'Add scenario (TBD)'}
        >
          + {lang === 'zh' ? '新增' : 'New'}
        </button>
      </div>

      {scenarios.map(sc => {
        const isSelected = selectedScenarioId === sc.id;
        return (
          <div
            key={sc.id}
            onClick={() => onSelectScenario(sc.id)}
            className="rounded-lg p-3 cursor-pointer transition-all"
            style={{
              background: isSelected ? 'var(--color-step-active-bg)' : 'var(--color-card)',
              border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          >
            <div className="flex justify-between items-start mb-2 gap-2">
              <div className="min-w-0">
                <h4 className="font-black text-sm leading-tight" style={{ color: isSelected ? 'var(--color-step-active-text)' : 'var(--color-text)' }}>
                  {sc.name}
                </h4>
                <p className="text-[10px] font-bold" style={{ color: 'var(--color-muted)' }}>
                  {sc.selectedMeasureIds.length} {t.measuresSelected}
                </p>
              </div>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  border: `2px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: isSelected ? 'var(--color-accent)' : 'transparent',
                }}
              >
                {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-fg)' }} />}
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {sc.selectedMeasureIds.map(mid => {
                const mName = t[`${mid}_name` as keyof typeof t] || MEASURE_LIBRARY.find(m => m.id === mid)?.name;
                return (
                  <span
                    key={mid}
                    className="text-[9px] font-black px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                  >
                    {mName}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Result pane (only when scenario selected) */}
      {selectedScenarioId && activeScenarioResults && (
        <div
          className="rounded-lg p-3 mt-2"
          style={{
            background: 'var(--color-card)',
            border: '2px solid var(--color-accent)',
          }}
        >
          <div className="text-[10px] font-black uppercase mb-2" style={{ color: 'var(--color-accent)' }}>
            {t.scenarioPerf}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] font-black uppercase" style={{ color: 'var(--color-muted)' }}>{t.resultEEI}</div>
              <div className="text-xl font-black" style={{ color: 'var(--color-val-good)' }}>
                {activeScenarioResults.kpis.eei.toFixed(3)}
              </div>
              <div className="text-[10px] font-bold" style={{ color: 'var(--color-muted)' }}>
                {t.grade}: {activeScenarioResults.kpis.grade}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-black uppercase" style={{ color: 'var(--color-muted)' }}>{t.totalCost}</div>
              <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>
                ${fmtNum(activeScenarioResults.totalCost)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ─────────── Render ───────────
  const SubTabButton: React.FC<{ value: SubTab; label: string }> = ({ value, label }) => {
    const active = sub === value;
    return (
      <button
        type="button"
        onClick={() => setSub(value)}
        className="flex-1 px-3 py-1.5 rounded text-xs font-bold transition-colors"
        style={{
          background: active ? 'var(--color-accent)' : 'transparent',
          color: active ? 'var(--color-accent-fg)' : 'var(--color-muted)',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-bg)' }}>
        <SubTabButton value="measures"  label={lang === 'zh' ? '方案' : 'Measures'} />
        <SubTabButton value="ranking"   label={lang === 'zh' ? '排名' : 'Ranking'} />
        <SubTabButton value="scenarios" label={lang === 'zh' ? '情境' : 'Scenarios'} />
      </div>

      {sub === 'measures'  && <MeasuresList />}
      {sub === 'ranking'   && <RankingList />}
      {sub === 'scenarios' && <ScenariosList />}
    </div>
  );
};

export default ScenariosView;
