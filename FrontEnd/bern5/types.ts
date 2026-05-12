
export enum BuildingCategory {
  OFFICE = 'Office',
  HOTEL = 'Hotel',
  HOSPITAL = 'Hospital',
  SCHOOL = 'School',
  MALL = 'Mall',
  RESIDENTIAL = 'Residential',
  MIXED = 'Mixed Use'
}

export enum HVACMode {
  YEAR_ROUND = 'Year-round',
  INTERMITTENT = 'Intermittent'
}

export enum GeographicRegion {
  A = 'Region A (Urban Core)',
  B = 'Region B (Urban)',
  C = 'Region C (Suburban)',
  D = 'Region D (Rural/Special)'
}

// 免評估原因類型
export type ExemptReason =
  | 'outdoor'     // 室外樓地板
  | 'shelter'     // 防空避難
  | 'parking'     // 室內停車
  | 'storage';    // 儲藏/設備空間 ≥100m² 且無空調

export interface ExemptArea {
  id: string;
  name: string;           // 分區名稱
  reason: ExemptReason;   // 免評估原因
  area: number;           // 面積 (m²)
}

export interface ProjectBaseline {
  id: string;
  name: string;
  address: string;
  category: BuildingCategory;
  region: GeographicRegion;
  ur: number;
  hvacMode: HVACMode;
  intermittentChecks: {
    shortDepth: boolean;
    noCentralPlant: boolean;
    openableWindows: boolean;
  };
  totalFloorAreaAF: number;
  exemptAreas: ExemptArea[];
  envelope: {
    wallMaterial: string;
    wallThickness: number;
    wallKValue: number;
    wallUValue: number;
    roofMaterial: string;
    roofThickness: number;
    roofKValue: number;
    roofUValue: number;
    eev: number;
    shadingKi: number;
    glassUValue: number;
    glassEtaI: number;
  };
  mep: {
    hvac: {
      systemType: string;
      cop: number;
      auxEff: number;
      controlStrategy: number;
      coverage: number;
    };
    lighting: {
      lpd: number;
      controlFactor: number;
      coverage: number;
    };
    elevator: {
      type: string;
      effConstant: number;
      numElevators: number;
      energyPerCycle: number;
      yearlyHours: number;
    };
    dhw: {
      hasDhw: boolean;
      systemType: string;
      hpc: number;
      ehwConstant: number;
      loadFactor: number;
    };
  };
}

export type MeasureCategory = "Envelope" | "HVAC" | "Lighting" | "Elevator" | "DHW" | "Control";

export interface EligibilityRule {
  buildingUse?: BuildingCategory[];
  minWWR?: number;
  maxWWR?: number;
  requiresCentralHVAC?: boolean;
}

export interface ParamPatch {
  path: string;
  value: number | string;
}

export type CostType = "PER_M2_WINDOW" | "PER_M2_FACADE" | "PER_M2_ROOF" | "PER_UNIT" | "FIXED";

export interface Measure {
  id: string;
  name: string;
  category: MeasureCategory;
  description: string;
  eligibility: EligibilityRule;
  patches: ParamPatch[];
  costModel: {
    type: CostType;
    unitCost: number;
  };
}

export interface MeasureImpact {
  measureId: string;
  deltaEEI: number;
  deltaScore: number;
  cost?: number;      // Legacy
  totalCost: number;
  cpValue: number;
  isEligible: boolean;
  ineligibleReason?: string;
}

export interface Scenario {
  id: string;
  name: string;
  selectedMeasureIds: string[];
}

// 8 Geometry Types based on BERSn specification (including polyline for custom outlines)
export type GeometryType = 'box' | 'lShape' | 'tShape' | 'cylinder' | 'arc' | 'ellipse' | 'fan' | 'polygon' | 'polyline';

// Polyline point for custom 2D outlines
export interface PolylinePoint {
  x: number;
  y: number;
}
export type GlassType = 'Single' | 'Double' | 'Triple-LowE' | 'Vacuum';
export type ShadingType = 'None' | 'Horizontal' | 'Vertical' | 'Eggcrate' | 'Louver';
export type LShapeDirection = 'TopLeft' | 'TopRight' | 'BottomLeft' | 'BottomRight';
export type TShapeWingPosition = 'top' | 'bottom' | 'left' | 'right';

export interface GeometryObject {
  id: string;
  type: GeometryType;
  params: {
    // Common parameters
    height: number;
    azimuth: number;  // 方位角 (Orientation) in degrees
    wwr?: number;
    glassType?: GlassType;
    shadingType?: ShadingType;

    // Box (長方體/稜柱體) parameters
    width?: number;   // 寬度
    length?: number;  // 長度

    // Cylinder (圓柱體) parameters
    radius?: number;  // 半徑

    // L-Shape (L形複合體) parameters
    l1?: number;      // 主體長度
    w1?: number;      // 主體寬度
    l2?: number;      // 次體長度
    w2?: number;      // 次體寬度
    lDirection?: LShapeDirection;  // 轉折方向 (左/右)

    // T-Shape (T形複合體) parameters
    // Uses l1, w1, l2, w2 + wingPosition
    wingPosition?: TShapeWingPosition;  // 翼部位置 (中央/左側/右側)

    // Arc (圓弧拉伸體) parameters
    arcRadius?: number;   // 圓弧半徑
    arcAngle?: number;    // 圓弧角度
    depth?: number;       // 拉伸深度

    // Ellipse (橢圓柱/橢圓拉伸) parameters
    majorRadius?: number; // 長軸半徑
    minorRadius?: number; // 短軸半徑

    // Fan (扇形/扇形拉伸) parameters
    innerRadius?: number; // 內半徑
    outerRadius?: number; // 外半徑
    fanAngle?: number;    // 扇形角度
    // Polygon
    sides?: number;       // 多邊形邊數 (4-8)
    circumradius?: number; // 外接圓半徑
    sideLength?: number;  // 邊長 (circumradius 二選一)
    startAngle?: number;  // 起始角度

    // Polyline (自訂輪廓)
    points?: PolylinePoint[];    // 封閉輪廓節點列表
    extrudeHeight?: number;      // 自訂擠出高度 (defaults to floor height)
    isClosed?: boolean;          // 是否已閉合
  };
  position: [number, number, number];
}

// ============ Floor-based Modeling Types ============

// 樓層內的形狀
export interface FloorShape {
  id: string;
  type: GeometryType;
  params: {
    // Box
    width?: number;
    length?: number;
    // Cylinder
    radius?: number;
    // L-Shape / T-Shape
    l1?: number;
    w1?: number;
    l2?: number;
    w2?: number;
    lDirection?: LShapeDirection;
    wingPosition?: TShapeWingPosition;
    // Arc
    arcRadius?: number;
    arcAngle?: number;
    depth?: number;
    // Ellipse
    majorRadius?: number;
    minorRadius?: number;
    // Fan
    innerRadius?: number;
    outerRadius?: number;
    fanAngle?: number;
    // Polygon
    sides?: number;
    circumradius?: number;
    sideLength?: number;
    startAngle?: number;
    // Polyline (自訂輪廓)
    points?: PolylinePoint[];
    extrudeHeight?: number;
    isClosed?: boolean;
    // Facade
    wwr?: number;
    glassType?: GlassType;
    shadingType?: ShadingType;
    /** Optional brush color (hex e.g. '#ff8866') overriding the default white facade. */
    color?: string;
    /** Face keys that should NOT have windows (treated as solid wall). Keys depend on shape type:
     *  - box: 'N','E','S','W'
     *  - polyline / lShape / tShape: 'edge-0','edge-1',...
     *  - cylinder / polygon / ellipse: 'side'
     *  - arc / fan: 'outer','inner','side1','side2' */
    noWindowFaces?: string[];
  };
  position: { x: number; y: number };  // 平面位置
  rotation: number;                     // 旋轉角度 (degrees)
}

// 單一樓層
export interface Floor {
  id: string;
  name: string;           // 如 B1, 1F, 2F
  floorHeight: number;    // 樓層高度 (m)
  shapes: FloorShape[];   // 此樓層內的形狀列表
}

// 建築結構（包含多個樓層）
export interface BuildingFloors {
  floors: Floor[];
}

export interface GeometryMetrics {
  wallNorth: number;
  wallSouth: number;
  wallEast: number;
  wallWest: number;
  winNorth: number;
  winSouth: number;
  winEast: number;
  winWest: number;
  totalWallArea: number;
  totalWindowArea: number;
  roofArea: number;
  overallWwr: number;
  effectiveShadingRatio: number;
}

export interface EnergyKPIs {
  eei: number;
  score: number;
  grade: string;
  esr: number;
  isNZCB: boolean;
  euiN: number;
  euiG: number;
  euiM: number;
  euiMax: number;
  afe: number;
  metrics: GeometryMetrics;
  weights: {
    a: number;
    b: number;
    c: number;
    d: number;
  };
  eevCalculation: {
    opaqueWallHeatGain: number;
    glassHeatGain: number;
    roofHeatGain: number;
    totalHeatGain: number;
    totalEnvelopeArea: number;
    calculatedEEV: number;
  };
  mepResults: {
    eac: number;
    el: number;
    et: number;
    ehw: number;
    etEui: number;
    hpEui: number;
    aeui: number;
    leui: number;
    eeui: number;
    es: number;
  };
  breakdown: {
    hvac: number;
    lighting: number;
    elevator: number;
    dhw?: number;
  };
}
