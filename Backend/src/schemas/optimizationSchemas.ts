import { z } from 'zod';

export const MEASURE_CATEGORIES = ['ENVELOPE', 'HVAC', 'LIGHTING', 'ELEVATOR', 'DHW', 'CONTROL'] as const;
export type MeasureCategory = (typeof MEASURE_CATEGORIES)[number];

export const MEASURE_PATCH_SECTIONS = ['project', 'envelope', 'mep'] as const;
export type MeasurePatchSection = (typeof MEASURE_PATCH_SECTIONS)[number];

export const COST_MODEL_TYPES = ['PER_M2_WINDOW', 'PER_M2_FACADE', 'PER_M2_ROOF', 'PER_UNIT', 'FIXED'] as const;
export type CostModelType = (typeof COST_MODEL_TYPES)[number];

export const measurePatchSchema = z.object({
  section: z.enum(MEASURE_PATCH_SECTIONS),
  field: z.string().trim().min(1).max(100),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const measureEligibilitySchema = z.object({
  minWWR: z.number().min(0).max(1).optional(),
  maxWWR: z.number().min(0).max(1).optional(),
  useCategory: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
}).strict();

export const costModelSchema = z.object({
  type: z.enum(COST_MODEL_TYPES),
  unitCost: z.coerce.number().nonnegative().max(1e12),
}).strict();

export const scenarioCreateSchema = z.object({
  name: z.string().trim().min(1, 'Scenario name is required.').max(200, 'Scenario name must be 200 characters or fewer.'),
  selected_measure_ids: z.array(z.string().trim().min(1).max(50)).min(1, 'At least one measure must be selected.').max(20, 'Cannot select more than 20 measures.'),
});

export type ScenarioCreateInput = z.output<typeof scenarioCreateSchema>;
export type MeasurePatch = z.output<typeof measurePatchSchema>;
export type MeasureEligibility = z.output<typeof measureEligibilitySchema>;
export type CostModel = z.output<typeof costModelSchema>;
