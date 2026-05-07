-- Migration 011: Add floors JSONB column to projects table
-- Stores floor-based geometry (array of floors with shapes) from the bern5
-- 3D editor. Kept alongside geometry_objects so legacy data is not lost.

BEGIN;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS floors JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
