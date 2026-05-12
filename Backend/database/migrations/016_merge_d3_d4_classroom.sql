-- Migration 016: Merge D-3 and D-4 Type B Classroom into one entry
-- The BERS 2024 Technical Manual (Table 4.6) treats D-3 and D-4 classrooms
-- as a single combined category ("D-3 與 D-4 之教室"). Deactivate D4 to
-- eliminate the duplicate "Type B Classroom" in the building type dropdown.
-- D3_TYPE_B_CLASSROOM remains as the single "Type B Classroom" entry.

BEGIN;

UPDATE building_types
   SET is_active = FALSE
 WHERE code = 'D4_TYPE_B_CLASSROOM';

COMMIT;
