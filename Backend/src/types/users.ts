import type { TimestampValue } from './auth.js';

export type ManagedUserStatus = 'active' | 'inactive' | 'pending';

export interface ManagedUserRow {
  created_at: TimestampValue;
  created_by: string | null;
  department: string | null;
  email: string | null;
  full_name: string | null;
  id: string;
  is_active: boolean;
  is_first_login: boolean;
  last_login_at: TimestampValue | null;
  organization: string | null;
  organization_id: string | null;
  position: string | null;
  role: string;
  temp_password_changed: boolean;
  username: string;
}

export interface ManagedUserSummary {
  createdAt: string;
  department: string | null;
  email: string;
  id: string;
  lastLoginAt: string | null;
  name: string;
  organizationName: string | null;
  organizationId: string | null;
  position: string | null;
  role: string;
  status: ManagedUserStatus;
  username: string;
}

export interface ManagedUserInsertPayload {
  created_by: string | null;
  department: string | null;
  email: string;
  full_name: string;
  id: string;
  is_active: boolean;
  is_first_login: boolean;
  organization: string | null;
  organization_id: string | null;
  password_hash: string;
  position: string | null;
  role: string;
  temp_password_changed: boolean;
  username: string;
}
