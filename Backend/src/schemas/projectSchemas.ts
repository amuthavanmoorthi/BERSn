import { z } from 'zod';

export const PROJECT_STATUS_VALUES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'REVISION_REQUESTED',
  'COMPLETED',
  'ARCHIVED',
] as const;

function sanitizeHumanText(value: string, maxLength: number): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function requiredText(label: string, maxLength: number) {
  return z.string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`)
    .transform((value) => sanitizeHumanText(value, maxLength))
    .refine((value) => value.length > 0, `${label} is required.`);
}

function optionalText(maxLength: number) {
  return z.string()
    .optional()
    .default('')
    .transform((value) => sanitizeHumanText(value, maxLength));
}

export const projectCreateSchema = z.object({
  project_name: requiredText('Project name', 200),
  organization_id: z.string().uuid('Organization must be selected.').nullish().transform(v => v ?? undefined),
  location: optionalText(300),
  building_type_code: z.string()
    .trim()
    .toUpperCase()
    .max(50, 'Building type code must be 50 characters or fewer.'),
  total_floor_area: z.coerce.number()
    .positive('Total floor area must be greater than zero.')
    .max(9999999999.99, 'Total floor area is too large.')
    .transform((value) => Number(value.toFixed(2))),
  assigned_to: z.string().uuid('Assigned user id must be a valid UUID.').optional(),
});

export const projectInfoUpdateSchema = z.object({
  project_name: requiredText('Project name', 200),
  location: optionalText(300),
  building_type_code: z.string()
    .trim()
    .toUpperCase()
    .max(50, 'Building type code must be 50 characters or fewer.'),
});

export const projectStatusUpdateSchema = z.object({
  status: z.enum(PROJECT_STATUS_VALUES),
  reason: z.string().trim().max(2000).optional(),
});

export const projectSubmitSchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export type ProjectSubmitInput = z.output<typeof projectSubmitSchema>;

export const projectCalculationCreateSchema = z.object({
  eui_result: z.coerce.number().positive().optional(),
  total_energy_kwh: z.coerce.number().positive().optional(),
  carbon_emission_kg: z.coerce.number().nonnegative().optional(),
  green_building_grade: z.enum(['1+', '1', '2', '3', '4', '5', '6', '7']).optional(),
  input_snapshot: z.record(z.string(), z.unknown()).optional().default({}),
  notes: optionalText(2000),
});

const previewExemptReasonSchema = z.enum(['outdoor', 'shelter', 'parking', 'storage']);

const polylinePointSchema = z.object({
  x: z.coerce.number().finite(),
  y: z.coerce.number().finite(),
});

const previewProjectInputsSchema = z.object({
  selected_region: z.string().trim().max(50).optional().default('REGION_A'),
  selected_use_category: z.string().trim().max(50).optional().default('USE_OFFICE'),
  total_floor_area: z.coerce.number().positive().max(9999999999.99).optional(),
  exempt_areas: z.array(z.object({
    area: z.coerce.number().nonnegative().max(9999999999.99),
    color: z.string().max(20).optional(),
    floor_id: z.string().trim().max(100).optional(),
    id: z.string().trim().min(1).max(100),
    name: optionalText(150),
    polygon: z.array(polylinePointSchema).min(3).max(200).optional(),
    position: z.object({
      x: z.coerce.number().finite(),
      y: z.coerce.number().finite(),
    }).optional(),
    reason: previewExemptReasonSchema,
  })).max(100).optional().default([]),
});

const previewEnvelopeInputsSchema = z.object({
  selected_glazing: z.string().trim().max(50).optional().default('GLZ_DBL_LOW_E'),
  selected_roof: z.string().trim().max(50).optional().default('CONS_ROOF_RC_INS'),
  selected_shading: z.string().trim().max(50).optional().default('SH_OVERHANG'),
  selected_wall: z.string().trim().max(50).optional().default('CONS_WALL_RC_INS'),
});

const previewMepInputsSchema = z.object({
  elevator_count: z.coerce.number().int().min(0).max(100).optional().default(4),
  selected_dhw: z.string().trim().max(50).optional().default('DHW_NONE'),
  selected_elevator: z.string().trim().max(50).optional().default('ET_VVVF'),
  selected_hvac: z.string().trim().max(50).optional().default('HVAC_VRF'),
  selected_lighting: z.string().trim().max(50).optional().default('LGT_LED'),
});

const geometryParamsSchema = z.object({
  arcAngle: z.coerce.number().min(1).max(360).optional(),
  arcRadius: z.coerce.number().positive().max(999).optional(),
  azimuth: z.coerce.number().min(-360).max(360).default(0),
  color: z.string().max(20).optional(),
  depth: z.coerce.number().positive().max(999).optional(),
  extrudeHeight: z.coerce.number().positive().max(999).optional(),
  fanAngle: z.coerce.number().min(1).max(360).optional(),
  glassType: z.string().max(50).optional(),
  height: z.coerce.number().positive().max(500),
  innerRadius: z.coerce.number().nonnegative().max(999).optional(),
  isClosed: z.boolean().optional(),
  l1: z.coerce.number().positive().max(999).optional(),
  l2: z.coerce.number().positive().max(999).optional(),
  lDirection: z.enum(['left', 'right']).optional(),
  length: z.coerce.number().positive().max(999).optional(),
  majorRadius: z.coerce.number().positive().max(999).optional(),
  minorRadius: z.coerce.number().positive().max(999).optional(),
  noWindowFaces: z.array(z.enum(['N', 'S', 'E', 'W'])).max(4).optional(),
  outerRadius: z.coerce.number().positive().max(999).optional(),
  points: z.array(polylinePointSchema).min(3).max(200).optional(),
  radius: z.coerce.number().positive().max(999).optional(),
  shadingType: z.string().max(50).optional(),
  w1: z.coerce.number().positive().max(999).optional(),
  w2: z.coerce.number().positive().max(999).optional(),
  width: z.coerce.number().positive().max(999).optional(),
  wingPosition: z.enum(['center', 'left', 'right']).optional(),
  wwr: z.coerce.number().min(0).max(0.99).default(0.35),
});

const geometryTypeEnum = z.enum([
  'box', 'lShape', 'tShape', 'cylinder', 'arc', 'ellipse', 'fan',
  'polygon', 'polyline',
]);

export const projectGeometryPreviewSchema = z.object({
  floor_height_m: z.coerce.number().positive().max(10).optional().default(3.5),
  envelope: previewEnvelopeInputsSchema.optional().default({
    selected_glazing: 'GLZ_DBL_LOW_E',
    selected_roof: 'CONS_ROOF_RC_INS',
    selected_shading: 'SH_OVERHANG',
    selected_wall: 'CONS_WALL_RC_INS',
  }),
  mep: previewMepInputsSchema.optional().default({
    elevator_count: 4,
    selected_dhw: 'DHW_NONE',
    selected_elevator: 'ET_VVVF',
    selected_hvac: 'HVAC_VRF',
    selected_lighting: 'LGT_LED',
  }),
  objects: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    params: geometryParamsSchema,
    position: z.tuple([
      z.coerce.number().finite(),
      z.coerce.number().finite(),
      z.coerce.number().finite(),
    ]).optional(),
    type: geometryTypeEnum,
  })).min(1).max(20),
  project: previewProjectInputsSchema.optional().default({
    exempt_areas: [],
    selected_region: 'REGION_A',
    selected_use_category: 'USE_OFFICE',
  }),
});

const floorShapeSchema = z.object({
  id: z.string().trim().min(1).max(100),
  params: z.record(z.string(), z.unknown()).default({}),
  position: z.object({
    x: z.coerce.number().finite(),
    y: z.coerce.number().finite(),
  }).optional(),
  rotation: z.coerce.number().finite().optional().default(0),
  type: z.string().trim().max(50),
});

const floorSchema = z.object({
  floorHeight: z.coerce.number().positive().max(50),
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().max(150),
  shapes: z.array(floorShapeSchema).max(100).default([]),
});

export const projectWorkspaceSettingsSchema = z.object({
  elevator_count: z.coerce.number().int().min(0).max(200).default(4),
  floors: z.array(floorSchema).max(200).optional().default([]),
  exempt_areas: z.array(z.object({
    area: z.coerce.number().nonnegative().max(9999999999.99),
    color: z.string().max(20).optional(),
    floor_id: z.string().trim().max(100).optional(),
    id: z.string().trim().min(1).max(100),
    name: optionalText(150),
    polygon: z.array(polylinePointSchema).min(3).max(200).optional(),
    position: z.object({
      x: z.coerce.number().finite(),
      y: z.coerce.number().finite(),
    }).optional(),
    reason: previewExemptReasonSchema,
  })).max(100).default([]),
  geometry_objects: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    params: geometryParamsSchema,
    position: z.tuple([
      z.coerce.number().finite(),
      z.coerce.number().finite(),
      z.coerce.number().finite(),
    ]).optional(),
    type: geometryTypeEnum,
  })).max(20).default([]),
  selected_dhw: z.string().trim().max(50).default('DHW_NONE'),
  selected_elevator: z.string().trim().max(50).default('ET_VVVF'),
  selected_glazing: z.string().trim().max(50).default('GLZ_DBL_LOW_E'),
  selected_hvac: z.string().trim().max(50).default('HVAC_VRF'),
  selected_lighting: z.string().trim().max(50).default('LGT_LED'),
  selected_region: z.string().trim().max(50).default('REGION_A'),
  selected_roof: z.string().trim().max(50).default('CONS_ROOF_RC_INS'),
  selected_shading: z.string().trim().max(50).default('SH_OVERHANG'),
  selected_use_category: z.string().trim().max(50).default('USE_OFFICE'),
  selected_wall: z.string().trim().max(50).default('CONS_WALL_RC_INS'),
});

export const projectMemberShareSchema = z.object({
  username: z.string().trim().min(1).max(150),
  permission: z.enum(['viewer', 'editor', 'admin']),
});

export type ProjectMemberShareInput = z.output<typeof projectMemberShareSchema>;

export type ProjectCreateInput = z.output<typeof projectCreateSchema>;
export type ProjectInfoUpdateInput = z.output<typeof projectInfoUpdateSchema>;
export type ProjectCalculationCreateInput = z.output<typeof projectCalculationCreateSchema>;
export type ProjectGeometryPreviewInput = z.output<typeof projectGeometryPreviewSchema>;
export type ProjectStatusUpdateInput = z.output<typeof projectStatusUpdateSchema>;
export type ProjectWorkspaceSettingsInput = z.output<typeof projectWorkspaceSettingsSchema>;
