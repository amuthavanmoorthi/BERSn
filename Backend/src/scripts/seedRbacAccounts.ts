import crypto from 'crypto';
import type { PoolClient } from 'pg';

import pool from '../db.js';
import {
  createManagedUser,
  findUserByUsername,
} from '../models/authModel.js';
import {
  findOrCreateOrganizationByName,
} from '../models/projectModel.js';
import { hashPassword } from '../services/authCrypto.js';
import { normalizeUserRole } from '../services/userPolicy.js';

interface SeedAccount {
  email: string;
  fullName: string;
  role: 'SYS_ADMIN' | 'AGENCY_USER' | 'VENDOR_USER';
  organizationName: string;
  organizationType: 'GOVERNMENT' | 'AGENCY' | 'VENDOR';
  department: string;
  position: string;
  defaultPasswordEnv: string;
}

const ACCOUNTS: SeedAccount[] = [
  {
    email: 'amuthavanmmoorthi@gmail.com',
    fullName: 'BERSn System Admin',
    role: 'SYS_ADMIN',
    organizationName: 'BERSn Platform',
    organizationType: 'GOVERNMENT',
    department: 'Administration',
    position: 'System Administrator',
    defaultPasswordEnv: 'SEED_SYS_ADMIN_PASSWORD',
  },
  {
    email: 'amudhavanm17@gmail.com',
    fullName: 'BERSn Agency Reviewer',
    role: 'AGENCY_USER',
    organizationName: 'Taoyuan Public Works Bureau',
    organizationType: 'AGENCY',
    department: 'Energy Review Division',
    position: 'Project Reviewer',
    defaultPasswordEnv: 'SEED_AGENCY_PASSWORD',
  },
  {
    email: 'amudhavan.episode@gmail.com',
    fullName: 'BERSn Vendor Submitter',
    role: 'VENDOR_USER',
    organizationName: 'Episode Building Solutions',
    organizationType: 'VENDOR',
    department: 'Sustainability Engineering',
    position: 'Project Submitter',
    defaultPasswordEnv: 'SEED_VENDOR_PASSWORD',
  },
];

const DEFAULT_TEMP_PASSWORD = 'BERSn@SeedAccess2026!';

function resolvePassword(envKey: string): string {
  const fromEnv = String(process.env[envKey] || '').trim();
  if (fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_TEMP_PASSWORD;
}

async function upsertSeedAccount(client: PoolClient, account: SeedAccount): Promise<{
  status: 'created' | 'refreshed' | 'unchanged';
  userId: string;
  temporaryPassword: string;
}> {
  const username = account.email.toLowerCase();
  const role = normalizeUserRole(account.role);
  const organization = await findOrCreateOrganizationByName(
    client,
    account.organizationName,
    account.organizationType,
  );
  const existing = await findUserByUsername(client, username);

  if (existing) {
    await client.query(
      `UPDATE users
          SET full_name      = $2,
              email          = $3,
              role           = $4::user_role,
              organization   = $5,
              organization_id = $6,
              department     = $7,
              position       = $8,
              is_active      = TRUE,
              is_first_login = FALSE,
              temp_password_changed = TRUE,
              updated_at     = now()
        WHERE id = $1`,
      [
        existing.id,
        account.fullName,
        username,
        role,
        account.organizationName,
        organization.id,
        account.department,
        account.position,
      ],
    );
    return { status: 'refreshed', userId: existing.id, temporaryPassword: '' };
  }

  const password = resolvePassword(account.defaultPasswordEnv);
  const passwordHash = await hashPassword(password);
  const created = await createManagedUser(client, {
    id: crypto.randomUUID(),
    username,
    full_name: account.fullName,
    email: username,
    password_hash: passwordHash,
    role,
    organization: account.organizationName,
    organization_id: organization.id,
    department: account.department,
    position: account.position,
    created_by: null,
    is_active: true,
    is_first_login: false,
    temp_password_changed: true,
  });

  if (!created) {
    throw new Error(`Failed to create seed account ${username}`);
  }

  return { status: 'created', userId: created.id, temporaryPassword: password };
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[seed] Provisioning RBAC seed accounts...');
    for (const account of ACCOUNTS) {
      await client.query('BEGIN');
      try {
        const result = await upsertSeedAccount(client, account);
        await client.query('COMMIT');
        if (result.status === 'created') {
          console.log(`[seed] CREATED   ${account.email} (${account.role})`);
          console.log(`[seed]   Temporary password: ${result.temporaryPassword}`);
        } else {
          console.log(`[seed] REFRESHED ${account.email} (${account.role}) — profile re-synced, password preserved`);
        }
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[seed] FAILED  ${account.email}: ${message}`);
        process.exitCode = 1;
      }
    }
    console.log('[seed] Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[seed] RBAC account seeding failed: ${message}`);
  process.exitCode = 1;
});
