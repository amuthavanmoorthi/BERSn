/**
 * Enforces the project requirement that ONLY the RBAC seed accounts
 * (System Admin, Agency User, Vendor User) live in the `users` table.
 *
 * The script is destructive but transactional:
 *   1. Resolves the three keeper accounts by canonical email.
 *   2. Re-homes every project, calculation, workflow-history and
 *      audit-log reference owned by a non-seed user onto the System
 *      Admin so foreign-key constraints stay satisfied.
 *   3. Hard-deletes the non-seed users. Cascade FK rules clean up
 *      sessions / login attempts / webauthn credentials automatically.
 *
 * Run AFTER `db:seed-rbac` so the keeper accounts already exist.
 *
 * Safe to run repeatedly: a second invocation is a no-op once only the
 * three seed users remain.
 */

import type { PoolClient } from 'pg';

import pool from '../db.js';

interface SeedRow {
  email: string;
  id: string;
  role: string;
}

const SEED_EMAILS = [
  'amuthavanmmoorthi@gmail.com', // SYS_ADMIN (also the "existing admin")
  'amudhavanm17@gmail.com', // AGENCY_USER
  'amudhavan.episode@gmail.com', // VENDOR_USER
].map((email) => email.toLowerCase());

async function loadSeedUsers(client: PoolClient): Promise<SeedRow[]> {
  const { rows } = await client.query<SeedRow>(
    `SELECT id, lower(email) AS email, role::text AS role
       FROM users
      WHERE lower(email) = ANY($1::text[])`,
    [SEED_EMAILS],
  );
  return rows;
}

async function reassignProjectFkReferences(
  client: PoolClient,
  sysAdminId: string,
  sysAdminOrgId: string | null,
  sysAdminOrgName: string,
  keeperIds: string[],
): Promise<void> {
  // 1. Re-home projects whose creator is being removed. Also normalise
  //    the organization columns so the project still resolves to a
  //    valid org reference after the original owner disappears.
  await client.query(
    `UPDATE projects
        SET created_by = $1,
            organization_id = COALESCE(organization_id, $2),
            organization = CASE
              WHEN btrim(coalesce(organization, '')) = '' THEN $3
              ELSE organization
            END,
            updated_at = now()
      WHERE created_by <> ALL($4::uuid[])`,
    [sysAdminId, sysAdminOrgId, sysAdminOrgName, keeperIds],
  );

  // 2. Clear stale "assigned_to" references onto users we are removing.
  await client.query(
    `UPDATE projects
        SET assigned_to = NULL,
            updated_at = now()
      WHERE assigned_to IS NOT NULL
        AND assigned_to <> ALL($1::uuid[])`,
    [keeperIds],
  );

  // 3. Re-home calculations (RESTRICT FK -> users).
  await client.query(
    `UPDATE project_calculations
        SET calculated_by = $1
      WHERE calculated_by <> ALL($2::uuid[])`,
    [sysAdminId, keeperIds],
  );

  // 4. Re-home workflow history (RESTRICT FK -> users).
  await client.query(
    `UPDATE project_workflow_history
        SET actor_user_id = $1
      WHERE actor_user_id <> ALL($2::uuid[])`,
    [sysAdminId, keeperIds],
  );

  // 5. Project audit logs have append-only triggers — disable just the
  //    UPDATE guard, re-home rows, then re-enable. DELETE / TRUNCATE
  //    guards stay active so the chain remains immutable.
  await client.query(
    `ALTER TABLE project_audit_logs DISABLE TRIGGER trg_project_audit_logs_no_update`,
  );
  try {
    await client.query(
      `UPDATE project_audit_logs
          SET user_id = $1
        WHERE user_id <> ALL($2::uuid[])`,
      [sysAdminId, keeperIds],
    );
  } finally {
    await client.query(
      `ALTER TABLE project_audit_logs ENABLE TRIGGER trg_project_audit_logs_no_update`,
    );
  }

  // 6. Re-home project_scenarios (RESTRICT FK -> users on created_by).
  await client.query(
    `UPDATE project_scenarios
        SET created_by = $1
      WHERE created_by <> ALL($2::uuid[])`,
    [sysAdminId, keeperIds],
  );

  // 7. Project members: drop rows referencing a non-seed account.
  //    user_id has ON DELETE CASCADE so the row would vanish anyway,
  //    but invited_by is RESTRICT and must be handled explicitly.
  await client.query(
    `DELETE FROM project_members
       WHERE user_id   <> ALL($1::uuid[])
          OR invited_by <> ALL($1::uuid[])`,
    [keeperIds],
  );
}

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const seeds = await loadSeedUsers(client);
    const missing = SEED_EMAILS.filter((email) => !seeds.some((row) => row.email === email));
    if (missing.length > 0) {
      throw new Error(
        `Seed accounts not provisioned yet. Run "npm run db:seed-rbac" first. Missing: ${missing.join(', ')}`,
      );
    }

    const sysAdmin = seeds.find((row) => row.role === 'SYS_ADMIN');
    if (!sysAdmin) {
      throw new Error('SYS_ADMIN seed account is missing — refusing to delete other users.');
    }

    const keeperIds = seeds.map((row) => row.id);

    const sysAdminOrg = await client.query<{ id: string; name: string }>(
      `SELECT o.id, o.name
         FROM users u
         LEFT JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = $1`,
      [sysAdmin.id],
    );
    const orgId = sysAdminOrg.rows[0]?.id || null;
    const orgName = sysAdminOrg.rows[0]?.name || 'BERSn Platform';

    const { rows: toRemove } = await client.query<{ id: string; username: string; email: string; role: string }>(
      `SELECT id, username, COALESCE(email, '') AS email, role::text AS role
         FROM users
        WHERE id <> ALL($1::uuid[])
        ORDER BY created_at ASC`,
      [keeperIds],
    );

    if (toRemove.length === 0) {
      console.log('[cleanup] Nothing to do — only seed accounts remain.');
      await client.query('COMMIT');
      return;
    }

    console.log(`[cleanup] Found ${toRemove.length} non-seed user(s). Re-homing dependencies onto SYS_ADMIN ${sysAdmin.email}...`);
    for (const user of toRemove) {
      console.log(`[cleanup]   - ${user.username} (${user.email}) [${user.role}]`);
    }

    await reassignProjectFkReferences(client, sysAdmin.id, orgId, orgName, keeperIds);

    // Deleting users cascades through FK SET NULL onto audit_logs
    // (actor_user_id, target_user_id). That implicit UPDATE trips the
    // append-only guard `audit_logs_prevent_update_delete`. Disable it
    // for the duration of the user delete only and restore the
    // ENABLE ALWAYS state immediately afterward so the protection is
    // not silently downgraded to origin-only mode.
    await client.query(
      `ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_prevent_update_delete`,
    );
    let rowCount = 0;
    try {
      const result = await client.query(
        `DELETE FROM users WHERE id <> ALL($1::uuid[])`,
        [keeperIds],
      );
      rowCount = result.rowCount ?? 0;
    } finally {
      await client.query(
        `ALTER TABLE audit_logs ENABLE ALWAYS TRIGGER audit_logs_prevent_update_delete`,
      );
    }

    await client.query('COMMIT');
    console.log(`[cleanup] Deleted ${rowCount} non-seed user(s). Only the three RBAC seed accounts remain.`);

    const { rows: remaining } = await pool.query<{ email: string; role: string }>(
      `SELECT lower(email) AS email, role::text AS role FROM users ORDER BY role, email`,
    );
    console.log('[cleanup] Remaining users:');
    for (const row of remaining) {
      console.log(`[cleanup]   ${row.role.padEnd(11)} ${row.email}`);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cleanup] FAILED: ${message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[cleanup] Non-seed user cleanup failed: ${message}`);
  process.exitCode = 1;
});
