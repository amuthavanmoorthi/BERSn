import React, { useState } from 'react';
import { MAX_STEP, MIN_STEP } from '../../hooks/useActiveStep';
import ProjectSettingsPanel from '../ProjectSettingsPanel';
import FloorManagerPanel from '../FloorManagerPanel';
import EnvelopeSettingsPanel from '../EnvelopeSettingsPanel';
import MEPSettingsPanel from '../MEPSettingsPanel';
import GeometryCalculationsPanel from '../GeometryCalculationsPanel';
import CalculationBreakdownPanel from '../CalculationBreakdownPanel';
import CalcExtraFields, { CalcExtras } from './CalcExtraFields';

import type {
  Floor,
  GeometryObject,
  ProjectBaseline,
  EnergyKPIs,
} from '../../types';
import type { UseCategoryId } from '../../data/bersnConfig';

export interface StepWizardProps {
  /** Controlled current step (1..4). Owned by parent so TopNav shortcuts and
   *  the wizard tabs share state. */
  activeStep: number;
  onActiveStepChange: (n: number) => void;
  lang: 'zh' | 'en';

  // STEP 1: Project basic info
  baseline: ProjectBaseline;
  onBaselineChange: (b: ProjectBaseline) => void;
  selectedRegion: string;
  onRegionChange: (id: string) => void;
  selectedUseCategory: UseCategoryId;
  onUseCategoryChange: (id: UseCategoryId) => void;

  // STEP 2: Floor / shape modeling
  floors: Floor[];
  onFloorsChange: (f: Floor[]) => void;
  selectedFloorId: string | null;
  onSelectFloor: (id: string | null) => void;
  selectedShapeId: string | null;
  onSelectShape: (id: string | null) => void;
  onEnterTopView?: (floorId: string) => void;

  // STEP 3a: Envelope
  selectedWall: string;        onWallChange: (id: string) => void;
  selectedRoof: string;        onRoofChange: (id: string) => void;
  selectedShading: string;     onShadingChange: (id: string) => void;
  selectedGlazing: string;     onGlazingChange: (id: string) => void;
  // STEP 3b: MEP
  selectedHVAC: string;        onHVACChange: (id: string) => void;
  selectedLighting: string;    onLightingChange: (id: string) => void;
  selectedElevator: string;    onElevatorChange: (id: string) => void;
  selectedDHW: string;         onDHWChange: (id: string) => void;
  elevatorCount: number;       onElevatorCountChange: (n: number) => void;

  // STEP 3c: Advanced calc params (mirrors calengine-ui BERSn Manual Ch.3)
  calcExtras: CalcExtras;
  onCalcExtrasChange: (next: CalcExtras) => void;
  onRunCalculation?: () => void;

  // STEP 4: Calc / breakdown
  objects: GeometryObject[];
  floorsForCalc: Floor[];
  kpis: EnergyKPIs;
}

const TABS: { num: number; label: string; tag: string }[] = [
  { num: 1, label: '基建', tag: '專案基建' },
  { num: 2, label: '建模', tag: '用戶側形貌建模 (AF)' },
  { num: 3, label: 'EUI',  tag: '耗能參數計算' },
  { num: 4, label: 'LRV',  tag: '效益模擬' },
];

/**
 * Left-column wizard with 4 tabs corresponding to the building-energy workflow.
 * Dispatches each step to existing panels. STEP 3 toggles between Envelope and
 * MEP via a sub-tab.
 *
 * (方案比對 / AFE was previously STEP 5 but lives in the top nav "方案優化" view
 * now to avoid the duplicate entry point.)
 *
 * Active step is owned by the parent (App.tsx) so the TopNav buttons that
 * shortcut to specific steps (e.g. "能效分析" → STEP 4) and the wizard tabs
 * stay in sync.
 */
const StepWizard: React.FC<StepWizardProps> = (props) => {
  const active = Math.max(MIN_STEP, Math.min(MAX_STEP, Math.round(props.activeStep)));
  const setActive = (n: number) =>
    props.onActiveStepChange(Math.max(MIN_STEP, Math.min(MAX_STEP, Math.round(n))));
  const [step3Sub, setStep3Sub] = useState<'envelope' | 'mep' | 'advanced'>('envelope');

  const canGoNext = active < MAX_STEP;
  const goNext = () => { if (canGoNext) setActive(active + 1); };

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--color-card)', borderRight: '1px solid var(--color-border)' }}
    >
      {/* Region header — labels this panel for the BERSN spec */}
      <div
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{
          background: 'var(--color-step-active-bg)',
          borderBottom: '1px solid var(--color-border)',
          color: 'var(--color-step-active-text)',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 800 }}>BERSN 儀表板、參數設定</span>
        <span style={{ fontSize: '10px', fontWeight: 700, opacity: 0.7, letterSpacing: '0.05em' }}>EVA-01</span>
      </div>

      {/* Tabs row */}
      <div
        className="flex border-b"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
      >
        {TABS.map(t => {
          const isActive = active === t.num;
          return (
            <button
              key={t.num}
              type="button"
              onClick={() => setActive(t.num)}
              className="flex-1 px-2 py-2 text-[11px] font-bold transition-colors"
              style={{
                background: isActive ? 'var(--color-step-active-bg)' : 'transparent',
                color: isActive ? 'var(--color-step-active-text)' : 'var(--color-muted)',
                borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
              title={t.tag}
            >
              {t.num}·{t.label}
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-3 text-sm" style={{ color: 'var(--color-text)' }}>
        {active === 1 && (
          <ProjectSettingsPanel
            lang={props.lang}
            projectName={props.baseline.name}
            onProjectNameChange={(name) => props.onBaselineChange({ ...props.baseline, name })}
            selectedRegion={props.selectedRegion}
            onRegionChange={props.onRegionChange}
            selectedUseCategory={props.selectedUseCategory}
            onUseCategoryChange={props.onUseCategoryChange}
            totalFloorArea={props.baseline.totalFloorAreaAF}
            onTotalFloorAreaChange={(area) => props.onBaselineChange({ ...props.baseline, totalFloorAreaAF: area })}
            exemptAreas={props.baseline.exemptAreas}
            onExemptAreasChange={(areas) => props.onBaselineChange({ ...props.baseline, exemptAreas: areas })}
          />
        )}
        {active === 2 && (
          <FloorManagerPanel
            lang={props.lang}
            floors={props.floors}
            onFloorsChange={props.onFloorsChange}
            selectedFloorId={props.selectedFloorId}
            onSelectFloor={props.onSelectFloor}
            selectedShapeId={props.selectedShapeId}
            onSelectShape={props.onSelectShape}
            onEnterTopView={props.onEnterTopView}
          />
        )}
        {active === 3 && (
          <div>
            {/* Sub-tabs: Envelope / MEP / Advanced */}
            <div className="flex gap-1 mb-3 p-1 rounded-lg" style={{ background: 'var(--color-bg)' }}>
              {(['envelope', 'mep', 'advanced'] as const).map(sub => {
                const isOn = step3Sub === sub;
                const label = sub === 'envelope' ? '外殼' : sub === 'mep' ? '設備' : '進階參數';
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setStep3Sub(sub)}
                    className="flex-1 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                    style={{
                      background: isOn ? 'var(--color-accent)' : 'transparent',
                      color: isOn ? 'var(--color-accent-fg)' : 'var(--color-muted)',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {step3Sub === 'envelope' && (
              <EnvelopeSettingsPanel
                lang={props.lang}
                selectedWall={props.selectedWall}
                onWallChange={props.onWallChange}
                selectedRoof={props.selectedRoof}
                onRoofChange={props.onRoofChange}
                selectedShading={props.selectedShading}
                onShadingChange={props.onShadingChange}
                selectedGlazing={props.selectedGlazing}
                onGlazingChange={props.onGlazingChange}
              />
            )}
            {step3Sub === 'mep' && (
              <MEPSettingsPanel
                lang={props.lang}
                selectedHVAC={props.selectedHVAC}
                onHVACChange={props.onHVACChange}
                selectedLighting={props.selectedLighting}
                onLightingChange={props.onLightingChange}
                selectedElevator={props.selectedElevator}
                onElevatorChange={props.onElevatorChange}
                selectedDHW={props.selectedDHW}
                onDHWChange={props.onDHWChange}
                elevatorCount={props.elevatorCount}
                onElevatorCountChange={props.onElevatorCountChange}
              />
            )}
            {step3Sub === 'advanced' && (
              <CalcExtraFields
                extras={props.calcExtras}
                onChange={props.onCalcExtrasChange}
                lang={props.lang}
              />
            )}
          </div>
        )}
        {active === 4 && (
          <div className="space-y-3">
            <GeometryCalculationsPanel
              objects={props.objects}
              floors={props.floorsForCalc}
              lang={props.lang}
              selectedShading={props.selectedShading}
            />
            <CalculationBreakdownPanel kpis={props.kpis} lang={props.lang} />
            {props.onRunCalculation && (
              <button
                type="button"
                onClick={props.onRunCalculation}
                className="w-full rounded-lg transition-opacity hover:opacity-90"
                style={{
                  background: 'var(--color-accent)',
                  color: 'var(--color-accent-fg)',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 800,
                  boxShadow: '0 4px 12px rgba(0,0,0,.12)',
                }}
              >
                ▷ {props.lang === 'zh' ? '執行計算' : 'Run Calculation'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer: Next (hidden on final step — disabled-forever buttons are noisy UX) */}
      <div
        className="flex justify-end items-center p-3 border-t min-h-[48px]"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
      >
        {canGoNext ? (
          <button
            type="button"
            onClick={goNext}
            className="px-4 py-1.5 rounded text-xs font-bold transition-opacity"
            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-fg)' }}
          >
            下一步 →
          </button>
        ) : (
          <span className="text-xs font-bold" style={{ color: 'var(--color-muted)' }}>
            已是最後一步
          </span>
        )}
      </div>
    </div>
  );
};

export default StepWizard;
