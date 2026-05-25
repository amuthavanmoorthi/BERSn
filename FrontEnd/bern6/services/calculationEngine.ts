
import { ProjectBaseline, EnergyKPIs, BuildingCategory, GeometryObject, GeometryMetrics, HVACMode, ShadingType } from '../types';
import { BASE_EUI } from '../constants';

const SHADING_COVERAGE: Record<ShadingType, number> = {
  'None': 0.0,
  'Horizontal': 0.35,
  'Vertical': 0.25,
  'Eggcrate': 0.60,
  'Louver': 0.45
};

function analyzeGeometry(objects: GeometryObject[]): GeometryMetrics {
  let wallN = 0, wallS = 0, wallE = 0, wallW = 0;
  let winN = 0, winS = 0, winE = 0, winW = 0;
  let totalRoof = 0;
  let totalWinArea = 0;
  let totalWallArea = 0;
  let weightedShadingSum = 0;

  objects.forEach(obj => {
    const { params, type } = obj;
    const { 
      width = 0, length = 0, height = 0, azimuth = 0, 
      wwr = 0.3, shadingType = 'None'
    } = params;

    let objWallArea = 0;
    let objRoofArea = 0;
    const shadingFactor = SHADING_COVERAGE[shadingType as ShadingType] || 0;

    if (type === 'box') {
      const sideConfigs = [
        { area: width * height, angle: azimuth },
        { area: length * height, angle: azimuth + 90 },
        { area: width * height, angle: azimuth + 180 },
        { area: length * height, angle: azimuth + 270 }
      ];
      sideConfigs.forEach(s => {
        const normalizedAngle = ((s.angle % 360) + 360) % 360;
        const windowArea = s.area * wwr;
        if (normalizedAngle >= 315 || normalizedAngle < 45) { wallN += s.area; winN += windowArea; }
        else if (normalizedAngle >= 45 && normalizedAngle < 135) { wallE += s.area; winE += windowArea; }
        else if (normalizedAngle >= 135 && normalizedAngle < 225) { wallS += s.area; winS += windowArea; }
        else { wallW += s.area; winW += windowArea; }
      });
      objWallArea = (width + length) * 2 * height;
      objRoofArea = width * length;
    } else if (type === 'polyline' && params.points && params.points.length >= 3) {
      // Polyline: Shoelace area + edge-based wall direction analysis
      const pts = params.points;
      const extH = params.extrudeHeight || height;

      // Shoelace formula for area
      let polyArea = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        polyArea += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      objRoofArea = Math.abs(polyArea) / 2;

      // Per-edge wall and window distribution
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const edgeLen = Math.sqrt(dx * dx + dy * dy);
        const edgeWallArea = edgeLen * extH;
        const edgeWinArea = edgeWallArea * wwr;
        objWallArea += edgeWallArea;

        // Outward normal direction (rotate edge direction 90° CCW)
        const normalAngle = ((Math.atan2(-dx, dy) * 180 / Math.PI) + 360 + azimuth) % 360;
        if (normalAngle >= 315 || normalAngle < 45) { wallN += edgeWallArea; winN += edgeWinArea; }
        else if (normalAngle >= 45 && normalAngle < 135) { wallE += edgeWallArea; winE += edgeWinArea; }
        else if (normalAngle >= 135 && normalAngle < 225) { wallS += edgeWallArea; winS += edgeWinArea; }
        else { wallW += edgeWallArea; winW += edgeWinArea; }
      }
    } else if (type === 'cylinder') {
      const radius = params.radius || 15;
      const circumference = 2 * Math.PI * radius;
      objWallArea = circumference * height;
      objRoofArea = Math.PI * radius * radius;
      // Distribute evenly to 4 orientations for cylinder
      const qW = objWallArea / 4; const qWin = qW * wwr;
      wallN += qW; winN += qWin; wallS += qW; winS += qWin; wallE += qW; winE += qWin; wallW += qW; winW += qWin;

    } else if (type === 'ellipse') {
      const majorR = params.majorRadius || 25;
      const minorR = params.minorRadius || 15;
      // Ramanujan approximation for ellipse circumference
      const circumference = Math.PI * (3 * (majorR + minorR) - Math.sqrt((3 * majorR + minorR) * (majorR + 3 * minorR)));
      objWallArea = circumference * height;
      objRoofArea = Math.PI * majorR * minorR;
      const qW = objWallArea / 4; const qWin = qW * wwr;
      wallN += qW; winN += qWin; wallS += qW; winS += qWin; wallE += qW; winE += qWin; wallW += qW; winW += qWin;

    } else if (type === 'arc') {
      // arcRadius = inner radius; depth extends outward
      const innerR = params.arcRadius || 30;
      const arcAngle = (params.arcAngle || 90) * Math.PI / 180;
      const depth = params.depth || 20;
      const outerR = innerR + depth;
      const outerArc = outerR * arcAngle;
      const innerArc = innerR * arcAngle;
      const sides = 2 * depth;
      const perimeter = outerArc + innerArc + sides;
      objWallArea = perimeter * height;
      objRoofArea = (arcAngle / 2) * (outerR * outerR - innerR * innerR);
      const qW = objWallArea / 4; const qWin = qW * wwr;
      wallN += qW; winN += qWin; wallS += qW; winS += qWin; wallE += qW; winE += qWin; wallW += qW; winW += qWin;

    } else if (type === 'fan') {
      const innerR = params.innerRadius || 10;
      const outerR = params.outerRadius || 30;
      const fanAngle = (params.fanAngle || 90) * Math.PI / 180;
      const outerArc = outerR * fanAngle;
      const innerArc = innerR * fanAngle;
      const sides = 2 * (outerR - innerR);
      const perimeter = outerArc + innerArc + sides;
      objWallArea = perimeter * height;
      objRoofArea = (fanAngle / 2) * (outerR * outerR - innerR * innerR);
      const qW = objWallArea / 4; const qWin = qW * wwr;
      wallN += qW; winN += qWin; wallS += qW; winS += qWin; wallE += qW; winE += qWin; wallW += qW; winW += qWin;

    } else if (type === 'lShape') {
      const l1 = params.l1 || 40, w1 = params.w1 || 20;
      const l2 = params.l2 || 20, w2 = params.w2 || 15;
      // L-shape: main body + extension, subtract shared inner edge
      objWallArea = (2 * (l1 + w1) + 2 * (l2 + w2) - 2 * Math.min(w2, w1)) * height;
      objRoofArea = l1 * w1 + l2 * w2;
      const qW = objWallArea / 4; const qWin = qW * wwr;
      wallN += qW; winN += qWin; wallS += qW; winS += qWin; wallE += qW; winE += qWin; wallW += qW; winW += qWin;

    } else if (type === 'tShape') {
      const l1 = params.l1 || 40, w1 = params.w1 || 15;
      const l2 = params.l2 || 30, w2 = params.w2 || 20;
      objWallArea = (2 * (l1 + w1) + 2 * (l2 + w2) - 2 * Math.min(w1, l2)) * height;
      objRoofArea = l1 * w1 + l2 * w2;
      const qW = objWallArea / 4; const qWin = qW * wwr;
      wallN += qW; winN += qWin; wallS += qW; winS += qWin; wallE += qW; winE += qWin; wallW += qW; winW += qWin;

    } else if (type === 'polygon') {
      const sides = params.sides || 6;
      const circumR = params.circumradius || 20;
      // Regular polygon perimeter = n * 2 * R * sin(π/n)
      const sideLength = 2 * circumR * Math.sin(Math.PI / sides);
      const perimeter = sides * sideLength;
      objWallArea = perimeter * height;
      // Regular polygon area = (1/2) * n * R² * sin(2π/n)
      objRoofArea = 0.5 * sides * circumR * circumR * Math.sin(2 * Math.PI / sides);
      const qW = objWallArea / 4; const qWin = qW * wwr;
      wallN += qW; winN += qWin; wallS += qW; winS += qWin; wallE += qW; winE += qWin; wallW += qW; winW += qWin;

    } else {
      objWallArea = (width + length) * 2 * height;
      objRoofArea = width * length;
      const qW = objWallArea / 4; const qWin = qW * wwr;
      wallN += qW; winN += qWin; wallS += qW; winS += qWin; wallE += qW; winE += qWin; wallW += qW; winW += qWin;
    }

    totalRoof += objRoofArea;
    totalWinArea += objWallArea * wwr;
    totalWallArea += objWallArea;
    weightedShadingSum += (objWallArea * wwr * shadingFactor);
  });

  return {
    wallNorth: wallN, wallSouth: wallS, wallEast: wallE, wallWest: wallW,
    winNorth: winN, winSouth: winS, winEast: winE, winWest: winW,
    totalWallArea, totalWindowArea: totalWinArea, roofArea: totalRoof,
    overallWwr: totalWallArea > 0 ? totalWinArea / totalWallArea : 0,
    effectiveShadingRatio: totalWinArea > 0 ? weightedShadingSum / totalWinArea : 0
  };
}

export function calculateKPIs(baseline: ProjectBaseline, objects: GeometryObject[]): EnergyKPIs {
  const { category, ur, envelope, mep, exemptAreas, totalFloorAreaAF, hvacMode } = baseline;
  const baseData = BASE_EUI[category];
  
  const totalExemptArea = exemptAreas.reduce((sum, item) => sum + item.area, 0);
  const afe = Math.max(1, totalFloorAreaAF - totalExemptArea);
  const metrics = analyzeGeometry(objects);

  const opaqueWallArea = metrics.totalWallArea - metrics.totalWindowArea;
  const opaqueWallHeatGain = opaqueWallArea * envelope.wallUValue * 0.8;
  const glassHeatGain = metrics.totalWindowArea * envelope.glassUValue * envelope.glassEtaI * envelope.shadingKi;
  const roofHeatGain = metrics.roofArea * envelope.roofUValue * 1.0;
  const totalHeatGain = opaqueWallHeatGain + glassHeatGain + roofHeatGain;
  const totalEnvelopeArea = metrics.totalWallArea + metrics.roofArea;
  const calculatedEEV = totalEnvelopeArea > 0 ? totalHeatGain / totalEnvelopeArea : 1.0;

  const eac = (3.5 / Math.max(0.1, mep.hvac.cop)) * (1.0 / Math.max(0.1, mep.hvac.auxEff)) * mep.hvac.controlStrategy * mep.hvac.coverage;
  const el = (mep.lighting.lpd / 10.0) * mep.lighting.controlFactor * mep.lighting.coverage;
  const et = mep.elevator.effConstant;

  const hvacMultiplier = hvacMode === HVACMode.INTERMITTENT ? 0.85 : 1.0;
  const aeui = baseData.AEUI * hvacMultiplier;
  const leui = baseData.LEUI;
  const eeui = 10;

  const etEui = (0.6 * (mep.elevator.numElevators * mep.elevator.energyPerCycle * mep.elevator.yearlyHours)) / afe;
  const hpEui = mep.dhw.hasDhw ? (mep.dhw.hpc * 8.0 * 365 * (mep.dhw.loadFactor || 0.7)) / afe : 0;

  const sumEUI = aeui + leui + etEui + hpEui;
  const a = aeui / sumEUI;
  const b = leui / sumEUI;
  const c = etEui / sumEUI;
  const d = hpEui / sumEUI;

  const hvacTerm = a * (eac - calculatedEEV * baseData.Es);
  const lightingTerm = b * el;
  const elevatorTerm = c * et;
  const dhwTerm = d * (mep.dhw.hpc || 1.0);
  
  const eei = hvacTerm + lightingTerm + elevatorTerm + dhwTerm;
  
  // ESR = (1 - EEI) * 100%
  const esr = (1 - eei) * 100;
  const isNZCB = esr >= 50;

  let score: number = eei <= 0.8 ? 50 + 40 * (0.8 - eei) / 0.3 : 50 * (2.0 - eei) / 1.2;
  
  const euiN = ur * (0.5 * sumEUI + eeui);
  const euiG = ur * (0.8 * sumEUI + eeui);
  const euiM = ur * (1.0 * sumEUI + eeui);
  const euiMax = ur * (2.0 * sumEUI + eeui);

  let grade = '7';
  if (score >= 90) grade = '1+';
  else if (score >= 80) grade = '1';
  else if (score >= 70) grade = '2';
  else if (score >= 60) grade = '3';
  else if (score >= 50) grade = '4';
  else if (score >= 40) grade = '5';
  else if (score >= 30) grade = '6';

  return {
    eei, score, grade, esr, isNZCB, euiN, euiG, euiM, euiMax, afe, metrics,
    weights: { a, b, c, d },
    eevCalculation: {
      opaqueWallHeatGain, glassHeatGain, roofHeatGain, totalHeatGain, totalEnvelopeArea, calculatedEEV
    },
    mepResults: { eac, el, et, ehw: d, etEui, hpEui, aeui, leui, eeui, es: baseData.Es },
    breakdown: { hvac: hvacTerm, lighting: lightingTerm, elevator: elevatorTerm, dhw: d > 0 ? dhwTerm : undefined }
  };
}
