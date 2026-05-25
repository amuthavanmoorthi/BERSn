/**
 * Per-project geometry persistence — wired to the real Backend via projectApi.
 *
 * Floors are stored as part of the workspace-settings record. Saving requires
 * a full PATCH because the Backend's PATCH /workspace-settings replaces every
 * field, so we read the project first and merge.
 *
 * Errors resolve to `null` / no-op so transient backend hiccups don't crash
 * the UI; the next debounced save will retry.
 */
import { Floor } from '../types';
import * as projectApi from './projectApi';

export async function saveProjectFloors(projectId: string, floors: Floor[]): Promise<void> {
  if (!projectId) return;
  try {
    const current = await projectApi.getProject(projectId);
    const ws = current.workspace;
    await projectApi.updateWorkspaceSettings(projectId, {
      elevatorCount: ws?.elevatorCount ?? 4,
      exemptAreas: ws?.exemptAreas ?? [],
      floors,
      geometryObjects: ws?.geometryObjects ?? [],
      selectedDhw: ws?.selectedDhw ?? 'DHW_NONE',
      selectedElevator: ws?.selectedElevator ?? 'ET_VVVF',
      selectedGlazing: ws?.selectedGlazing ?? 'GLZ_DBL_LOW_E',
      selectedHvac: ws?.selectedHvac ?? 'HVAC_VRF',
      selectedLighting: ws?.selectedLighting ?? 'LGT_LED',
      selectedRegion: ws?.selectedRegion ?? 'REGION_A',
      selectedRoof: ws?.selectedRoof ?? 'CONS_ROOF_RC_INS',
      selectedShading: ws?.selectedShading ?? 'SH_OVERHANG',
      selectedUseCategory: ws?.selectedUseCategory ?? 'USE_OFFICE',
      selectedWall: ws?.selectedWall ?? 'CONS_WALL_RC_INS',
    });
  } catch (e) {
    console.warn('[projectStorage] save failed', e);
  }
}

export async function loadProjectFloors(projectId: string): Promise<Floor[] | null> {
  if (!projectId) return null;
  try {
    const project = await projectApi.getProject(projectId);
    return project.workspace?.floors ?? null;
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('404')) return null;
    console.warn('[projectStorage] load failed', e);
    return null;
  }
}

/**
 * Kept for API compatibility with the previous IndexedDB module.
 * The backend cleans up workspace data automatically when the project itself
 * is deleted via DELETE /api/projects/:id, so this is a no-op.
 */
export async function deleteProjectFloors(_projectId: string): Promise<void> {
  return;
}

/**
 * Kept for API compatibility. Project listing now lives in apiClient.ts
 * (`listProjects`); this returns an empty array.
 */
export async function listSavedProjects(): Promise<unknown[]> {
  return [];
}
