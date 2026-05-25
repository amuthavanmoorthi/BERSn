/**
 * Project API client for bern6.
 *
 * Bridges the rich auth-aware projectApi (which talks to the real Backend
 * at API_BASE_URL — default http://localhost:4000) into bern6's simpler
 * local Project / ProjectFormData shape, so the existing UI components
 * (ProjectDashboard, CreateProjectModal, ProjectCard) keep working
 * without UI changes.
 *
 * Known limitations of the bridge:
 * - createProject() is best-effort: bern6's form captures an organization
 *   NAME and a building-type LABEL, but the Backend requires UUID + code.
 *   We look them up via /api/organizations and /api/building-types; create
 *   will fail with a clear error if no exact match is found.
 * - updateProject() metadata-only edits are not exposed by the Backend
 *   (only PATCH /workspace-settings is). Calls return the current project
 *   unchanged and emit a console warning.
 * - deleteProject() throws — bern6 has no RBAC-gated delete UI yet.
 * - Project.status is downgraded from the rich backend enum (DRAFT,
 *   SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, REVISION_REQUESTED,
 *   COMPLETED, ARCHIVED) to bern6's 3-value enum.
 */
import type { Project, ProjectFormData } from '../types/project';
import * as projectApi from './projectApi';
import type { Project as BackendProject } from '../types/backendApi';

function mapStatus(raw: string | undefined | null): Project['status'] {
  const upper = String(raw || '').toUpperCase();
  if (upper === 'DRAFT' || upper === 'REVISION_REQUESTED') return 'draft';
  if (upper === 'COMPLETED' || upper === 'APPROVED' || upper === 'ARCHIVED') return 'completed';
  return 'in-progress';
}

function downgradeProject(rich: BackendProject): Project {
  return {
    id: rich.id,
    name: rich.name,
    organization: rich.organization,
    location: rich.location ?? undefined,
    createdAt: rich.createdAt,
    updatedAt: rich.updatedAt,
    status: mapStatus(rich.status),
    thumbnail: rich.thumbnail,
    category: rich.category,
    buildingType: rich.buildingType,
    totalArea: rich.totalArea,
    grade: rich.grade,
    eei: rich.eei,
  };
}

// ---- Projects ----
export async function listProjects(): Promise<Project[]> {
  const rich = await projectApi.getProjects();
  return rich.map(downgradeProject);
}

export async function createProject(form: ProjectFormData): Promise<Project> {
  const [orgs, buildingTypes] = await Promise.all([
    projectApi.getOrganizations(),
    projectApi.getBuildingTypes(),
  ]);

  const org = orgs.find((o) => o.name === form.organization);
  if (!org) {
    const names = orgs.map((o) => o.name).join(', ');
    throw new Error(
      `Organization "${form.organization}" not found in backend. Available: ${names}`,
    );
  }

  const btCode = form.buildingType
    ? buildingTypes.find(
        (bt) =>
          bt.labelEn === form.buildingType
          || bt.labelZh === form.buildingType
          || bt.code === form.buildingType,
      )?.code
    : buildingTypes[0]?.code;
  if (!btCode) {
    throw new Error(
      `Building type "${form.buildingType ?? '(unspecified)'}" not found in backend.`,
    );
  }

  const rich = await projectApi.createProject({
    name: form.name,
    organizationId: org.id,
    location: form.location,
    buildingTypeCode: btCode,
    totalArea: form.totalArea ?? 0,
  });
  return downgradeProject(rich);
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const rich = await projectApi.getProject(id);
    return downgradeProject(rich);
  } catch (e: any) {
    const msg = String(e?.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('404')) return null;
    throw e;
  }
}

export async function updateProject(id: string, _patch: Partial<Project>): Promise<Project> {
  // The Backend does not currently expose a generic project-metadata patch.
  // Only PATCH /api/projects/:id/workspace-settings is implemented (used by
  // projectStorage.ts). Return the unchanged record so callers don't error
  // out, and log so divergence is visible during development.
  console.warn(
    '[apiClient] updateProject(): backend does not expose a generic metadata patch; returning current project.',
  );
  const rich = await projectApi.getProject(id);
  return downgradeProject(rich);
}

export async function deleteProject(_id: string): Promise<void> {
  throw new Error(
    'Project delete is not wired in bern6 yet (Backend endpoint is RBAC-gated; no UI surface).',
  );
}

// ---- Health ----
export async function ping(): Promise<{ ok: boolean; projectCount: number }> {
  const projects = await listProjects();
  return { ok: true, projectCount: projects.length };
}
