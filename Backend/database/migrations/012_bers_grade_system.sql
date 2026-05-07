-- Migration 012: Standardize grade column to BERS 7-level scale
-- Old values: GOLD, SILVER, BRONZE, FAIL
-- New values: 1+, 1, 2, 3, 4, 5, 6, 7  (matches BERSn manual & frontend engine)

BEGIN;

-- 1. Drop the existing CHECK constraint
ALTER TABLE project_calculations
  DROP CONSTRAINT IF EXISTS project_calculations_green_building_grade_check;

-- 2. Migrate any existing legacy GOLD/SILVER/BRONZE/FAIL values
UPDATE project_calculations
  SET green_building_grade = CASE green_building_grade
    WHEN 'GOLD'   THEN '1+'
    WHEN 'SILVER' THEN '2'
    WHEN 'BRONZE' THEN '4'
    WHEN 'FAIL'   THEN '7'
    ELSE green_building_grade
  END
WHERE green_building_grade IN ('GOLD', 'SILVER', 'BRONZE', 'FAIL');

-- 3. Add the new CHECK constraint
ALTER TABLE project_calculations
  ADD CONSTRAINT project_calculations_green_building_grade_check
    CHECK (
      green_building_grade IS NULL
      OR green_building_grade IN ('1+', '1', '2', '3', '4', '5', '6', '7')
    );

COMMIT;
