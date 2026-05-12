import type { PoolClient } from 'pg';

import type { TimestampValue } from '../types/auth.js';

export interface MeasureRow {
  id: string;
  name_zh: string;
  name_en: string;
  category: string;
  description_zh: string;
  description_en: string;
  eligibility: unknown;
  patches: unknown;
  cost_model: unknown;
  sort_order: number;
  is_active: boolean;
}

export interface ProjectScenarioRow {
  id: string;
  project_id: string;
  name: string;
  created_by: string;
  created_at: TimestampValue;
  updated_at: TimestampValue;
}

export interface ScenarioMeasureRow {
  scenario_id: string;
  measure_id: string;
  ordinal: number;
}

export interface ScenarioResultRow {
  id: string;
  scenario_id: string;
  simulated_eei: string;
  simulated_score: string;
  simulated_grade: string;
  total_cost_twd: string;
  cp_value: string;
  baseline_eei: string | null;
  computed_at: TimestampValue;
}

const MEASURE_SELECT = `
  SELECT id, name_zh, name_en, category, description_zh, description_en,
         eligibility, patches, cost_model, sort_order, is_active
    FROM measure_library
`;

export async function listActiveMeasures(client: PoolClient): Promise<MeasureRow[]> {
  const { rows } = await client.query<MeasureRow>(
    `${MEASURE_SELECT}
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
}

export async function findMeasureById(client: PoolClient, id: string): Promise<MeasureRow | null> {
  const { rows } = await client.query<MeasureRow>(
    `${MEASURE_SELECT}
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findMeasuresByIds(client: PoolClient, ids: string[]): Promise<MeasureRow[]> {
  if (ids.length === 0) {
    return [];
  }
  const { rows } = await client.query<MeasureRow>(
    `${MEASURE_SELECT}
      WHERE id = ANY($1::text[])
      ORDER BY sort_order ASC, id ASC`,
    [ids],
  );
  return rows;
}

export async function listScenariosForProject(
  client: PoolClient,
  projectId: string,
): Promise<ProjectScenarioRow[]> {
  const { rows } = await client.query<ProjectScenarioRow>(
    `SELECT id, project_id, name, created_by, created_at, updated_at
       FROM project_scenarios
      WHERE project_id = $1
      ORDER BY created_at DESC`,
    [projectId],
  );
  return rows;
}

export async function findScenarioById(
  client: PoolClient,
  scenarioId: string,
): Promise<ProjectScenarioRow | null> {
  const { rows } = await client.query<ProjectScenarioRow>(
    `SELECT id, project_id, name, created_by, created_at, updated_at
       FROM project_scenarios
      WHERE id = $1
      LIMIT 1`,
    [scenarioId],
  );
  return rows[0] ?? null;
}

export async function listScenarioMeasureIds(
  client: PoolClient,
  scenarioIds: string[],
): Promise<ScenarioMeasureRow[]> {
  if (scenarioIds.length === 0) {
    return [];
  }
  const { rows } = await client.query<ScenarioMeasureRow>(
    `SELECT scenario_id, measure_id, ordinal
       FROM scenario_measures
      WHERE scenario_id = ANY($1::uuid[])
      ORDER BY scenario_id, ordinal ASC`,
    [scenarioIds],
  );
  return rows;
}

export async function insertScenario(
  client: PoolClient,
  payload: { project_id: string; name: string; created_by: string },
): Promise<ProjectScenarioRow> {
  const { rows } = await client.query<ProjectScenarioRow>(
    `INSERT INTO project_scenarios (project_id, name, created_by)
     VALUES ($1, $2, $3)
     RETURNING id, project_id, name, created_by, created_at, updated_at`,
    [payload.project_id, payload.name, payload.created_by],
  );
  return rows[0];
}

export async function insertScenarioMeasures(
  client: PoolClient,
  scenarioId: string,
  measureIds: string[],
): Promise<void> {
  if (measureIds.length === 0) {
    return;
  }
  const values: string[] = [];
  const params: unknown[] = [];
  measureIds.forEach((measureId, index) => {
    const base = index * 3;
    values.push(`($${base + 1}::uuid, $${base + 2}::text, $${base + 3}::int)`);
    params.push(scenarioId, measureId, index);
  });
  await client.query(
    `INSERT INTO scenario_measures (scenario_id, measure_id, ordinal)
     VALUES ${values.join(', ')}
     ON CONFLICT (scenario_id, measure_id) DO UPDATE SET ordinal = EXCLUDED.ordinal`,
    params,
  );
}

export async function deleteScenarioById(client: PoolClient, scenarioId: string): Promise<void> {
  await client.query(`DELETE FROM project_scenarios WHERE id = $1`, [scenarioId]);
}

export async function insertScenarioResult(
  client: PoolClient,
  payload: {
    scenario_id: string;
    simulated_eei: number;
    simulated_score: number;
    simulated_grade: string;
    total_cost_twd: number;
    cp_value: number;
    baseline_eei: number | null;
  },
): Promise<ScenarioResultRow> {
  const { rows } = await client.query<ScenarioResultRow>(
    `INSERT INTO scenario_results (
       scenario_id, simulated_eei, simulated_score, simulated_grade,
       total_cost_twd, cp_value, baseline_eei
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, scenario_id, simulated_eei, simulated_score, simulated_grade,
               total_cost_twd, cp_value, baseline_eei, computed_at`,
    [
      payload.scenario_id,
      payload.simulated_eei,
      payload.simulated_score,
      payload.simulated_grade,
      payload.total_cost_twd,
      payload.cp_value,
      payload.baseline_eei,
    ],
  );
  return rows[0];
}

export async function findLatestScenarioResult(
  client: PoolClient,
  scenarioId: string,
): Promise<ScenarioResultRow | null> {
  const { rows } = await client.query<ScenarioResultRow>(
    `SELECT id, scenario_id, simulated_eei, simulated_score, simulated_grade,
            total_cost_twd, cp_value, baseline_eei, computed_at
       FROM scenario_results
      WHERE scenario_id = $1
      ORDER BY computed_at DESC
      LIMIT 1`,
    [scenarioId],
  );
  return rows[0] ?? null;
}
