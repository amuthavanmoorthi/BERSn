/**
 * Calengine-style 計算參數 (BERSn 2024 Manual Chapter 3 group order).
 *
 * Groups & fields mirror https://calengine-ui.zeabur.app/calculation so the
 * BERSn-compliant agency tester sees the official terminology + Lookup/Manual
 * mode badges + per-field formula hints.
 *
 * Editable values are kept in a single CalcExtras object so callers (App.tsx)
 * own the state and can ship it to the backend `/api/projects/:id/calc/run`.
 */
import React from 'react';
import ModeBadge, { ParamMode } from './ModeBadge';

// ---------- Data ----------

export interface CalcExtras {
  // Step 4-9: Manual efficiency indicators
  eev: number;   // Envelope Efficiency Value
  eac: number;   // HVAC Efficiency Coefficient
  el:  number;   // Lighting Efficiency Coefficient
  // Step 8-10: MEP coefficients
  es:    number; // Envelope-HVAC Interaction Factor
  et:    number; // Elevator Efficiency Factor
  nej:   number; // Elevator Count
  eelj:  number; // Elevator Unit Energy (kWh/car·hr)
  yohj:  number; // Annual Operating Hours
  beta1: number; // Lighting Management Factor (β₁)
  cfn:   number; // Carbon Emission Factor (kgCO₂/kWh)
  // Optional checks
  enableRenewableBonus: boolean;
  enableNzbEvaluate:    boolean;
}

export const DEFAULT_CALC_EXTRAS: CalcExtras = {
  eev: 0.85, eac: 0.72, el: 0.65,
  es: 0.05, et: 0.5, nej: 4, eelj: 8.24, yohj: 2500, beta1: 0.474, cfn: 0.91,
  enableRenewableBonus: false, enableNzbEvaluate: false,
};

// ---------- Tiny helpers ----------

interface FieldRowProps {
  mode: ParamMode;
  label: string;            // e.g. "Step 7 — Envelope Efficiency Value EEV"
  unit?: string;            // e.g. "kWh/m²·yr"
  hint?: string;            // formula / source description
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange?: (n: number) => void;  // omit to render as read-only Lookup
}

const FieldRow: React.FC<FieldRowProps> = ({ mode, label, unit, hint, value, step, min, max, onChange }) => {
  const readonly = !onChange;
  return (
    <div
      className="rounded-lg p-2.5"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <ModeBadge mode={mode} />
        <span
          className="font-bold flex-1 leading-tight"
          style={{ fontSize: '12px', color: 'var(--color-text)' }}
        >
          {label}
          {unit && <span style={{ color: 'var(--color-muted)', marginLeft: '4px' }}>({unit})</span>}
        </span>
      </div>
      <input
        type="number"
        value={value}
        step={step ?? 0.01}
        min={min}
        max={max}
        readOnly={readonly}
        onChange={(e) => onChange?.(parseFloat(e.target.value) || 0)}
        className="w-full px-2 py-1.5 rounded-md font-bold text-center outline-none"
        style={{
          background: readonly ? 'var(--color-bg)' : 'var(--color-card)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
          fontSize: '13px',
          cursor: readonly ? 'default' : 'text',
        }}
      />
      {hint && (
        <p style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '4px', lineHeight: 1.4 }}>
          {hint}
        </p>
      )}
    </div>
  );
};

const GroupHeader: React.FC<{ step: string; title: string }> = ({ step, title }) => (
  <div
    className="flex items-center gap-2 mt-3 mb-2 px-1 py-1.5 rounded-lg"
    style={{ background: 'var(--color-step-active-bg)', color: 'var(--color-step-active-text)' }}
  >
    <span
      style={{
        background: 'var(--color-accent)',
        color: 'var(--color-accent-fg)',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 800,
      }}
    >
      {step}
    </span>
    <span style={{ fontSize: '12px', fontWeight: 800 }}>{title}</span>
  </div>
);

// ---------- Main component ----------

interface Props {
  extras: CalcExtras;
  onChange: (next: CalcExtras) => void;
  lang: 'zh' | 'en';
}

const CalcExtraFields: React.FC<Props> = ({ extras, onChange, lang }) => {
  const t = lang === 'zh';
  const patch = <K extends keyof CalcExtras>(k: K, v: CalcExtras[K]) =>
    onChange({ ...extras, [k]: v });

  return (
    <div className="space-y-1">
      {/* Legend */}
      <div
        className="flex items-center gap-2 flex-wrap p-2 rounded-lg"
        style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-1"><ModeBadge mode="lookup" lang={lang} /><span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{t ? '標準表自動取值' : 'Standard table'}</span></div>
        <div className="flex items-center gap-1"><ModeBadge mode="manual" lang={lang} /><span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{t ? '使用者輸入' : 'User enters'}</span></div>
        <div className="flex items-center gap-1"><ModeBadge mode="calculated" lang={lang} /><span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{t ? '由公式衍生' : 'From formula'}</span></div>
      </div>

      {/* Step 4-9: Manual Mode — Provide efficiency indicators directly */}
      <GroupHeader step={t ? '4-9' : 'Step 4-9'} title={t ? 'Manual Mode 直接給效率指標' : 'Manual Mode — Efficiency Indicators'} />
      <FieldRow
        mode="manual"
        label="Step 7 — Envelope Efficiency Value EEV"
        value={extras.eev}
        step={0.01} min={0} max={1.5}
        onChange={v => patch('eev', v)}
        hint="EEV = Σ(Uaw×Aaw + Ui×ηi×Ki×Aaf + Uar×Aar) / ΣA — Appendix 2 Formulas 1-5"
      />
      <FieldRow
        mode="manual"
        label="Step 8 — HVAC Efficiency Coefficient EAC"
        value={extras.eac}
        step={0.01} min={0} max={1.5}
        onChange={v => patch('eac', v)}
        hint="Central: 1 - (BW×HT×Arx); Individual: 0.9×(1 - Arx). Appendix 2 Formulas 15-16b."
      />
      <FieldRow
        mode="manual"
        label="Step 9 — Lighting Efficiency Coefficient EL"
        value={extras.el}
        step={0.01} min={0} max={1.5}
        onChange={v => patch('el', v)}
        hint="EL = β × (LPD_design / LPD_base), β from Table 10, LPD_base from Table 11."
      />

      {/* Step 8-10: MEP Coefficients */}
      <GroupHeader step={t ? '8-10' : 'Step 8-10'} title={t ? 'MEP 效率係數 (Es / Et / β₁ / CFn)' : 'MEP Efficiency Coefficients'} />
      <FieldRow
        mode="lookup"
        label="Envelope-HVAC Interaction Factor Es"
        value={extras.es}
        step={0.01}
        onChange={v => patch('es', v)}
        hint={t ? '依建築用途自 Table 3-2 取值；EEI 公式中 a×(EAC - EEV×Es)' : 'From Table 3-2 by building type. Used in EEI: a×(EAC - EEV×Es).'}
      />
      <FieldRow
        mode="lookup"
        label="Step 10 — Elevator Efficiency Factor Et"
        value={extras.et}
        step={0.1}
        onChange={v => patch('et', v)}
        hint="ACVV=1.0, VVVF gear=0.6, VVVF perm=0.5, Regen=0.4. §3-3-1."
      />
      <FieldRow
        mode="manual"
        label="Step 10 — Elevator Count Nej"
        value={extras.nej}
        step={1} min={0}
        onChange={v => patch('nej', Math.round(v))}
        hint={t ? '電梯總數量。EtEUI = 0.6×Σ(Nej × Eelj × YOHj) / AFe' : 'Total elevators. EtEUI = 0.6×Σ(Nej×Eelj×YOHj)/AFe.'}
      />
      <FieldRow
        mode="lookup"
        label="Elevator Unit Energy Eelj (kWh/car·hr)"
        value={extras.eelj}
        step={0.01}
        onChange={v => patch('eelj', v)}
        hint={t ? '依電梯型號 + 載重量自 Table 3-1 取值；可依實機規格微調' : 'From Table 3-1 by elevator type + capacity.'}
      />
      <FieldRow
        mode="manual"
        label="Annual Operating Hours YOHj (hr/yr)"
        value={extras.yohj}
        step={50} min={0}
        onChange={v => patch('yohj', v)}
        hint={t ? '電梯年運轉時數。辦公典型 2,500–3,500 hr/yr' : 'Annual elevator operation hours. Office: 2500–3500 hr/yr.'}
      />
      <FieldRow
        mode="lookup"
        label="Step 9 — Lighting Management Factor β₁"
        value={extras.beta1}
        step={0.001}
        onChange={v => patch('beta1', v)}
        hint="BEMS=0.75, Dimming=0.80, Auto=0.90, Circuit=0.95, None=1.0. Appendix 2 Table 10."
      />
      <FieldRow
        mode="lookup"
        label="Carbon Emission Factor CFn (kgCO₂/kWh)"
        value={extras.cfn}
        step={0.01}
        onChange={v => patch('cfn', v)}
        hint={t ? '依台電年度公告碳排係數（約 0.509 kgCO₂/kWh）' : 'Per Taipower annual announcement (approx 0.509 kgCO₂/kWh).'}
      />

      {/* Optional Additional Checks */}
      <GroupHeader step={t ? '選項' : 'Optional'} title={t ? '額外檢核（可選）' : 'Optional Additional Checks'} />
      <div
        className="rounded-lg p-3 space-y-2"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={extras.enableRenewableBonus}
            onChange={(e) => patch('enableRenewableBonus', e.target.checked)}
            style={{ accentColor: 'var(--color-accent)' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--color-text)' }}>
            {t ? '啟用 Renewable Bonus（3-8）' : 'Enable Renewable Bonus (3-8)'}
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={extras.enableNzbEvaluate}
            onChange={(e) => patch('enableNzbEvaluate', e.target.checked)}
            style={{ accentColor: 'var(--color-accent)' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--color-text)' }}>
            {t ? '啟用 NZB 評估（3-9）' : 'Enable NZB Evaluate (3-9)'}
          </span>
        </label>
      </div>
    </div>
  );
};

export default CalcExtraFields;
