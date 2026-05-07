import { spawn } from 'child_process';
import path from 'path';

import { AuthServiceError } from './authService.js';

export interface GeometryPreviewMetrics {
  averageFloors: number;
  effectiveShadingRatio: number;
  estimatedFloorArea: number;
  overallWwr: number;
  roofArea: number;
  totalWallArea: number;
  totalWindowArea: number;
  wallEast: number;
  wallNorth: number;
  wallSouth: number;
  wallWest: number;
  winEast: number;
  winNorth: number;
  winSouth: number;
  winWest: number;
}

export interface GeometryPreviewResult {
  envelope?: unknown;
  geometry?: unknown;
  metrics: GeometryPreviewMetrics;
  mep?: unknown;
  objects: Array<{
    id: string;
    metrics: {
      estimatedFloorArea: number;
      floors: number;
      roofArea: number;
      wallArea: number;
      windowArea: number;
      wwr: number;
    };
    type: string;
  }>;
  performance?: unknown;
  project?: unknown;
  renderParams: unknown;
}

const PYTHON_TIMEOUT_MS = Number(process.env.BERSN_PYTHON_TIMEOUT_MS || 5000);
const PYTHON_BIN = process.env.BERSN_PYTHON_BIN || 'python3';
const GEOMETRY_SCRIPT = process.env.BERSN_GEOMETRY_SCRIPT
  || path.join(process.cwd(), 'python', 'bersn_geometry_preview.py');

function parsePythonJson(stdout: string, requestId: string): GeometryPreviewResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new AuthServiceError(
      502,
      'BERSN_PYTHON_CALC_INVALID_RESPONSE',
      'Python calculation service returned an invalid response.',
      { request_id: requestId },
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AuthServiceError(
      502,
      'BERSN_PYTHON_CALC_INVALID_RESPONSE',
      'Python calculation service returned an invalid response.',
      { request_id: requestId },
    );
  }

  const body = parsed as { ok?: boolean; message?: string } & Partial<GeometryPreviewResult>;
  if (body.ok !== true || !body.metrics) {
    throw new AuthServiceError(
      422,
      'BERSN_GEOMETRY_PREVIEW_FAILED',
      body.message || 'Geometry preview calculation failed.',
      { request_id: requestId },
    );
  }

  return {
    envelope: body.envelope,
    geometry: body.geometry,
    metrics: body.metrics,
    mep: body.mep,
    objects: Array.isArray(body.objects) ? body.objects : [],
    performance: body.performance,
    project: body.project,
    renderParams: body.renderParams || {},
  };
}

export async function runGeometryPreviewInPython(
  payload: unknown,
  requestId: string,
): Promise<GeometryPreviewResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [GEOMETRY_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new AuthServiceError(
        504,
        'BERSN_PYTHON_CALC_TIMEOUT',
        'Python calculation timed out.',
        { request_id: requestId },
      ));
    }, PYTHON_TIMEOUT_MS);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(new AuthServiceError(
        502,
        'BERSN_PYTHON_CALC_UNAVAILABLE',
        'Python calculation service is unavailable.',
        { request_id: requestId, error: error.message },
      ));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      try {
        if (code !== 0 && !stdout.trim()) {
          throw new AuthServiceError(
            502,
            'BERSN_PYTHON_CALC_FAILED',
            'Python calculation failed.',
            { request_id: requestId, stderr: stderr.slice(0, 500) },
          );
        }
        resolve(parsePythonJson(stdout, requestId));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.end(JSON.stringify(payload || {}));
  });
}
