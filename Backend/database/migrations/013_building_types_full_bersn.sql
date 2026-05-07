-- Migration 013: Full BERSn building type categories
-- Adds status column (ready/pending_crosswalk) and all missing categories
-- matching CalEngine's bersUseCategories list exactly.

BEGIN;

-- 1. Add status column
ALTER TABLE building_types
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'pending_crosswalk'));

-- 2. Remove the 6 legacy non-BERSn codes that were never official
UPDATE building_types
  SET is_active = FALSE
WHERE code IN ('OFFICE','RETAIL','HOTEL','HOSPITAL','RESIDENTIAL','MIXED_USE');

-- 3. Add missing BERSn categories that CalEngine already supports
--    B3, B4 — BERSn Table 3-2 entries pending Appendix 1 crosswalk
INSERT INTO building_types (code, label_zh, label_en, eui_baseline, is_active, sort_order, status)
VALUES
  ('B3_RESTAURANT',             'B-3 餐飲場所',       'B-3 Restaurant',                      95.00,  TRUE,  23, 'pending_crosswalk'),
  ('B4_HOTEL',                  'B-4 旅館',           'B-4 Hotel',                           140.00, TRUE,  24, 'pending_crosswalk'),
  ('D5_AFTERSCHOOL_CARE',       'D-5 補教課後照顧機構','D-5 Afterschool Care',                156.70, TRUE,  35, 'pending_crosswalk'),
  ('E_RELIGION_FUNERAL',        'E 宗教殯儀設施',     'E Religion / Funeral Facility',       100.00, TRUE,  40, 'pending_crosswalk'),
  ('F3_CHILD_YOUTH_INSTITUTION','F-3 兒少機構',       'F-3 Child / Youth Institution',       101.10, TRUE,  43, 'pending_crosswalk'),
  ('G3_OUTPATIENT_RETAIL_SERVICE','G-3 門診零售服務', 'G-3 Outpatient / Retail Service',     85.40,  TRUE,  46, 'pending_crosswalk')
ON CONFLICT (code) DO UPDATE
  SET label_zh   = EXCLUDED.label_zh,
      label_en   = EXCLUDED.label_en,
      eui_baseline = EXCLUDED.eui_baseline,
      is_active  = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order,
      status     = EXCLUDED.status;

-- 4. Mark all existing proper BERSn categories as 'ready'
UPDATE building_types
  SET status = 'ready'
WHERE code IN (
  'A1_ASSEMBLY_PERFORMANCE','A1_SPORTS_SPECIAL_VENUE',
  'A2_INTERNATIONAL_TERMINAL','A2_STATION_PORT_DOMESTIC_TERMINAL',
  'B1_ENTERTAINMENT','B2_DEPARTMENT_STORE',
  'C2_FACTORY_CLEAN_PRODUCTION','C2_FACTORY_GENERAL_PRODUCTION',
  'D1_FITNESS_LEISURE','D1_SPORTS_SPECIAL_VENUE',
  'D2_EDUCATION_CULTURE','D2_SPECIAL_FUNCTION_VENUE',
  'D3_D4_TEACHING_OFFICE_BUILDING','D3_TYPE_B_CLASSROOM','D4_TYPE_B_CLASSROOM',
  'F1_DAYCARE_MEDICAL_CARE','F1_HOSPITAL_LONG_TERM_CARE','F2_SMALL_CARE_TRAINING',
  'G1_FINANCE_SECURITIES','G2_OFFICE',
  'H1_H2_NON_RESIDENTIAL'
);

COMMIT;
