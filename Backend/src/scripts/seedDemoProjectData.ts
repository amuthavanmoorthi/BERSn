import crypto from 'crypto';
import type { PoolClient } from 'pg';

import pool from '../db.js';
import { hashPassword } from '../services/authCrypto.js';

type OrganizationType = 'GOVERNMENT' | 'VENDOR' | 'AGENCY';
type UserRole = 'SYS_ADMIN' | 'AGENCY_USER' | 'VENDOR_USER';
type ProjectStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED';

interface OrganizationSeed {
  id: string;
  name: string;
  type: OrganizationType;
}

interface UserSeed {
  department: string;
  email: string;
  fullName: string;
  organizationKey: string;
  position: string;
  role: UserRole;
}

interface ProjectSeed {
  assignedToEmail?: string;
  buildingTypeCode: string;
  calculatedByEmail?: string;
  createdAt: Date;
  createdByEmail?: string;
  euiResult?: number;
  id: string;
  location: string;
  name: string;
  notes?: string;
  organizationKey: string;
  status: ProjectStatus;
  totalFloorArea: number;
}

const DEMO_PASSWORD = 'BersnSeed!2026';
const CARBON_EMISSION_FACTOR = 0.509;

function deterministicUuid(seed: string): string {
  const bytes = Buffer.from(crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const organizations: Record<string, OrganizationSeed> = {
  taoyuanGovernment: {
    id: deterministicUuid('bersn-demo:organization:taoyuan-government'),
    name: 'Taoyuan City Government',
    type: 'GOVERNMENT',
  },
  reviewAgency: {
    id: deterministicUuid('bersn-demo:organization:green-building-review-agency'),
    name: 'Taoyuan Green Building Review Agency',
    type: 'AGENCY',
  },
  northEnergyCenter: {
    id: deterministicUuid('bersn-demo:organization:northern-energy-assessment-center'),
    name: 'Northern Energy Assessment Center',
    type: 'AGENCY',
  },
  formosaDesign: {
    id: deterministicUuid('bersn-demo:organization:formosa-sustainable-design'),
    name: 'Formosa Sustainable Design Co.',
    type: 'VENDOR',
  },
  ecoBuildStudio: {
    id: deterministicUuid('bersn-demo:organization:ecobuild-engineering-studio'),
    name: 'EcoBuild Engineering Studio',
    type: 'VENDOR',
  },
};

const users: UserSeed[] = [
  {
    email: 'gov.admin@bersn.local',
    fullName: 'Government Platform Admin',
    role: 'SYS_ADMIN',
    organizationKey: 'taoyuanGovernment',
    department: 'Building Management Office',
    position: 'Platform Administrator',
  },
  {
    email: 'agency.reviewer@bersn.local',
    fullName: 'Lin Agency Reviewer',
    role: 'AGENCY_USER',
    organizationKey: 'reviewAgency',
    department: 'Energy Review Division',
    position: 'Senior Reviewer',
  },
  {
    email: 'agency.engineer@bersn.local',
    fullName: 'Chen Energy Engineer',
    role: 'AGENCY_USER',
    organizationKey: 'northEnergyCenter',
    department: 'Technical Assessment',
    position: 'Energy Engineer',
  },
  {
    email: 'vendor.designer@bersn.local',
    fullName: 'Wang Design Vendor',
    role: 'VENDOR_USER',
    organizationKey: 'formosaDesign',
    department: 'Sustainable Design',
    position: 'Project Designer',
  },
  {
    email: 'vendor.energy@bersn.local',
    fullName: 'Huang Energy Consultant',
    role: 'VENDOR_USER',
    organizationKey: 'ecoBuildStudio',
    department: 'Energy Modeling',
    position: 'Energy Consultant',
  },
];

const projects: ProjectSeed[] = [
  {
    id: deterministicUuid('bersn-demo:project:a1-green-headquarters'),
    name: 'A1 Green Headquarters',
    organizationKey: 'reviewAgency',
    location: 'Taoyuan District, Taoyuan City',
    buildingTypeCode: 'OFFICE',
    totalFloorArea: 12500.5,
    status: 'IN_REVIEW',
    createdByEmail: 'agency.reviewer@bersn.local',
    calculatedByEmail: 'agency.reviewer@bersn.local',
    euiResult: 172.35,
    notes: 'Envelope-first office baseline review.',
    createdAt: new Date('2026-04-01T09:00:00+08:00'),
  },
  {
    id: deterministicUuid('bersn-demo:project:taoyuan-retail-plaza'),
    name: 'Taoyuan Retail Plaza',
    organizationKey: 'formosaDesign',
    location: 'Zhongli District, Taoyuan City',
    buildingTypeCode: 'RETAIL',
    totalFloorArea: 8800,
    status: 'DRAFT',
    createdByEmail: 'vendor.designer@bersn.local',
    assignedToEmail: 'vendor.designer@bersn.local',
    euiResult: 245.1,
    notes: 'Vendor draft model with lighting-load assumptions.',
    createdAt: new Date('2026-04-02T10:30:00+08:00'),
  },
  {
    id: deterministicUuid('bersn-demo:project:smart-hotel-retrofit'),
    name: 'Smart Hotel Efficiency Retrofit',
    organizationKey: 'northEnergyCenter',
    location: 'Luzhu District, Taoyuan City',
    buildingTypeCode: 'HOTEL',
    totalFloorArea: 6200.75,
    status: 'IN_REVIEW',
    createdByEmail: 'agency.engineer@bersn.local',
    calculatedByEmail: 'agency.engineer@bersn.local',
    euiResult: 190.75,
    notes: 'Hotel retrofit calculation with high-efficiency HVAC.',
    createdAt: new Date('2026-04-03T14:00:00+08:00'),
  },
  {
    id: deterministicUuid('bersn-demo:project:taoyuan-hospital-wing'),
    name: 'Taoyuan Hospital New Wing',
    organizationKey: 'taoyuanGovernment',
    location: 'Bade District, Taoyuan City',
    buildingTypeCode: 'HOSPITAL',
    totalFloorArea: 14200.2,
    status: 'APPROVED',
    createdByEmail: 'gov.admin@bersn.local',
    calculatedByEmail: 'gov.admin@bersn.local',
    euiResult: 330.4,
    notes: 'Approved hospital project with medical-load adjustment.',
    createdAt: new Date('2026-04-04T11:15:00+08:00'),
  },
  {
    id: deterministicUuid('bersn-demo:project:passive-residential-block'),
    name: 'Passive Residential Block',
    organizationKey: 'ecoBuildStudio',
    location: 'Guishan District, Taoyuan City',
    buildingTypeCode: 'RESIDENTIAL',
    totalFloorArea: 3600.4,
    status: 'DRAFT',
    createdByEmail: 'vendor.energy@bersn.local',
    assignedToEmail: 'vendor.energy@bersn.local',
    createdAt: new Date('2026-04-05T09:45:00+08:00'),
  },
  {
    id: deterministicUuid('bersn-demo:project:mixed-use-net-zero-campus'),
    name: 'Mixed Use Net Zero Campus',
    organizationKey: 'taoyuanGovernment',
    location: 'Qingpu Special District, Taoyuan City',
    buildingTypeCode: 'MIXED_USE',
    totalFloorArea: 9600,
    status: 'APPROVED',
    calculatedByEmail: 'gov.admin@bersn.local',
    euiResult: 150.6,
    notes: 'Approved mixed-use campus with renewable-ready inputs.',
    createdAt: new Date('2026-04-06T16:20:00+08:00'),
  },
];

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function gradeFor(euiResult: number, baseline: number): 'GOLD' | 'SILVER' | 'BRONZE' | 'FAIL' {
  const ratio = euiResult / baseline;
  if (ratio <= 0.65) {
    return 'GOLD';
  }
  if (ratio <= 0.8) {
    return 'SILVER';
  }
  if (ratio <= 1) {
    return 'BRONZE';
  }
  return 'FAIL';
}

async function findAdminId(client: PoolClient): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id
       FROM users
      WHERE role::text = 'SYS_ADMIN'
        AND is_active = TRUE
      ORDER BY CASE WHEN lower(username) = 'admin' THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1`,
  );
  const adminId = rows[0]?.id;
  if (!adminId) {
    throw new Error('No active SYS_ADMIN user found. Please create/login the admin account before running the demo seed.');
  }
  return adminId;
}

async function upsertOrganization(client: PoolClient, organization: OrganizationSeed): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM organizations WHERE lower(name) = lower($1) LIMIT 1`,
    [organization.name],
  );

  if (existing.rows[0]?.id) {
    await client.query(
      `UPDATE organizations
          SET type = $2,
              is_active = TRUE
        WHERE id = $1`,
      [existing.rows[0].id, organization.type],
    );
    return existing.rows[0].id;
  }

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO organizations (id, name, type, is_active)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (id)
     DO UPDATE SET
       name = EXCLUDED.name,
       type = EXCLUDED.type,
       is_active = TRUE
     RETURNING id`,
    [organization.id, organization.name, organization.type],
  );
  return rows[0].id;
}

async function upsertDemoUser(
  client: PoolClient,
  seed: UserSeed,
  organizationId: string,
  organizationName: string,
  adminId: string,
  passwordHash: string,
): Promise<string> {
  const userId = deterministicUuid(`bersn-demo:user:${seed.email}`);
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO users (
       id,
       username,
       full_name,
       email,
       password_hash,
       role,
       organization,
       organization_id,
       department,
       position,
       created_by,
       is_active,
       is_first_login,
       temp_password_changed,
       created_at,
       updated_at
     )
     VALUES (
       $1,
       $2,
       $3,
       $2,
       $4,
       $5::user_role,
       $6,
       $7,
       $8,
       $9,
       $10,
       TRUE,
       FALSE,
       TRUE,
       now(),
       now()
     )
     ON CONFLICT (username)
     DO UPDATE SET
       full_name = EXCLUDED.full_name,
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       organization = EXCLUDED.organization,
       organization_id = EXCLUDED.organization_id,
       department = EXCLUDED.department,
       position = EXCLUDED.position,
       created_by = COALESCE(users.created_by, EXCLUDED.created_by),
       is_active = TRUE,
       is_first_login = FALSE,
       temp_password_changed = TRUE,
       updated_at = now()
     RETURNING id`,
    [
      userId,
      seed.email,
      seed.fullName,
      passwordHash,
      seed.role,
      organizationName,
      organizationId,
      seed.department,
      seed.position,
      adminId,
    ],
  );
  return rows[0].id;
}

async function upsertProject(
  client: PoolClient,
  seed: ProjectSeed,
  organizationId: string,
  organizationName: string,
  adminId: string,
  userIdsByEmail: Map<string, string>,
): Promise<void> {
  const createdBy = seed.createdByEmail ? userIdsByEmail.get(seed.createdByEmail) : adminId;
  const assignedTo = seed.assignedToEmail ? userIdsByEmail.get(seed.assignedToEmail) || null : null;
  if (!createdBy) {
    throw new Error(`Missing created_by user for project ${seed.name}`);
  }

  await client.query(
    `INSERT INTO projects (
       id,
       project_name,
       organization,
       location,
       building_type_code,
       total_floor_area,
       status,
       created_by,
       assigned_to,
       organization_id,
       is_deleted,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, $11, $11)
     ON CONFLICT (id)
     DO UPDATE SET
       project_name = EXCLUDED.project_name,
       organization = EXCLUDED.organization,
       location = EXCLUDED.location,
       building_type_code = EXCLUDED.building_type_code,
       total_floor_area = EXCLUDED.total_floor_area,
       status = EXCLUDED.status,
       created_by = EXCLUDED.created_by,
       assigned_to = EXCLUDED.assigned_to,
       organization_id = EXCLUDED.organization_id,
       is_deleted = FALSE,
       updated_at = now()`,
    [
      seed.id,
      seed.name,
      organizationName,
      seed.location,
      seed.buildingTypeCode,
      seed.totalFloorArea,
      seed.status,
      createdBy,
      assignedTo,
      organizationId,
      seed.createdAt,
    ],
  );
}

async function upsertCalculation(
  client: PoolClient,
  seed: ProjectSeed,
  userIdsByEmail: Map<string, string>,
  adminId: string,
): Promise<void> {
  if (seed.euiResult === undefined) {
    return;
  }

  const calculatedBy = seed.calculatedByEmail ? userIdsByEmail.get(seed.calculatedByEmail) : adminId;
  if (!calculatedBy) {
    throw new Error(`Missing calculated_by user for project ${seed.name}`);
  }

  const buildingType = await client.query<{ eui_baseline: string }>(
    `SELECT eui_baseline FROM building_types WHERE code = $1 LIMIT 1`,
    [seed.buildingTypeCode],
  );
  const baseline = Number(buildingType.rows[0]?.eui_baseline);
  if (!Number.isFinite(baseline)) {
    throw new Error(`Missing building type baseline for ${seed.buildingTypeCode}`);
  }

  const totalEnergyKwh = round(seed.euiResult * seed.totalFloorArea, 4);
  const carbonEmissionKg = round(totalEnergyKwh * CARBON_EMISSION_FACTOR, 4);
  const grade = gradeFor(seed.euiResult, baseline);

  await client.query(
    `INSERT INTO project_calculations (
       id,
       project_id,
       calculated_by,
       calculation_version,
       eui_result,
       total_energy_kwh,
       carbon_emission_kg,
       green_building_grade,
       input_snapshot,
       notes,
       calculated_at
     )
     VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8::jsonb, $9, $10)
     ON CONFLICT (project_id, calculation_version)
     DO UPDATE SET
       calculated_by = EXCLUDED.calculated_by,
       eui_result = EXCLUDED.eui_result,
       total_energy_kwh = EXCLUDED.total_energy_kwh,
       carbon_emission_kg = EXCLUDED.carbon_emission_kg,
       green_building_grade = EXCLUDED.green_building_grade,
       input_snapshot = EXCLUDED.input_snapshot,
       notes = EXCLUDED.notes,
       calculated_at = EXCLUDED.calculated_at`,
    [
      deterministicUuid(`bersn-demo:calculation:${seed.id}:v1`),
      seed.id,
      calculatedBy,
      seed.euiResult,
      totalEnergyKwh,
      carbonEmissionKg,
      grade,
      JSON.stringify({
        seed: 'BERSn demo project data',
        building_type_code: seed.buildingTypeCode,
        baseline_eui: baseline,
        total_floor_area: seed.totalFloorArea,
        eui_result: seed.euiResult,
      }),
      seed.notes || null,
      new Date(seed.createdAt.getTime() + 60 * 60 * 1000),
    ],
  );
}

async function insertProjectAuditLogs(
  client: PoolClient,
  seed: ProjectSeed,
  adminId: string,
  userIdsByEmail: Map<string, string>,
): Promise<void> {
  const actorId = seed.createdByEmail ? userIdsByEmail.get(seed.createdByEmail) || adminId : adminId;
  const auditRows: Array<{ action: string; changedFields: unknown; createdAt: Date; suffix: string; userId: string }> = [
    {
      suffix: 'created',
      action: 'CREATED',
      userId: actorId,
      createdAt: seed.createdAt,
      changedFields: {
        project_name: { from: null, to: seed.name },
        building_type_code: { from: null, to: seed.buildingTypeCode },
        total_floor_area: { from: null, to: seed.totalFloorArea },
      },
    },
  ];

  if (seed.status === 'IN_REVIEW' || seed.status === 'APPROVED') {
    auditRows.push({
      suffix: 'submitted',
      action: 'SUBMITTED',
      userId: actorId,
      createdAt: new Date(seed.createdAt.getTime() + 30 * 60 * 1000),
      changedFields: { status: { from: 'DRAFT', to: 'IN_REVIEW' } },
    });
  }

  if (seed.euiResult !== undefined) {
    const calculatedBy = seed.calculatedByEmail ? userIdsByEmail.get(seed.calculatedByEmail) || adminId : adminId;
    auditRows.push({
      suffix: 'calculated',
      action: 'CALCULATED',
      userId: calculatedBy,
      createdAt: new Date(seed.createdAt.getTime() + 60 * 60 * 1000),
      changedFields: { eui_result: { from: null, to: seed.euiResult } },
    });
  }

  if (seed.status === 'APPROVED') {
    auditRows.push({
      suffix: 'approved',
      action: 'APPROVED',
      userId: adminId,
      createdAt: new Date(seed.createdAt.getTime() + 90 * 60 * 1000),
      changedFields: { status: { from: 'IN_REVIEW', to: 'APPROVED' } },
    });
  }

  for (const row of auditRows) {
    await client.query(
      `INSERT INTO project_audit_logs (
         id,
         project_id,
         user_id,
         action,
         changed_fields,
         ip_address,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, '127.0.0.1'::inet, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        deterministicUuid(`bersn-demo:project-audit:${seed.id}:${row.suffix}`),
        seed.id,
        row.userId,
        row.action,
        JSON.stringify(row.changedFields),
        row.createdAt,
      ],
    );
  }
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const adminId = await findAdminId(client);
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    const organizationIds = new Map<string, string>();
    for (const [key, organization] of Object.entries(organizations)) {
      organizationIds.set(key, await upsertOrganization(client, organization));
    }

    await client.query(
      `UPDATE users
          SET full_name = COALESCE(NULLIF(full_name, ''), 'System Administrator'),
              email = COALESCE(NULLIF(email, ''), 'admin@bersn.local'),
              organization = $2,
              organization_id = $3,
              department = COALESCE(NULLIF(department, ''), 'Platform Security'),
              position = COALESCE(NULLIF(position, ''), 'System Administrator'),
              is_first_login = FALSE,
              temp_password_changed = TRUE,
              updated_at = now()
        WHERE id = $1`,
      [adminId, organizations.taoyuanGovernment.name, organizationIds.get('taoyuanGovernment')],
    );

    const userIdsByEmail = new Map<string, string>();
    for (const user of users) {
      const organization = organizations[user.organizationKey];
      const organizationId = organizationIds.get(user.organizationKey);
      if (!organization || !organizationId) {
        throw new Error(`Missing organization for ${user.email}`);
      }
      const userId = await upsertDemoUser(client, user, organizationId, organization.name, adminId, passwordHash);
      userIdsByEmail.set(user.email, userId);
    }

    for (const project of projects) {
      const organization = organizations[project.organizationKey];
      const organizationId = organizationIds.get(project.organizationKey);
      if (!organization || !organizationId) {
        throw new Error(`Missing organization for ${project.name}`);
      }
      await upsertProject(client, project, organizationId, organization.name, adminId, userIdsByEmail);
      await upsertCalculation(client, project, userIdsByEmail, adminId);
      await insertProjectAuditLogs(client, project, adminId, userIdsByEmail);
    }

    await client.query('COMMIT');

    console.log('Seeded BERSn demo users, organizations, projects, calculations, and project audit logs.');
    console.log(JSON.stringify({
      demo_password: DEMO_PASSWORD,
      users: users.map((user) => ({ username: user.email, role: user.role })),
      project_count: projects.length,
      organization_count: Object.keys(organizations).length,
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to seed BERSn demo data: ${message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to seed BERSn demo data: ${message}`);
  process.exitCode = 1;
});
