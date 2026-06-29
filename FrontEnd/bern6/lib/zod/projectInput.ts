/**
 * Zod schema + TypeScript types for the BERSn calculation engine input.
 *
 * Shared between:
 *   - lib/calc/engine.ts    (validates before computing)
 *   - lib/calc/sensitivity.ts (parameter sweep)
 *   - server/routes/calc.ts (validates POST /run body)
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const ExemptAreaSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  area_m2: z.number().nonnegative(),
  contiguousArea_m2: z.number().nonnegative().optional(),
  hasAirConditioning: z.boolean().optional(),
  reason: z.enum([
    'OUTDOOR_FLOOR',
    'CIVIL_DEFENSE',
    'INDOOR_PARKING',
    'NO_AC_STORAGE_EQUIP',
  ]),
});

const AreasSchema = z.object({
  AF_total_m2: z.number().positive(),
  exemptAreas: z.array(ExemptAreaSchema).default([]),
});

const OrientationSchema = z.enum(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

const EnvelopeOrientationSchema = z.object({
  orientation: OrientationSchema,
  wallConstructionId: z.string().optional(),
  windowGlazingTypeId: z.string().optional(),
  shadingTypeId: z.string().optional(),
  areaWall_override: z.number().nonnegative().optional(),
  areaWindow_override: z.number().nonnegative().optional(),
  windowU_override: z.number().nonnegative().optional(),
  eta_override: z.number().min(0).max(1).optional(),
  Ki_override: z.number().min(0).max(2).optional(),
});

const EnvelopeSchema = z.object({
  roofConstructionId: z.string().optional(),
  perOrientation: z.array(EnvelopeOrientationSchema).default([]),
});

const GeometryExtractedSchema = z.object({
  facadeAreasByOrientation: z.record(OrientationSchema, z.number()).default({} as any),
  windowAreasByOrientation: z.record(OrientationSchema, z.number()).default({} as any),
  roofArea_m2: z.number().nonnegative().default(0),
});

const GeometryOverridesSchema = z.object({
  facadeAreasByOrientation: z.record(OrientationSchema, z.number()).optional(),
  windowAreasByOrientation: z.record(OrientationSchema, z.number()).optional(),
}).optional();

const GeometrySchema = z.object({
  extracted: GeometryExtractedSchema,
  overrides: GeometryOverridesSchema,
});

const HvacSchema = z.object({
  systemTypeId: z.string().optional(),
  EAC: z.number().nonnegative().optional(),
});

const LightingSchema = z.object({
  systemTypeId: z.string().optional(),
  EL: z.number().nonnegative().optional(),
});

const ElevatorGroupSchema = z.object({
  name: z.string(),
  Nej: z.number().int().nonnegative(),
  Eelj: z.number().nonnegative(),
  YOHj: z.number().nonnegative(),
});

const ElevatorSchema = z.object({
  groups: z.array(ElevatorGroupSchema).default([]),
  Et: z.number().nonnegative().optional(),
});

const DhwSchema = z.object({
  systemTypeId: z.string().optional(),
  EHW: z.number().nonnegative().optional(),
  HPC_kW: z.number().nonnegative().optional(),
}).optional();

const MepSchema = z.object({
  hvac: HvacSchema,
  lighting: LightingSchema,
  elevator: ElevatorSchema,
  dhw: DhwSchema,
});

const BuildingUseSchema = z.object({
  useCategoryId: z.string(),
  floorAreaFraction: z.number().min(0).max(1).optional(),
});

const BasicsSchema = z.object({
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  buildingUses: z.array(BuildingUseSchema).min(1),
  hasCentralDHW: z.boolean().default(false),
  UR: z.number().positive().default(1.0),
  climateRegionId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Root schema
// ---------------------------------------------------------------------------

export const ProjectInputSchema = z.object({
  basics: BasicsSchema,
  areas: AreasSchema,
  envelope: EnvelopeSchema,
  geometry: GeometrySchema,
  mep: MepSchema,
});

// ---------------------------------------------------------------------------
// CalcResult type (returned by computeAll)
// ---------------------------------------------------------------------------

export const CalcResultSchema = z.object({
  timestamp: z.string(),
  resolvedLookups: z.array(
    z.object({
      tableName: z.string(),
      key: z.string(),
      rowUsed: z.unknown(),
    }),
  ),
  intermediates: z.object({
    EtEUI: z.number(),
    HpEUI: z.number().nullable(),
    weights: z.object({ a: z.number(), b: z.number(), c: z.number(), d: z.number() }),
    hvacTerm: z.number(),
    lightTerm: z.number(),
    elevTerm: z.number(),
    dhwTerm: z.number(),
    EEV: z.number(),
    eaveBreakdown: z.array(z.unknown()),
    AFe: z.number(),
    areaBreakdown: z.unknown(),
    mepDetails: z.unknown(),
    termBreakdown: z.array(z.unknown()),
  }),
  KPIs: z.object({
    EEI: z.number(),
    SCOREee: z.number(),
    grade: z.string(),
    EUIn: z.number(),
    EUIg: z.number(),
    EUIm: z.number(),
    EUImax: z.number(),
  }),
  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      severity: z.enum(['ERROR', 'WARNING', 'INFO']),
      fields: z.array(z.string()).optional(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Exported TypeScript types
// ---------------------------------------------------------------------------

export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export type CalcResult  = z.infer<typeof CalcResultSchema>;
