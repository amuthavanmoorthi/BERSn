-- Migration 020: BERSn 2024 M-series school types with correct Appendix 1 Table A baselines.
--
-- Background:
--   Migration 013 inserted D3_D4_TEACHING_OFFICE_BUILDING / D3_TYPE_B_CLASSROOM /
--   D4_TYPE_B_CLASSROOM with eui_baseline values derived from Appendix 1 Table A
--   rows D3 / D4 — but in Appendix 1 Table A those rows are MUSEUMS
--   (其他類博物館), not schools. K-12 educational buildings live on Appendix 1
--   rows M2 / M3 / M4 (國小 / 國中 / 高中職、大專).
--
--   The CalEngine building_type_maps.json was corrected to split these K-12
--   entries by school level (M2/M3/M4) × Table 3-2 use mode
--   (教學辦公樓 / D-3 乙教室 / D-4 乙教室) = 9 internal_type_key entries.
--   This migration mirrors that split in the building_types catalog so the
--   Backend project_types dropdown and eui_baseline lookups agree with the
--   calc engine.
--
-- Source of eui_baseline (Technical.pdf p.111-112, Appendix 1 Table A,
-- intermittent_ac column — schools have empty 全年空調 column):
--   M2 國小辦公室與教室                  : AEUI 16.0 + LEUI 15.0 + EEUI 6.0 = 37.00
--   M3 國中辦公室與教室                  : AEUI 21.0 + LEUI 21.0 + EEUI 8.0 = 50.00
--   M4 高中職、大專教室辦公室與教室       : AEUI 23.0 + LEUI 22.0 + EEUI 9.0 = 54.00
-- Per Appendix 1 Table A footnote *1, M2~M4 GEUI = AEUI+LEUI+EEUI (no 雜項機械).
--
-- Backwards compatibility:
--   The three stale codes (D3_D4_TEACHING_OFFICE_BUILDING, D3_TYPE_B_CLASSROOM,
--   D4_TYPE_B_CLASSROOM) are kept in the table but marked is_active = FALSE so
--   they no longer appear in new-project selection dropdowns. Any existing
--   project foreign-key references to those codes continue to resolve. The
--   Backend / UI should backfill or migrate those projects to the appropriate
--   M-series code separately if needed.
--
--   Migration 016 disabled D4_TYPE_B_CLASSROOM under the assumption that D-3
--   and D-4 classrooms collapse to one BERSn entry. The corrected
--   building_type_maps.json keeps them separate because Table 3-2 lists
--   different YOHj values (D-3 = 1430 h/yr, D-4 = 1880 h/yr). The 9 new
--   M-series entries below preserve that distinction.

BEGIN;

INSERT INTO building_types (code, label_zh, label_en, eui_baseline, is_active, sort_order, status)
VALUES
  ('M2_ELEMENTARY_TEACHING_OFFICE',     'D-3/D-4 教學辦公樓 — M-2 國小',          'D-3/D-4 Teaching Office — M-2 Elementary',          37.00, TRUE, 450, 'ready'),
  ('M3_JUNIOR_HIGH_TEACHING_OFFICE',    'D-3/D-4 教學辦公樓 — M-3 國中',          'D-3/D-4 Teaching Office — M-3 Junior High',         50.00, TRUE, 451, 'ready'),
  ('M4_SENIOR_COLLEGE_TEACHING_OFFICE', 'D-3/D-4 教學辦公樓 — M-4 高中職/大專',    'D-3/D-4 Teaching Office — M-4 Senior/College',      54.00, TRUE, 452, 'ready'),
  ('M2_ELEMENTARY_D3_CLASSROOM',        'D-3 乙教室 — M-2 國小',                  'D-3 Type B Classroom — M-2 Elementary',             37.00, TRUE, 453, 'ready'),
  ('M3_JUNIOR_HIGH_D3_CLASSROOM',       'D-3 乙教室 — M-3 國中',                  'D-3 Type B Classroom — M-3 Junior High',            50.00, TRUE, 454, 'ready'),
  ('M4_SENIOR_COLLEGE_D3_CLASSROOM',    'D-3 乙教室 — M-4 高中職/大專',            'D-3 Type B Classroom — M-4 Senior/College',         54.00, TRUE, 455, 'ready'),
  ('M2_ELEMENTARY_D4_CLASSROOM',        'D-4 乙教室 — M-2 國小',                  'D-4 Type B Classroom — M-2 Elementary',             37.00, TRUE, 456, 'ready'),
  ('M3_JUNIOR_HIGH_D4_CLASSROOM',       'D-4 乙教室 — M-3 國中',                  'D-4 Type B Classroom — M-3 Junior High',            50.00, TRUE, 457, 'ready'),
  ('M4_SENIOR_COLLEGE_D4_CLASSROOM',    'D-4 乙教室 — M-4 高中職/大專',            'D-4 Type B Classroom — M-4 Senior/College',         54.00, TRUE, 458, 'ready')
ON CONFLICT (code) DO UPDATE
  SET label_zh     = EXCLUDED.label_zh,
      label_en     = EXCLUDED.label_en,
      eui_baseline = EXCLUDED.eui_baseline,
      is_active    = EXCLUDED.is_active,
      sort_order   = EXCLUDED.sort_order,
      status       = EXCLUDED.status;

-- Deactivate the three stale museum-mapped K-12 codes from new-project
-- dropdowns. Rows remain in the table to preserve existing FK references.
UPDATE building_types
   SET is_active = FALSE
 WHERE code IN ('D3_D4_TEACHING_OFFICE_BUILDING', 'D3_TYPE_B_CLASSROOM', 'D4_TYPE_B_CLASSROOM');

COMMIT;
