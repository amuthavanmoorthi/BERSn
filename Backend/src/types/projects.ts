import type { TimestampValue } from './auth.js';

export type ProjectStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED';
export type OrganizationType = 'GOVERNMENT' | 'VENDOR' | 'AGENCY';
export type ProjectAuditAction =
  | 'CREATED' | 'UPDATED' | 'SUBMITTED' | 'APPROVED' | 'DELETED' | 'CALCULATED'
  | 'SHARED' | 'UNSHARED' | 'PERMISSION_CHANGED';
export type ProjectPermission = 'viewer' | 'editor' | 'admin';

export interface ProjectMemberRow {
  id: string;
  project_id: string;
  user_id: string;
  permission: ProjectPermission;
  invited_by: string;
  invited_at: TimestampValue;
  accepted_at: TimestampValue | null;
  revoked_at: TimestampValue | null;
  username?: string;
}

export interface ProjectMemberSummary {
  id: string;
  projectId: string;
  userId: string;
  username: string | null;
  permission: ProjectPermission;
  invitedBy: string;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface BuildingTypeRow {
  code: string;
  eui_baseline: string;
  id: number;
  is_active: boolean;
  label_en: string;
  label_zh: string;
  sort_order: number;
  status: 'ready' | 'pending_crosswalk';
}

export interface BuildingTypeSummary {
  code: string;
  euiBaseline: number;
  id: number;
  isActive: boolean;
  labelEn: string;
  labelZh: string;
  sortOrder: number;
  source: string;
  /** ready = full BERSn calculation supported; pending_crosswalk = shown but Appendix 1 baseline not yet mapped */
  status: 'ready' | 'pending_crosswalk';
  verificationStatus: string;
}

export interface OrganizationRow {
  created_at: TimestampValue;
  id: string;
  is_active: boolean;
  name: string;
  type: OrganizationType;
}

export interface OrganizationSummary {
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  type: OrganizationType;
}

export interface ProjectUserContext {
  id: string;
  organization: string | null;
  organization_id: string | null;
  role: string;
  username: string;
}

export interface ProjectRow {
  assigned_to: string | null;
  building_type_code: string;
  building_type_eui_baseline: string;
  building_type_label_en: string;
  building_type_label_zh: string;
  created_at: TimestampValue;
  created_by: string;
  creator_username: string | null;
  elevator_count: number;
  exempt_areas: unknown;
  floors: unknown;
  geometry_objects: unknown;
  id: string;
  is_deleted: boolean;
  latest_calculation_at: TimestampValue | null;
  latest_eui_result: string | null;
  latest_grade: string | null;
  location: string | null;
  organization: string;
  organization_id: string | null;
  organization_name: string | null;
  project_name: string;
  selected_dhw: string;
  selected_elevator: string;
  selected_glazing: string;
  selected_hvac: string;
  selected_lighting: string;
  selected_region: string;
  selected_roof: string;
  selected_shading: string;
  selected_use_category: string;
  selected_wall: string;
  status: ProjectStatus;
  total_floor_area: string;
  updated_at: TimestampValue;
  workspace_saved_at: TimestampValue | null;
}

export interface ProjectSummary {
  assignedTo: string | null;
  buildingType: {
    code: string;
    euiBaseline: number;
    labelEn: string;
    labelZh: string;
  };
  createdAt: string;
  createdBy: string;
  creatorUsername: string | null;
  elevatorCount: number;
  exemptAreas: unknown;
  floors: unknown;
  geometryObjects: unknown;
  id: string;
  latestCalculationAt: string | null;
  latestCalculation: {
    eeiResult: number | null;
    grade: string | null;
  };
  location: string | null;
  organization: string;
  organizationId: string | null;
  projectName: string;
  selectedDhw: string;
  selectedElevator: string;
  selectedGlazing: string;
  selectedHvac: string;
  selectedLighting: string;
  selectedRegion: string;
  selectedRoof: string;
  selectedShading: string;
  selectedUseCategory: string;
  selectedWall: string;
  status: ProjectStatus;
  totalFloorArea: number;
  updatedAt: string;
  workspaceSavedAt: string | null;
}

export interface ProjectAuditLogRow {
  action: string;
  changed_fields: unknown;
  created_at: TimestampValue;
  id: string;
  ip_address: string | null;
  project_id: string;
  user_id: string;
  username: string | null;
}

export interface ProjectAuditLogSummary {
  action: string;
  at: string;
  changedFields: unknown;
  id: string;
  ipAddress: string | null;
  projectId: string;
  userId: string;
  username: string | null;
}

export interface ProjectCalculationRow {
  calculated_at: TimestampValue;
  calculated_by: string;
  calculation_version: number;
  carbon_emission_kg: string | null;
  eui_result: string | null;
  green_building_grade: string | null;
  id: string;
  input_snapshot: unknown;
  notes: string | null;
  project_id: string;
  total_energy_kwh: string | null;
}

export interface ProjectCalculationSummary {
  calculatedAt: string;
  calculatedBy: string;
  calculationVersion: number;
  carbonEmissionKg: number | null;
  euiResult: number | null;
  grade: string | null;
  id: string;
  inputSnapshot: unknown;
  notes: string | null;
  projectId: string;
  totalEnergyKwh: number | null;
}
