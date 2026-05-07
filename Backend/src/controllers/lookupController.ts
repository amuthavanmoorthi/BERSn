import type { Request, Response } from 'express';

import type { AuthServiceError } from '../services/authService.js';
import {
  getConfigLookups,
  getEnvelopeConfigLookups,
  getMepConfigLookups,
  getProjectConfigLookups,
} from '../services/configLookupService.js';

function sendLookupError(res: Response, req: Request, error: unknown): Response {
  const serviceError = error as Partial<AuthServiceError> & { details?: unknown; message?: string };
  console.error('[lookup] request failed', {
    request_id: req.requestId || 'unknown',
    method: req.method,
    path: req.originalUrl,
    error,
  });
  return res.status(serviceError.status || 500).json({
    ok: false,
    error_code: serviceError.errorCode || 'BERSN_API_INTERNAL_ERROR',
    message: serviceError.message || 'Internal server error.',
    details: serviceError.details || { request_id: req.requestId || 'unknown' },
  });
}

function requireRequestAuth(req: Request, res: Response): boolean {
  if (req.auth) {
    return true;
  }
  res.status(401).json({
    ok: false,
    error_code: 'BERSN_AUTH_TOKEN_INVALID',
    message: 'Authentication required.',
    details: { request_id: req.requestId || 'unknown' },
  });
  return false;
}

function setLookupCacheHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'private, max-age=300');
}

export async function getFullConfigLookup(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({ ok: true, config: getConfigLookups() });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getProjectConfigLookup(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({ ok: true, project: getProjectConfigLookups() });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getEnvelopeConfigLookup(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({ ok: true, envelope: getEnvelopeConfigLookups() });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getMepConfigLookup(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({ ok: true, mep: getMepConfigLookups() });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getClimateRegions(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      climate_regions: getProjectConfigLookups().climateRegions,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getUseCategories(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      use_categories: getProjectConfigLookups().useCategories,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getWallConstructions(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      wall_constructions: getEnvelopeConfigLookups().wallConstructions,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getRoofConstructions(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      roof_constructions: getEnvelopeConfigLookups().roofConstructions,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getGlazingTypes(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      glazing_types: getEnvelopeConfigLookups().glazingTypes,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getShadingTypes(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      shading_types: getEnvelopeConfigLookups().shadingTypes,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getHvacSystems(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      hvac_systems: getMepConfigLookups().hvacSystems,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getLightingSystems(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      lighting_systems: getMepConfigLookups().lightingSystems,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getElevatorTypes(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      elevator_types: getMepConfigLookups().elevatorTypes,
      elevator_reference: getMepConfigLookups().elevatorReference,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

export async function getDhwSystems(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  try {
    setLookupCacheHeaders(res);
    return res.status(200).json({
      ok: true,
      dhw_systems: getMepConfigLookups().dhwSystems,
      hotwater_reference: getMepConfigLookups().hotwaterReference,
    });
  } catch (error) {
    return sendLookupError(res, req, error);
  }
}

/**
 * BERSn manual parameter step guide.
 * Returns the ordered steps (per BERSn 2024 Manual Chapter 3) with
 * which panel, parameter ID and inputType each step maps to.
 * Both bern5 and CalEngine frontends use this to render step labels.
 */
/**
 * Complete BERSn formula catalog with references.
 * All formulas from BERSn 2024 Manual Chapter 3 and Appendix 2.
 */
export async function getFormulaCatalog(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  setLookupCacheHeaders(res);
  return res.status(200).json({
    ok: true,
    source: 'BERSn Manual 2024 — Chapter 3 Calculation Procedures, Appendix 2',
    formulas: [
      {
        id: 'AFe',
        nameZh: '有效樓地板面積',
        nameEn: 'Effective Floor Area',
        expression: 'AFe = AF − ΣAFk',
        variables: { AF: 'Total floor area (m²)', AFk: 'Exempt zone area (m²)' },
        ref: 'BERSn 2024 §3-1-1, §3-1-2',
        panel: 'project',
      },
      {
        id: 'EEV',
        nameZh: '外殼效率指標',
        nameEn: 'Envelope Efficiency Value',
        expression: 'EEV = [Σ(Uaw_i × Aaw_i) + Σ(Ui × ηi × Ki × Aaf_i) + Uar × Aar] / (ΣAaw + ΣAaf + Aar)',
        variables: {
          Uaw: 'Wall U-value (W/m²·K)', Aaw: 'Wall area (m²)',
          Ui: 'Glazing U-value', ηi: 'Solar transmittance', Ki: 'Shading factor',
          Aaf: 'Window area (m²)', Uar: 'Roof U-value', Aar: 'Roof area (m²)',
        },
        ref: 'BERSn 2024 Appendix 2 §2, Formulas 1–5',
        panel: 'envelope',
        evComplianceCheck: 'EEV must be ≤ EVc threshold for the building type/WWR band',
      },
      {
        id: 'UAW_compliance',
        nameZh: '外牆平均熱傳透率合規確認',
        nameEn: 'Wall Average U-value (UAW) Compliance',
        expression: 'Uaw_weighted = Σ(Ui × Ai) / ΣAi ≤ EVc_UAW',
        variables: { Ui: 'U-value of each wall section', Ai: 'Area of each wall section', EVc_UAW: 'Compliance threshold from Appendix 2 Table 1' },
        ref: 'BERSn 2024 Appendix 2 Table 1 — EVc/EVmin for UAW',
        panel: 'envelope',
      },
      {
        id: 'UAR_compliance',
        nameZh: '屋頂平均熱傳透率合規確認',
        nameEn: 'Roof Average U-value (UAR) Compliance',
        expression: 'Uar_weighted = Σ(Ui × Ai) / ΣAi ≤ EVc_UAR',
        variables: { EVc_UAR: 'Compliance threshold from Appendix 2 Table 1; EVc=0.8, EVmin=0.4 W/m²·K' },
        ref: 'BERSn 2024 Appendix 2 Table 1 — EVc/EVmin for UAR',
        panel: 'envelope',
      },
      {
        id: 'U_from_layers',
        nameZh: '由材料層計算U值（ISO 6946）',
        nameEn: 'U-value from Material Layers (ISO 6946)',
        expression: 'U = 1 / (Ri + Σ(d_i / λ_i) + Ro)',
        variables: {
          Ri: 'Internal surface resistance = 0.11 m²·K/W (wall) or 0.10 (roof)',
          Ro: 'External surface resistance = 0.04 m²·K/W',
          d_i: 'Layer thickness (m)', 'λ_i': 'Layer thermal conductivity (W/m·K)',
        },
        ref: 'ISO 6946:2017 — Building components thermal resistance and transmittance',
        panel: 'envelope',
      },
      {
        id: 'EAC',
        nameZh: '空調效率指標',
        nameEn: 'HVAC Efficiency Coefficient',
        expressionCentral: 'EAC = 1 − (BW × HT × Arx)',
        expressionIndividual: 'EAC = INAC × BW × (1 − Arx)',
        variables: {
          BW: 'Pump/fan efficiency bonus (default 1.0)', HT: 'Variable speed bonus (1.0 or 1.1)',
          Arx: 'Grade reduction factor (e.g. 0.29 for Grade 2)', INAC: '0.9 for individual AC',
        },
        ref: 'BERSn 2024 Appendix 2 §4, Formulas 15 (central) and 16b (individual)',
        panel: 'mep',
      },
      {
        id: 'EL',
        nameZh: '照明效率指標',
        nameEn: 'Lighting Efficiency Coefficient',
        expression: 'EL = β × (LPD_design / LPD_baseline)',
        variables: { 'β': 'Management factor from Table 10 (0.75–1.0)', LPD_design: 'Actual LPD (W/m²)', LPD_baseline: 'Baseline LPD from Table 11 by space type' },
        ref: 'BERSn 2024 Appendix 2 §5, Formula 17; Table 10 (β); Table 11 (LPD baseline)',
        panel: 'mep',
      },
      {
        id: 'EtEUI',
        nameZh: '電梯能耗強度',
        nameEn: 'Elevator Energy Use Intensity',
        expression: 'EtEUI = 0.6 × Σ(Nej × Eelj × YOHj) / AFe',
        variables: { Nej: 'Number of elevators in group j', Eelj: 'Reference energy (kWh/car·hr) from Table 3-1', YOHj: 'Annual operating hours', '0.6': 'Occupancy factor' },
        ref: 'BERSn 2024 §3-3-1, Table 3-1',
        panel: 'mep',
      },
      {
        id: 'HpEUI',
        nameZh: '熱水能耗強度',
        nameEn: 'Hot Water Energy Use Intensity',
        expression: 'HpEUI = HPC × 8.0 × 365 × 0.7 / AFe',
        variables: { HPC: 'Installed heating capacity (kW)', '8.0': 'Daily operation hours', '365': 'Days per year', '0.7': 'Load factor (LFw)' },
        ref: 'BERSn 2024 §3-3-2, Table 3-3',
        panel: 'mep',
      },
      {
        id: 'weights',
        nameZh: '子系統權重係數',
        nameEn: 'Subsystem Weight Coefficients',
        expression: 'a = AEUI/D, b = LEUI/D, c = EtEUI/D, d = HpEUI/D; D = AEUI+LEUI+EtEUI+HpEUI',
        variables: { AEUI: 'AC baseline EUI', LEUI: 'Lighting baseline EUI', D: 'Total baseline EUI denominator' },
        ref: 'BERSn 2024 §3-2, Formula 7',
        panel: 'calculation',
      },
      {
        id: 'EEI',
        nameZh: '能效指標',
        nameEn: 'Energy Efficiency Indicator',
        expression: 'EEI = a×(EAC − EEV×Es) + b×EL + c×Et + d×EHW',
        variables: { Es: 'Envelope-HVAC interaction factor from Table 3-2', Et: 'Elevator efficiency factor' },
        ref: 'BERSn 2024 §3-2, Formula 6',
        panel: 'calculation',
      },
      {
        id: 'SCOREee',
        nameZh: '能效得分',
        nameEn: 'Energy Efficiency Score',
        expressionLow: 'if EEI ≤ 0.8: SCOREee = 50 + 40×(0.8−EEI)/0.3',
        expressionHigh: 'if EEI > 0.8: SCOREee = 50×(2.0−EEI)/1.2',
        ref: 'BERSn 2024 §2-6, Score band formulas',
        panel: 'calculation',
      },
      {
        id: 'grade',
        nameZh: 'BERS能效等級',
        nameEn: 'BERS Energy Efficiency Grade',
        table: [
          { grade: '1+', scoreMin: 90, meaning: '近零能耗建築 / Near-Zero Energy Building' },
          { grade: '1',  scoreMin: 80, meaning: '超低能耗 / Ultra-Low Energy' },
          { grade: '2',  scoreMin: 70, meaning: '高效能 / High Performance' },
          { grade: '3',  scoreMin: 60, meaning: '優良 / Good' },
          { grade: '4',  scoreMin: 50, meaning: '合格 / Compliant' },
          { grade: '5',  scoreMin: 40, meaning: '待改善 / Needs Improvement' },
          { grade: '6',  scoreMin: 30, meaning: '高能耗 / High Energy Use' },
          { grade: '7',  scoreMin: 0,  meaning: '極高能耗 / Very High Energy Use' },
        ],
        ref: 'BERSn 2024 §2-6, Table 2-4',
        panel: 'result',
      },
    ],
  });
}

export async function getStepGuide(req: Request, res: Response): Promise<Response> {
  if (!requireRequestAuth(req, res)) {
    return res;
  }
  setLookupCacheHeaders(res);
  return res.status(200).json({
    ok: true,
    steps: [
      {
        step: '1',
        labelZh: '地理區域 / UR係數',
        labelEn: 'Climate Region / UR Factor',
        panel: 'project',
        paramId: 'selected_region',
        inputType: 'lookup',
        tableRef: 'BERSn Manual 2024 Appendix 1, Table A — UR values by region',
        hint: 'Select the climate zone where the building is located. UR is automatically looked up from the standard table.',
        hintZh: '選擇建築所在氣候分區，UR值由系統自動查表取得，無需手動輸入。',
      },
      {
        step: '2',
        labelZh: '建築用途類別 / AEUI基準',
        labelEn: 'Building Use Category / AEUI Baseline',
        panel: 'project',
        paramId: 'selected_use_category',
        inputType: 'lookup',
        tableRef: 'BERSn Manual 2024 Table 3-2 — AEUI, LEUI, EEUI by use category',
        hint: 'Select the primary building use. AEUI, LEUI and EEUI are automatically retrieved from Table 3-2.',
        hintZh: '選擇建築主要用途，系統自動從表3-2取得AEUI、LEUI、EEUI基準值。',
      },
      {
        step: '3',
        labelZh: '總樓地板面積 (AF)',
        labelEn: 'Total Floor Area (AF)',
        panel: 'project',
        paramId: 'total_floor_area',
        inputType: 'manual',
        tableRef: 'BERSn Manual 2024 §3-1-1',
        validRange: { min: 1, max: 9999999, unit: 'm²' },
        hint: 'Enter the total floor area AF in m². This is manually entered and must match the building permit drawings.',
        hintZh: '手動輸入建築總樓地板面積AF（m²），應與建築執照圖面一致。',
      },
      {
        step: '3.1',
        labelZh: '免評估分區 (AFk)',
        labelEn: 'Exempt Zones (AFk)',
        panel: 'project',
        paramId: 'exempt_areas',
        inputType: 'manual',
        tableRef: 'BERSn Manual 2024 §3-1-2 — Exempt area categories',
        hint: 'Add exempt zones (outdoor floors, civil defense, parking, storage ≥100m² without AC). AFe = AF − ΣAFk.',
        hintZh: '新增免評估分區（室外樓地板、防空避難、停車場、無空調儲藏室≥100m²）。AFe=AF-ΣAFk。',
      },
      {
        step: '4',
        labelZh: '外牆構造 (Uaw)',
        labelEn: 'Wall Construction (Uaw)',
        panel: 'envelope',
        paramId: 'selected_wall',
        inputType: 'lookup',
        tableRef: 'BERSn Manual 2024 Appendix 2, Table 1 + Attachment 1 Tables 6–8',
        hint: 'Select wall construction type. U-value (W/m²·K) is looked up from the official table. Must meet EVc threshold.',
        hintZh: '選擇外牆構造，U值由附錄二查表取得。所選U值不得超過EVc門檻值。',
        compliance: { evIndicator: 'UAW', tableRef: 'Appendix 2 Table 1' },
      },
      {
        step: '4.1',
        labelZh: '外牆自訂構造（k值+厚度）',
        labelEn: 'Custom Wall Construction (k-value + thickness)',
        panel: 'envelope',
        paramId: 'wall_custom_layers',
        inputType: 'manual_custom',
        tableRef: 'BERSn Manual 2024 Appendix 2 §2 — U = 1/(Ri + Σd/λ + Ro)',
        formula: 'U = 1 / (0.11 + Σ(d_i / λ_i) + 0.04)',
        hint: 'For custom wall assemblies: enter each material layer with thickness (d, mm) and thermal conductivity (λ, W/m·K). U is calculated automatically.',
        hintZh: '自訂外牆構造：輸入每層材料厚度d(mm)與導熱係數λ(W/m·K)，系統自動計算U值。',
      },
      {
        step: '5',
        labelZh: '屋頂構造 (Uar)',
        labelEn: 'Roof Construction (Uar)',
        panel: 'envelope',
        paramId: 'selected_roof',
        inputType: 'lookup',
        tableRef: 'BERSn Manual 2024 Appendix 2, Table 1 + Attachment 1 Tables 7–9',
        hint: 'Select roof construction. U-value is looked up from the official table. Must meet Uar EVc threshold.',
        hintZh: '選擇屋頂構造，U值由附錄二查表取得，不得超過Uar EVc門檻值。',
        compliance: { evIndicator: 'UAR', tableRef: 'Appendix 2 Table 1' },
      },
      {
        step: '6',
        labelZh: '窗戶遮陽係數 (Ki/SF)',
        labelEn: 'Window Shading Factor (Ki/SF)',
        panel: 'envelope',
        paramId: 'selected_shading',
        inputType: 'lookup',
        tableRef: 'BERSn Manual 2024 Appendix 2, Table 1 — SF baseline by WWR band',
        hint: 'Select shading type. Ki is looked up by WWR band from Table 1. Select based on the actual shading device installed.',
        hintZh: '選擇遮陽類型，Ki由開窗率對照表一查表取得，應依實際遮陽設施選擇。',
      },
      {
        step: '7',
        labelZh: '玻璃類型 (Ug / ηi)',
        labelEn: 'Glazing Type (Ug / ηi)',
        panel: 'envelope',
        paramId: 'selected_glazing',
        inputType: 'lookup',
        tableRef: 'BERSn Manual 2024 Appendix 2, Table 5 — Glass Ui; §6 — ηi reference standard',
        hint: 'Select glazing type. Ug (W/m²·K) and ηi (solar transmittance) are looked up from Appendix 2 Table 5.',
        hintZh: '選擇玻璃類型，Ug與ηi由附錄二表5查表取得。',
        compliance: { evIndicator: 'UAF', tableRef: 'Appendix 2 Table 1' },
      },
      {
        step: '8',
        labelZh: '空調系統 (EAC)',
        labelEn: 'HVAC System (EAC)',
        panel: 'mep',
        paramId: 'selected_hvac',
        inputType: 'lookup',
        tableRef: 'BERSn Manual 2024 Appendix 2 §4(B)(C), Formulas 15–16b',
        hint: 'Select HVAC system type. EAC is calculated from the official formula based on system grade and type.',
        hintZh: '選擇空調系統，EAC依附錄二公式15–16b自動計算。',
      },
      {
        step: '9',
        labelZh: '照明系統 (EL)',
        labelEn: 'Lighting System (EL)',
        panel: 'mep',
        paramId: 'selected_lighting',
        inputType: 'lookup',
        tableRef: 'BERSn Manual 2024 Appendix 2 §5, Formula 17; Table 10 — β management factor; Table 11 — LPD',
        hint: 'Select lighting control strategy. EL = β × (LPD_design / LPD_baseline). β is looked up from Table 10.',
        hintZh: '選擇照明控制策略，EL=β×(設計LPD/基準LPD)，β由表10查取。',
      },
      {
        step: '10',
        labelZh: '電梯系統 (Et / EtEUI)',
        labelEn: 'Elevator System (Et / EtEUI)',
        panel: 'mep',
        paramId: 'selected_elevator',
        inputType: 'lookup_manual',
        tableRef: 'BERSn Manual 2024 §3-3-1 — Et; Table 3-1 — Eelj reference energy',
        hint: 'Select elevator type (Et from table) and enter elevator count and YOHj hours. EtEUI = 0.6×Σ(Nej×Eelj×YOHj)/AFe.',
        hintZh: '選擇電梯類型(Et查表)，手動輸入台數及年運轉時數YOHj。EtEUI=0.6×Σ(Nej×Eelj×YOHj)/AFe。',
        formula: 'EtEUI = 0.6 × Σ(Nej × Eelj × YOHj) / AFe',
      },
      {
        step: '11',
        labelZh: '熱水系統 (EHW / HpEUI)',
        labelEn: 'DHW System (EHW / HpEUI)',
        panel: 'mep',
        paramId: 'selected_dhw',
        inputType: 'lookup_manual',
        tableRef: 'BERSn Manual 2024 §3-3-2 — EHW; Table 3-3 — HPC defaults by use category',
        hint: 'If central hot water system exists, select system type (EHW from table) and enter HPC (kW). HpEUI = HPC×8×365×0.7/AFe.',
        hintZh: '若有中央熱水系統，選擇系統類型(EHW查表)並輸入HPC(kW)。HpEUI=HPC×8×365×0.7/AFe。',
        formula: 'HpEUI = HPC × 8 × 365 × 0.7 / AFe',
      },
    ],
  });
}
