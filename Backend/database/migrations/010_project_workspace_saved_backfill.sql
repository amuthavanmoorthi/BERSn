-- Migration 010: Backfill CONFIG workspace save markers for rows saved before
-- workspace_saved_at existed. This keeps old saved projects loading their last
-- persisted CONFIG data instead of being treated like brand-new projects.

BEGIN;

UPDATE projects
   SET workspace_saved_at = COALESCE(updated_at, created_at, NOW())
 WHERE workspace_saved_at IS NULL
   AND (
     jsonb_array_length(COALESCE(exempt_areas, '[]'::jsonb)) > 0
     OR jsonb_array_length(COALESCE(geometry_objects, '[]'::jsonb)) > 0
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
