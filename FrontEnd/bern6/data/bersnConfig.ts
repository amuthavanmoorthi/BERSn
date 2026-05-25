// BERSn Calculation Configuration Data
// Based on user-provided specifications

// === Use Categories (建築用途類別) ===
export const USE_CATEGORIES = [
    { id: 'USE_OFFICE', name: '辦公', nameEn: 'Office', hasCentralDHWDefault: false },
    { id: 'USE_RETAIL', name: '零售', nameEn: 'Retail', hasCentralDHWDefault: false },
    { id: 'USE_HOTEL', name: '旅館', nameEn: 'Hotel', hasCentralDHWDefault: true },
    { id: 'USE_HOSPITAL', name: '醫院', nameEn: 'Hospital', hasCentralDHWDefault: true },
    { id: 'USE_DORM', name: '宿舍', nameEn: 'Dormitory', hasCentralDHWDefault: true },
    { id: 'USE_GYM', name: '運動休閒', nameEn: 'Gym/Recreation', hasCentralDHWDefault: true },
] as const;

export type UseCategoryId = typeof USE_CATEGORIES[number]['id'];

// === EUI Tables (能耗強度表) ===
export const EUI_TABLE: Record<UseCategoryId, { AEUI: number; LEUI: number; EEUI: number }> = {
    USE_OFFICE: { AEUI: 120, LEUI: 35, EEUI: 8 },
    USE_RETAIL: { AEUI: 150, LEUI: 50, EEUI: 5 },
    USE_HOTEL: { AEUI: 180, LEUI: 30, EEUI: 12 },
    USE_HOSPITAL: { AEUI: 250, LEUI: 45, EEUI: 15 },
    USE_DORM: { AEUI: 80, LEUI: 20, EEUI: 10 },
    USE_GYM: { AEUI: 130, LEUI: 40, EEUI: 6 },
};

// === Es Table (水耗標準) ===
export const ES_TABLE: Record<UseCategoryId, number> = {
    USE_OFFICE: 0.15,
    USE_RETAIL: 0.12,
    USE_HOTEL: 0.25,
    USE_HOSPITAL: 0.30,
    USE_DORM: 0.20,
    USE_GYM: 0.35,
};

// === Elevator Systems (電梯系統) ===
export const ELEVATOR_HEIGHT_CATEGORIES = [
    { id: 'EH_LOW', name: '低層 (≤7F)', nameEn: 'Low-rise', Eelj: 0.06, YOHj: 2000 },
    { id: 'EH_MID', name: '中層 (8-15F)', nameEn: 'Mid-rise', Eelj: 0.08, YOHj: 2500 },
    { id: 'EH_HIGH', name: '高層 (>15F)', nameEn: 'High-rise', Eelj: 0.10, YOHj: 3000 },
] as const;

export const ELEVATOR_TYPES = [
    { id: 'ET_ACVV', name: 'ACVV 交流變壓變頻', nameEn: 'ACVV', EtValue: 1.0 },
    { id: 'ET_VVVF', name: 'VVVF 變頻驅動', nameEn: 'VVVF', EtValue: 0.6 },
    { id: 'ET_VVVF_REGEN', name: 'VVVF 回生制動', nameEn: 'VVVF Regen', EtValue: 0.4 },
] as const;

export const ELEVATOR_CONSTANTS = {
    occupancyFactor: 0.6,
};

// === HVAC Systems (空調系統) ===
export const HVAC_SYSTEMS = [
    {
        id: 'HVAC_SPLIT',
        name: '分離式冷氣',
        nameEn: 'Split AC',
        defaultEAC: 1.0,
        params: { cop: 3.0, controls: 'manual' }
    },
    {
        id: 'HVAC_VRF',
        name: 'VRF 變冷媒流量',
        nameEn: 'VRF System',
        defaultEAC: 0.75,
        params: { cop: 4.5, controls: 'auto' }
    },
    {
        id: 'HVAC_CHILLER',
        name: '冰水主機系統',
        nameEn: 'Chiller System',
        defaultEAC: 0.65,
        params: { iplv: 5.5, pumpEff: 0.8, fanEff: 0.7 }
    },
    {
        id: 'HVAC_CHILLER_VSD',
        name: '冰水主機+變頻',
        nameEn: 'Chiller+VSD',
        defaultEAC: 0.5,
        params: { iplv: 6.5, pumpEff: 0.85, fanEff: 0.8 }
    },
] as const;

// === Lighting Systems (照明系統) ===
export const LIGHTING_SYSTEMS = [
    {
        id: 'LGT_FLUO',
        name: '傳統日光燈',
        nameEn: 'Fluorescent',
        defaultEL: 1.0,
        params: { lpd: 15, controls: 'switch', dimming: false, occupancySensor: false }
    },
    {
        id: 'LGT_T5',
        name: 'T5 高效日光燈',
        nameEn: 'T5 Fluorescent',
        defaultEL: 0.8,
        params: { lpd: 12, controls: 'switch', dimming: false, occupancySensor: false }
    },
    {
        id: 'LGT_LED',
        name: 'LED 照明',
        nameEn: 'LED',
        defaultEL: 0.6,
        params: { lpd: 9, controls: 'switch', dimming: false, occupancySensor: false }
    },
    {
        id: 'LGT_LED_DIM',
        name: 'LED + 調光控制',
        nameEn: 'LED + Dimming',
        defaultEL: 0.45,
        params: { lpd: 8, controls: 'dimmer', dimming: true, occupancySensor: false }
    },
    {
        id: 'LGT_LED_SMART',
        name: 'LED + 智慧控制',
        nameEn: 'LED + Smart',
        defaultEL: 0.35,
        params: { lpd: 7, controls: 'smart', dimming: true, occupancySensor: true }
    },
] as const;

// === DHW Systems (熱水系統) ===
export const DHW_SYSTEMS = [
    { id: 'DHW_NONE', name: '無集中熱水', nameEn: 'None', EHW: 0 },
    { id: 'DHW_ELECTRIC', name: '電熱式', nameEn: 'Electric', EHW: 1.0 },
    { id: 'DHW_GAS', name: '瓦斯熱水器', nameEn: 'Gas', EHW: 0.8 },
    { id: 'DHW_HEATPUMP', name: '熱泵熱水器', nameEn: 'Heat Pump', EHW: 0.4 },
    { id: 'DHW_HEATPUMP_TANK', name: '熱泵 + 儲熱槽', nameEn: 'Heat Pump + Tank', EHW: 0.35 },
    { id: 'DHW_SOLAR', name: '太陽能熱水', nameEn: 'Solar', EHW: 0.2 },
] as const;

// === Geographic Regions (氣候分區) ===
export const CLIMATE_REGIONS = [
    { id: 'REGION_A', name: 'A區 (都會核心)', nameEn: 'Zone A (Urban Core)', ur: 1.0 },
    { id: 'REGION_B', name: 'B區 (都市區)', nameEn: 'Zone B (Urban)', ur: 0.95 },
    { id: 'REGION_C', name: 'C區 (郊區)', nameEn: 'Zone C (Suburban)', ur: 0.9 },
    { id: 'REGION_D', name: 'D區 (鄉村/特殊)', nameEn: 'Zone D (Rural)', ur: 0.85 },
] as const;

// === Materials (建材) ===
export const MATERIALS = [
    { id: 'MAT_CONCRETE', name: '混凝土', nameEn: 'Concrete', kDefault: 1.4 },
    { id: 'MAT_BRICK', name: '磚', nameEn: 'Brick', kDefault: 0.7 },
    { id: 'MAT_INSULATION', name: '保溫材', nameEn: 'Insulation', kDefault: 0.04 },
    { id: 'MAT_GYPSUM', name: '石膏板', nameEn: 'Gypsum Board', kDefault: 0.25 },
    { id: 'MAT_STEEL', name: '鋼材', nameEn: 'Steel', kDefault: 50 },
    { id: 'MAT_GLASS', name: '玻璃', nameEn: 'Glass', kDefault: 1.0 },
] as const;

// === Wall Constructions (外牆構造) ===
export const WALL_CONSTRUCTIONS = [
    { id: 'CONS_WALL_RC', name: 'RC牆 (標準)', nameEn: 'RC Wall', uValue: 3.5 },
    { id: 'CONS_WALL_RC_INS', name: 'RC牆 + 隔熱板', nameEn: 'RC + Insulation', uValue: 0.65 },
    { id: 'CONS_WALL_CURTAIN', name: '帷幕牆系統', nameEn: 'Curtain Wall', uValue: 2.0 },
    { id: 'CONS_WALL_BRICK', name: '磚牆 + 隔熱', nameEn: 'Brick + Insulation', uValue: 0.55 },
] as const;

// === Roof Constructions (屋頂構造) ===
export const ROOF_CONSTRUCTIONS = [
    { id: 'CONS_ROOF_RC', name: 'RC屋頂 (標準)', nameEn: 'RC Roof', uValue: 2.8 },
    { id: 'CONS_ROOF_RC_INS', name: 'RC屋頂 + 隔熱', nameEn: 'RC + Insulation', uValue: 0.45 },
    { id: 'CONS_ROOF_GREEN', name: '綠屋頂', nameEn: 'Green Roof', uValue: 0.35 },
    { id: 'CONS_ROOF_COOL', name: '冷屋頂 (高反射)', nameEn: 'Cool Roof', uValue: 0.5 },
] as const;

// === Shading Types (遮陽類型) ===
export const SHADING_TYPES = [
    { id: 'SH_NONE', name: '無外遮陽', nameEn: 'None', Ki: 1.0 },
    { id: 'SH_OVERHANG', name: '水平遮陽板', nameEn: 'Horizontal', Ki: 0.75 },
    { id: 'SH_FIN', name: '垂直遮陽板', nameEn: 'Vertical Fin', Ki: 0.8 },
    { id: 'SH_EGGCRATE', name: '格柵遮陽', nameEn: 'Eggcrate', Ki: 0.6 },
    { id: 'SH_LOUVER', name: '百葉遮陽', nameEn: 'Louver', Ki: 0.65 },
] as const;

// === Glazing Types (玻璃類型) ===
export const GLAZING_TYPES = [
    { id: 'GLZ_CLEAR', name: '透明單層玻璃', nameEn: 'Clear Single', U: 5.8, eta_i: 0.85 },
    { id: 'GLZ_TINT', name: '染色玻璃', nameEn: 'Tinted', U: 5.5, eta_i: 0.6 },
    { id: 'GLZ_DBL', name: '雙層中空玻璃', nameEn: 'Double Clear', U: 2.8, eta_i: 0.7 },
    { id: 'GLZ_DBL_LOW_E', name: '雙層Low-E玻璃', nameEn: 'Double Low-E', U: 1.8, eta_i: 0.55 },
    { id: 'GLZ_TRIPLE', name: '三層玻璃', nameEn: 'Triple', U: 1.2, eta_i: 0.5 },
    { id: 'GLZ_VACUUM', name: '真空玻璃', nameEn: 'Vacuum', U: 0.5, eta_i: 0.35 },
] as const;

// === Mappings: BERSn library IDs → simplified categorical types used by FloorShape.params ===
// These bridge the project-level Envelope selection (STEP 3) to the per-shape
// facade default applied when a new shape is drawn. Users can override per
// shape via FloorManagerPanel.
export const bersnGlazingToCategorical = (id: string): 'Single' | 'Double' | 'Triple-LowE' | 'Vacuum' => {
    switch (id) {
        case 'GLZ_CLEAR':
        case 'GLZ_TINT':
            return 'Single';
        case 'GLZ_DBL':
            return 'Double';
        case 'GLZ_DBL_LOW_E':
        case 'GLZ_TRIPLE':
            return 'Triple-LowE';
        case 'GLZ_VACUUM':
            return 'Vacuum';
        default:
            return 'Double';
    }
};
export const bersnShadingToCategorical = (id: string): 'None' | 'Horizontal' | 'Vertical' | 'Eggcrate' | 'Louver' => {
    switch (id) {
        case 'SH_NONE':     return 'None';
        case 'SH_OVERHANG': return 'Horizontal';
        case 'SH_FIN':      return 'Vertical';
        case 'SH_EGGCRATE': return 'Eggcrate';
        case 'SH_LOUVER':   return 'Louver';
        default:            return 'None';
    }
};

// Helper function to get display name based on language
export const getDisplayName = (item: { name: string; nameEn: string }, lang: 'zh' | 'en') => {
    return lang === 'zh' ? item.name : item.nameEn;
};

