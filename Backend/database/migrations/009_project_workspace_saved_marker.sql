-- Migration 009: Track whether CONFIG workspace settings were explicitly saved.
-- Default project rows already contain fallback values, so the frontend needs a
-- real marker to distinguish "fresh project" from "saved project with defaults".

BEGIN;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS workspace_saved_at TIMESTAMPTZ;

UPDATE projects
   SET workspace_saved_at = updated_at
 WHERE workspace_saved_at IS NULL
   AND (
     jsonb_array_length(exempt_areas) > 0
     OR jsonb_array_length(geometry_objects) > 0
     OR selected_region <> 'REGION_A'
     OR selected_use_category <> 'USE_OFFICE'
     OR selected_wall <> 'CONS_WALL_RC_INS'
     OR selected_roof <> 'CONS_ROOF_RC_INS'
     OR selected_shading <> 'SH_OVERHANG'
     OR selected_glazing <> 'GLZ_DBL_LOW_E'
     OR selected_hvac <> 'HVAC_VRF'
     OR selected_lighting <> 'LGT_LED'
     OR selected_elevator <> 'ET_VVVF'
     OR selected_dhw <> 'DHW_NONE'
     OR elevator_count <> 4
   );

COMMIT;
