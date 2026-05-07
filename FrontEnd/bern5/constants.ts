
import { BuildingCategory, GeographicRegion, Measure } from './types';

export const REGION_UR_MAP: Record<GeographicRegion, number> = {
  [GeographicRegion.A]: 1.0,
  [GeographicRegion.B]: 0.95,
  [GeographicRegion.C]: 0.9,
  [GeographicRegion.D]: 0.85,
};

export const BASE_EUI = {
  [BuildingCategory.OFFICE]: { AEUI: 80, LEUI: 40, EtEUI: 15, HpEUI: 5, Es: 1.2 },
  [BuildingCategory.HOTEL]: { AEUI: 120, LEUI: 50, EtEUI: 20, HpEUI: 40, Es: 1.1 },
  [BuildingCategory.HOSPITAL]: { AEUI: 150, LEUI: 60, EtEUI: 15, HpEUI: 30, Es: 1.0 },
  [BuildingCategory.SCHOOL]: { AEUI: 60, LEUI: 30, EtEUI: 10, HpEUI: 10, Es: 1.3 },
  [BuildingCategory.MALL]: { AEUI: 180, LEUI: 100, EtEUI: 25, HpEUI: 10, Es: 1.1 },
  [BuildingCategory.RESIDENTIAL]: { AEUI: 40, LEUI: 20, EtEUI: 15, HpEUI: 20, Es: 1.4 },
  [BuildingCategory.MIXED]: { AEUI: 100, LEUI: 50, EtEUI: 18, HpEUI: 15, Es: 1.2 },
};

export const MEASURE_LIBRARY: Measure[] = [
  {
    id: 'm1',
    name: 'High-Perf Glazing (Low-E)',
    category: 'Envelope',
    description: 'Upgrade to Triple-pane Low-E glass to reduce solar gain and U-value.',
    eligibility: { minWWR: 0.2 },
    patches: [
      { path: 'envelope.glassUValue', value: 1.2 },
      { path: 'envelope.glassEtaI', value: 0.45 }
    ],
    costModel: { type: 'PER_M2_WINDOW', unitCost: 4500 }
  },
  {
    id: 'm2',
    name: 'External Shading (Louver)',
    category: 'Envelope',
    description: 'Install fixed external louvers to provide permanent solar protection.',
    eligibility: { buildingUse: [BuildingCategory.OFFICE, BuildingCategory.SCHOOL] },
    patches: [
      { path: 'envelope.shadingKi', value: 0.75 }
    ],
    costModel: { type: 'PER_M2_WINDOW', unitCost: 2800 }
  },
  {
    id: 'm3',
    name: 'Ultra-LED & Sensor Control',
    category: 'Lighting',
    description: 'Replace all lighting with High-efficacy LEDs and occupancy sensors.',
    eligibility: {},
    patches: [
      { path: 'mep.lighting.lpd', value: 6.5 },
      { path: 'mep.lighting.controlFactor', value: 0.8 }
    ],
    costModel: { type: 'PER_UNIT', unitCost: 150000 }
  },
  {
    id: 'm4',
    name: 'High-Efficiency VRF (Gen 7)',
    category: 'HVAC',
    description: 'Upgrade HVAC units to next-gen VRF with higher part-load efficiency.',
    eligibility: { requiresCentralHVAC: true },
    patches: [
      { path: 'mep.hvac.cop', value: 4.8 },
      { path: 'mep.hvac.controlStrategy', value: 0.85 }
    ],
    costModel: { type: 'PER_UNIT', unitCost: 1200000 }
  },
  {
    id: 'm5',
    name: 'Elevator Regen Drive',
    category: 'Elevator',
    description: 'Add regenerative power recovery to elevator motors.',
    eligibility: {},
    patches: [
      { path: 'mep.elevator.effConstant', value: 0.45 }
    ],
    costModel: { type: 'PER_UNIT', unitCost: 80000 }
  },
  {
    id: 'm6',
    name: 'Vacuum Roof Insulation',
    category: 'Envelope',
    description: 'Add high-performance VIP panels to existing roof structure.',
    eligibility: {},
    patches: [
      { path: 'envelope.roofUValue', value: 0.15 }
    ],
    costModel: { type: 'PER_M2_ROOF', unitCost: 1200 }
  },
  {
    id: 'm7',
    name: 'Advanced Chiller Plant',
    category: 'HVAC',
    description: 'Magnetic bearing centrifugal chiller with secondary pumping.',
    eligibility: { buildingUse: [BuildingCategory.OFFICE, BuildingCategory.HOTEL, BuildingCategory.MALL] },
    patches: [
      { path: 'mep.hvac.cop', value: 6.2 },
      { path: 'mep.hvac.auxEff', value: 0.95 }
    ],
    costModel: { type: 'FIXED', unitCost: 3500000 }
  },
  {
    id: 'm8',
    name: 'Smart Blind System',
    category: 'Control',
    description: 'Automated dynamic shading controlled by cloud-based solar tracking.',
    eligibility: { minWWR: 0.35 },
    patches: [
      { path: 'envelope.shadingKi', value: 0.65 }
    ],
    costModel: { type: 'PER_M2_WINDOW', unitCost: 6500 }
  },
  {
    id: 'm9',
    name: 'Heat Pump Water Heating',
    category: 'DHW',
    description: 'Replace electric water heaters with air-source heat pumps.',
    eligibility: { buildingUse: [BuildingCategory.HOTEL, BuildingCategory.HOSPITAL] },
    patches: [
      { path: 'mep.dhw.hasDhw', value: 1 },
      { path: 'mep.dhw.hpc', value: 0.4 }
    ],
    costModel: { type: 'FIXED', unitCost: 450000 }
  },
  {
    id: 'm10',
    name: 'Wall External Insulation',
    category: 'Envelope',
    description: 'Add 10cm mineral wool board to the facade exterior.',
    eligibility: {},
    patches: [
      { path: 'envelope.wallUValue', value: 0.45 }
    ],
    costModel: { type: 'PER_M2_FACADE', unitCost: 1800 }
  },
  {
    id: 'm11',
    name: 'Smart Energy Management',
    category: 'Control',
    description: 'Install BEMS for holistic building energy optimization.',
    eligibility: {},
    patches: [
      { path: 'mep.hvac.controlStrategy', value: 0.8 },
      { path: 'mep.lighting.controlFactor', value: 0.9 }
    ],
    costModel: { type: 'PER_UNIT', unitCost: 500000 }
  },
  {
    id: 'm12',
    name: 'LPD Optimization',
    category: 'Lighting',
    description: 'Aggressive interior lighting redesign to minimize LPD.',
    eligibility: {},
    patches: [
      { path: 'mep.lighting.lpd', value: 5.0 }
    ],
    costModel: { type: 'PER_UNIT', unitCost: 250000 }
  }
];
