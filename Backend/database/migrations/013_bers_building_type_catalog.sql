-- Migration 013: Replace the Phase 1 placeholder building type list with the
-- BERS 2024 use-category catalog currently normalized in CalcEngine.

INSERT INTO building_types (code, label_zh, label_en, eui_baseline, is_active, sort_order)
VALUES
  ('A1_ASSEMBLY_PERFORMANCE', 'A-1 集會表演', 'A-1 Assembly / Performance', 151.20, TRUE, 110),
  ('A1_SPORTS_SPECIAL_VENUE', 'A-1 體育專用場館', 'A-1 Sports Special Venue', 151.20, TRUE, 120),
  ('A2_INTERNATIONAL_TERMINAL', 'A-2 國際航站', 'A-2 International Terminal', 130.40, TRUE, 130),
  ('A2_STATION_PORT_DOMESTIC_TERMINAL', 'A-2 車站、船站、國內航站', 'A-2 Station / Port / Domestic Terminal', 130.40, TRUE, 140),
  ('B1_ENTERTAINMENT', 'B-1 娛樂場所', 'B-1 Entertainment', 117.40, TRUE, 210),
  ('B2_DEPARTMENT_STORE', 'B-2 商場百貨', 'B-2 Department Store / Mall', 95.00, TRUE, 220),
  ('C2_FACTORY_CLEAN_PRODUCTION', 'C-2 清潔生產工廠', 'C-2 Factory, Clean Production', 92.40, TRUE, 310),
  ('C2_FACTORY_GENERAL_PRODUCTION', 'C-2 一般生產工廠', 'C-2 Factory, General Production', 92.40, TRUE, 320),
  ('D1_FITNESS_LEISURE', 'D-1 健身休閒', 'D-1 Fitness / Leisure', 264.90, TRUE, 410),
  ('D1_SPORTS_SPECIAL_VENUE', 'D-1 體育專用場館', 'D-1 Sports Special Venue', 264.90, TRUE, 420),
  ('D2_EDUCATION_CULTURE', 'D-2 文教設施', 'D-2 Education / Culture', 180.70, TRUE, 430),
  ('D2_SPECIAL_FUNCTION_VENUE', 'D-2 特殊功能場館', 'D-2 Special Function Venue', 180.70, TRUE, 440),
  ('D3_D4_TEACHING_OFFICE_BUILDING', 'D-3/D-4 教學辦公樓', 'D-3/D-4 Teaching Office Building', 156.70, TRUE, 450),
  ('D3_TYPE_B_CLASSROOM', 'D-3 乙教室', 'D-3 Type B Classroom', 156.70, TRUE, 460),
  ('D4_TYPE_B_CLASSROOM', 'D-4 乙教室', 'D-4 Type B Classroom', 140.20, TRUE, 470),
  ('F1_DAYCARE_MEDICAL_CARE', 'F-1 醫療照護（日照）', 'F-1 Medical Care, Daycare', 143.40, TRUE, 610),
  ('F1_HOSPITAL_LONG_TERM_CARE', 'F-1 醫療照護（醫院、長照）', 'F-1 Hospital / Long-Term Care', 143.40, TRUE, 620),
  ('F2_SMALL_CARE_TRAINING', 'F-2 小型照護訓練機構', 'F-2 Small Care / Training Institution', 101.10, TRUE, 630),
  ('G1_FINANCE_SECURITIES', 'G-1 金融證券', 'G-1 Finance / Securities', 85.40, TRUE, 710),
  ('G2_OFFICE', 'G-2 辦公場所', 'G-2 Office', 68.40, TRUE, 720),
  ('H1_H2_NON_RESIDENTIAL', 'H-1/H-2 非住宅用途', 'H-1/H-2 Non-Residential Use', 140.40, TRUE, 810)
ON CONFLICT (code) DO UPDATE SET
  label_zh = EXCLUDED.label_zh,
  label_en = EXCLUDED.label_en,
  eui_baseline = EXCLUDED.eui_baseline,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- Keep old project references valid, but remove the simplified placeholder
-- choices from new-project selection.
UPDATE building_types
SET is_active = FALSE
WHERE code IN ('OFFICE', 'RETAIL', 'HOTEL', 'HOSPITAL', 'RESIDENTIAL', 'MIXED_USE');
