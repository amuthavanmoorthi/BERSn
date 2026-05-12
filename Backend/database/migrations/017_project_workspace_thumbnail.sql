-- Migration 017: Add a workspace thumbnail column on projects so the dashboard
-- and project cards can show the latest 3D scene preview instead of a generic icon.
-- Thumbnails are base64 data URLs captured from the WebGL canvas; expect ~10-200KB each.

BEGIN;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS workspace_thumbnail TEXT;

COMMIT;
