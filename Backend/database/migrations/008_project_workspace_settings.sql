-- Migration 008: Add workspace settings columns to projects table
-- These columns persist the user's envelope, MEP, region, use category,
-- exempt areas, and geometry objects so the workspace always loads from DB.

BEGIN;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS selected_region        TEXT    NOT NULL DEFAULT 'REGION_A',
  ADD COLUMN IF NOT EXISTS selected_use_category  TEXT    NOT NULL DEFAULT 'USE_OFFICE',
  ADD COLUMN IF NOT EXISTS selected_wall          TEXT    NOT NULL DEFAULT 'CONS_WALL_RC_INS',
  ADD COLUMN IF NOT EXISTS selected_roof          TEXT    NOT NULL DEFAULT 'CONS_ROOF_RC_INS',
  ADD COLUMN IF NOT EXISTS selected_shading       TEXT    NOT NULL DEFAULT 'SH_OVERHANG',
  ADD COLUMN IF NOT EXISTS selected_glazing       TEXT    NOT NULL DEFAULT 'GLZ_DBL_LOW_E',
  ADD COLUMN IF NOT EXISTS selected_hvac          TEXT    NOT NULL DEFAULT 'HVAC_VRF',
  ADD COLUMN IF NOT EXISTS selected_lighting      TEXT    NOT NULL DEFAULT 'LGT_LED',
  ADD COLUMN IF NOT EXISTS selected_elevator      TEXT    NOT NULL DEFAULT 'ET_VVVF',
  ADD COLUMN IF NOT EXISTS selected_dhw           TEXT    NOT NULL DEFAULT 'DHW_NONE',
  ADD COLUMN IF NOT EXISTS elevator_count         INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS exempt_areas           JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS geometry_objects       JSONB   NOT NULL DEFAULT '[]'::jsonb;

-- Constraints to prevent obviously bad values
ALTER TABLE projects
  ADD CONSTRAINT projects_elevator_count_range
    CHECK (elevator_count >= 0 AND elevator_count <= 200);

COMMIT;
