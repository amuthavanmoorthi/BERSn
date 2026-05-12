-- Optimization measures + scenarios.
-- Tables:
--   measure_library   — catalog of energy-saving measures (catalog-swap patches)
--   project_scenarios — named bundles of measures per project
--   scenario_measures — N:M join between scenarios and measures
--   scenario_results  — most recent simulation output per scenario

CREATE TABLE IF NOT EXISTS measure_library (
  id              VARCHAR(50) PRIMARY KEY,
  name_zh         VARCHAR(150) NOT NULL,
  name_en         VARCHAR(150) NOT NULL,
  category        VARCHAR(20)  NOT NULL CHECK (category IN ('ENVELOPE','HVAC','LIGHTING','ELEVATOR','DHW','CONTROL')),
  description_zh  TEXT NOT NULL DEFAULT '',
  description_en  TEXT NOT NULL DEFAULT '',
  eligibility     JSONB NOT NULL DEFAULT '{}'::jsonb,
  patches         JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_model      JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order      INT  NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_measure_library_active
  ON measure_library (is_active, sort_order);

CREATE OR REPLACE FUNCTION set_measure_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_measure_library_updated_at ON measure_library;
CREATE TRIGGER trg_measure_library_updated_at
BEFORE UPDATE ON measure_library
FOR EACH ROW
EXECUTE FUNCTION set_measure_library_updated_at();

CREATE TABLE IF NOT EXISTS project_scenarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_scenarios_project_created
  ON project_scenarios (project_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_project_scenarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_scenarios_updated_at ON project_scenarios;
CREATE TRIGGER trg_project_scenarios_updated_at
BEFORE UPDATE ON project_scenarios
FOR EACH ROW
EXECUTE FUNCTION set_project_scenarios_updated_at();

CREATE TABLE IF NOT EXISTS scenario_measures (
  scenario_id  UUID        NOT NULL REFERENCES project_scenarios(id) ON DELETE CASCADE,
  measure_id   VARCHAR(50) NOT NULL REFERENCES measure_library(id)    ON DELETE RESTRICT,
  ordinal      INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (scenario_id, measure_id)
);

CREATE INDEX IF NOT EXISTS idx_scenario_measures_measure
  ON scenario_measures (measure_id);

CREATE TABLE IF NOT EXISTS scenario_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     UUID NOT NULL REFERENCES project_scenarios(id) ON DELETE CASCADE,
  simulated_eei   DECIMAL(10,4) NOT NULL,
  simulated_score DECIMAL(10,4) NOT NULL,
  simulated_grade VARCHAR(10)   NOT NULL,
  total_cost_twd  DECIMAL(15,2) NOT NULL DEFAULT 0,
  cp_value        DECIMAL(15,6) NOT NULL DEFAULT 0,
  baseline_eei    DECIMAL(10,4),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scenario_results_scenario_time
  ON scenario_results (scenario_id, computed_at DESC);

-- Seed the 12 baseline measures (catalog-swap patches).
-- Each measure's `patches` is a JSON array of {section, field, value} entries.
-- `section` matches the Python payload section: project / envelope / mep.

INSERT INTO measure_library (id, name_zh, name_en, category, description_zh, description_en, eligibility, patches, cost_model, sort_order)
VALUES
  ('m1', '高效Low-E玻璃', 'High-Perf Glazing (Low-E)', 'ENVELOPE',
   '升級為Low-E三層玻璃以降低日射熱與U值。', 'Upgrade to Triple-pane Low-E glass to reduce solar gain and U-value.',
   '{"minWWR":0.2}'::jsonb,
   '[{"section":"envelope","field":"selected_glazing","value":"GLZ_TRIPLE"}]'::jsonb,
   '{"type":"PER_M2_WINDOW","unitCost":4500}'::jsonb,
   10),

  ('m2', '外遮陽 (百葉)', 'External Shading (Louver)', 'ENVELOPE',
   '加裝固定式外百葉以提供長期遮陽保護。', 'Install fixed external louvers to provide permanent solar protection.',
   '{}'::jsonb,
   '[{"section":"envelope","field":"selected_shading","value":"SH_LOUVER"}]'::jsonb,
   '{"type":"PER_M2_WINDOW","unitCost":2800}'::jsonb,
   20),

  ('m3', '高效LED與感應控制', 'Ultra-LED & Sensor Control', 'LIGHTING',
   '更換高效LED燈具並導入佔用感應控制。', 'Replace all lighting with High-efficacy LEDs and occupancy sensors.',
   '{}'::jsonb,
   '[{"section":"mep","field":"selected_lighting","value":"LGT_LED_SMART"}]'::jsonb,
   '{"type":"PER_UNIT","unitCost":150000}'::jsonb,
   30),

  ('m4', '高效率冷氣 (Chiller VSD)', 'High-Efficiency VRF (Gen 7)', 'HVAC',
   '升級為高部分負載效率的高效率冷氣系統。', 'Upgrade HVAC units to next-gen high-efficiency chiller with VSD.',
   '{}'::jsonb,
   '[{"section":"mep","field":"selected_hvac","value":"HVAC_CHILLER_VSD"}]'::jsonb,
   '{"type":"PER_UNIT","unitCost":1200000}'::jsonb,
   40),

  ('m5', '電梯再生驅動', 'Elevator Regen Drive', 'ELEVATOR',
   '加裝電梯再生驅動以回收電力。', 'Add regenerative power recovery to elevator motors.',
   '{}'::jsonb,
   '[{"section":"mep","field":"selected_elevator","value":"ET_VVVF_REGEN"}]'::jsonb,
   '{"type":"PER_UNIT","unitCost":80000}'::jsonb,
   50),

  ('m6', '綠屋頂隔熱', 'Vacuum Roof Insulation', 'ENVELOPE',
   '於現有屋頂加裝高效綠屋頂/真空板隔熱層。', 'Add high-performance green/VIP panels to existing roof structure.',
   '{}'::jsonb,
   '[{"section":"envelope","field":"selected_roof","value":"CONS_ROOF_GREEN"}]'::jsonb,
   '{"type":"PER_M2_ROOF","unitCost":1200}'::jsonb,
   60),

  ('m7', '進階冰水主機', 'Advanced Chiller Plant', 'HVAC',
   '採用磁浮離心式冰水主機與VSD冰水次級泵。', 'Magnetic bearing centrifugal chiller with secondary pumping.',
   '{"useCategory":["USE_OFFICE","USE_HOTEL"]}'::jsonb,
   '[{"section":"mep","field":"selected_hvac","value":"HVAC_CHILLER_VSD"}]'::jsonb,
   '{"type":"FIXED","unitCost":3500000}'::jsonb,
   70),

  ('m8', '智慧百葉系統', 'Smart Blind System', 'CONTROL',
   '雲端日射追蹤之自動動態遮陽控制。', 'Automated dynamic shading controlled by cloud-based solar tracking.',
   '{"minWWR":0.35}'::jsonb,
   '[{"section":"envelope","field":"selected_shading","value":"SH_EGGCRATE"}]'::jsonb,
   '{"type":"PER_M2_WINDOW","unitCost":6500}'::jsonb,
   80),

  ('m9', '熱泵熱水系統', 'Heat Pump Water Heating', 'DHW',
   '將電熱熱水器升級為空氣源熱泵熱水機。', 'Replace electric water heaters with air-source heat pumps.',
   '{"useCategory":["USE_HOTEL","USE_HOSPITAL"]}'::jsonb,
   '[{"section":"mep","field":"selected_dhw","value":"DHW_HEATPUMP"}]'::jsonb,
   '{"type":"FIXED","unitCost":450000}'::jsonb,
   90),

  ('m10', '外牆外保溫', 'Wall External Insulation', 'ENVELOPE',
   '於外牆外側加裝10公分礦棉保溫板。', 'Add 10cm mineral wool board to the facade exterior.',
   '{}'::jsonb,
   '[{"section":"envelope","field":"selected_wall","value":"CONS_WALL_BRICK"}]'::jsonb,
   '{"type":"PER_M2_FACADE","unitCost":1800}'::jsonb,
   100),

  ('m11', '智慧能源管理 (BEMS)', 'Smart Energy Management', 'CONTROL',
   '導入BEMS進行全棟能源整合最佳化。', 'Install BEMS for holistic building energy optimization.',
   '{}'::jsonb,
   '[{"section":"mep","field":"selected_lighting","value":"LGT_LED_SMART"},{"section":"mep","field":"selected_hvac","value":"HVAC_CHILLER_VSD"}]'::jsonb,
   '{"type":"PER_UNIT","unitCost":500000}'::jsonb,
   110),

  ('m12', 'LPD照明密度優化', 'LPD Optimization', 'LIGHTING',
   '室內照明重新設計以降低照明密度LPD。', 'Aggressive interior lighting redesign to minimize LPD.',
   '{}'::jsonb,
   '[{"section":"mep","field":"selected_lighting","value":"LGT_LED_DIM"}]'::jsonb,
   '{"type":"PER_UNIT","unitCost":250000}'::jsonb,
   120)
ON CONFLICT (id) DO UPDATE SET
  name_zh        = EXCLUDED.name_zh,
  name_en        = EXCLUDED.name_en,
  category       = EXCLUDED.category,
  description_zh = EXCLUDED.description_zh,
  description_en = EXCLUDED.description_en,
  eligibility    = EXCLUDED.eligibility,
  patches        = EXCLUDED.patches,
  cost_model     = EXCLUDED.cost_model,
  sort_order     = EXCLUDED.sort_order,
  is_active      = TRUE;
