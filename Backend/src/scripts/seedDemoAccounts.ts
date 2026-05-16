/**
 * Provisions three demo accounts for client hand-off.
 *
 *   username | password         | role
 *   ---------+------------------+--------------
 *   admin    |  Bersn@Demo2026! |  SYS_ADMIN
 *   vendor   |  Bersn@Demo2026! |  VENDOR_USER
 *   agency   |  Bersn@Demo2026! |  AGENCY_USER
 *
 * Existing canonical seed users (amuthavanmmoorthi@gmail.com,
 * amudhavanm17@gmail.com, amudhavan.episode@gmail.com — see
 * src/scripts/seedRbacAccounts.ts) are NOT touched.
 *
 * Notes:
 *   * Username lookup is case-insensitive on login (`WHERE lower(username) = lower($1)`),
 *     so the client can type "Admin" / "Vendor" / "Agency" and still
 *     hit the corresponding lowercase row created here.
 *   * The shared password satisfies the production policy (≥12 chars,
 *     mixed case, digit, symbol) and does NOT contain any of the
 *     three demo usernames, so it would survive the strength check
 *     if these accounts were ever re-created via the admin API.
 *   * The script uses direct argon2 hashing + INSERT/UPDATE so it
 *     stays decoupled from the admin-create flow.
 *
 * Run with:
 *   DB_HOST=… DB_PORT=… DB_NAME=… DB_USER=… DB_PASSWORD=… \
 *     npm run db:seed-demo-accounts
 */

import crypto from 'crypto';
import type { PoolClient } from 'pg';

import pool from '../db.js';
import { hashPassword } from '../services/authCrypto.js';

interface DemoAccount {
  username: string;
  fullName: string;
  email: string;
  role: 'SYS_ADMIN' | 'AGENCY_USER' | 'VENDOR_USER';
  organizationName: string;
  organizationType: 'GOVERNMENT' | 'AGENCY' | 'VENDOR';
  department: string;
  position: string;
}

const DEMO_PASSWORD = 'Bersn@Demo2026!';

const ACCOUNTS: DemoAccount[] = [
  {
    username: 'admin',
    fullName: 'Demo System Admin',
    email: 'admin@bersn.demo',
    role: 'SYS_ADMIN',
    organizationName: 'BERSn Platform',
    organizationType: 'GOVERNMENT',
    department: 'Administration',
    position: 'System Administrator',
  },
  {
    username: 'vendor',
    fullName: 'Demo Vendor User',
    email: 'vendor@bersn.demo',
    role: 'VENDOR_USER',
    organizationName: 'Demo Vendor Solutions',
    organizationType: 'VENDOR',
    department: 'Sustainability Engineering',
    position: 'Project Submitter',
  },
  {
    username: 'agency',
    fullName: 'Demo Agency Reviewer',
    email: 'agency@bersn.demo',
    role: 'AGENCY_USER',
    organizationName: 'Demo Agency Bureau',
    organizationType: 'AGENCY',
    department: 'Energy Review Division',
    position: 'Project Reviewer',
  },
];

async function findOrCreateOrganization(
  client: PoolClient,
  name: string,
  type: DemoAccount['organizationType'],
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM organizations WHERE lower(name) = lower($1) LIMIT 1`,
    [name],
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO organizations (name, type, is_active)
       VALUES ($1, $2, TRUE)
       RETURNING id`,
    [name, type],
  );
  return inserted.rows[0].id;
}

async function upsertDemoAccount(
  client: PoolClient,
  account: DemoAccount,
  passwordHash: string,
): Promise<'created' | 'refreshed'> {
  const organizationId = await findOrCreateOrganization(
    client,
    account.organizationName,
    account.organizationType,
  );

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM users WHERE lower(username) = lower($1) LIMIT 1`,
    [account.username],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE users
          SET password_hash         = $2,
              role                  = $3::user_role,
              full_name             = $4,
              email                 = $5,
              organization          = $6,
              organization_id       = $7,
              department            = $8,
              position              = $9,
              is_active             = TRUE,
              is_first_login        = FALSE,
              temp_password_changed = TRUE,
              updated_at            = now()
        WHERE id = $1`,
      [
        existing.rows[0].id,
        passwordHash,
        account.role,
        account.fullName,
        account.email,
        account.organizationName,
        organizationId,
        account.department,
        account.position,
      ],
    );
    return 'refreshed';
  }

  await client.query(
    `INSERT INTO users (
        id, username, password_hash, role,
        full_name, email,
        organization, organization_id, department, position,
        is_active, is_first_login, temp_password_changed
      ) VALUES (
        $1, $2, $3, $4::user_role,
        $5, $6,
        $7, $8, $9, $10,
        TRUE, FALSE, TRUE
      )`,
    [
      crypto.randomUUID(),
      account.username,
      passwordHash,
      account.role,
      account.fullName,
      account.email,
      account.organizationName,
      organizationId,
      account.department,
      account.position,
    ],
  );
  return 'created';
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[seed-demo] Provisioning short-credential demo accounts...');
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    for (const account of ACCOUNTS) {
      try {
        await client.query('BEGIN');
        const status = await upsertDemoAccount(client, account, passwordHash);
        await client.query('COMMIT');
        console.log(`[seed-demo] ${status.padEnd(9)} ${account.username.padEnd(8)} (${account.role}) password=${DEMO_PASSWORD}`);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[seed-demo] FAILED   ${account.username}: ${message}`);
        process.exitCode = 1;
      }
    }
    console.log('[seed-demo] Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[seed-demo] Demo-account seeding failed: ${message}`);
  process.exitCode = 1;
});
