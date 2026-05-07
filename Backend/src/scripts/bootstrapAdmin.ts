import crypto from 'crypto';

import pool from '../db.js';
import { authConfig } from '../config/authConfig.js';
import { findUserByUsername, upsertUser } from '../models/authModel.js';
import { hashPassword } from '../services/authCrypto.js';
import { validatePasswordStrength } from '../services/passwordPolicy.js';
import { normalizeUserRole, validateUserRole, validateUsername } from '../services/userPolicy.js';

async function main(): Promise<void> {
  const { username, password, role, force } = authConfig.bootstrapAdmin;

  if (!username || !password) {
    console.log('[auth] Admin bootstrap skipped. No AUTH_BOOTSTRAP_ADMIN_USERNAME/PASSWORD configured.');
    return;
  }

  const normalizedUsername = username.toLowerCase();
  const usernameErrors = validateUsername(normalizedUsername);
  const roleErrors = validateUserRole(role);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (usernameErrors.length > 0) {
      throw new Error(`Bootstrap admin username is invalid: ${usernameErrors.join(' ')}`);
    }
    if (roleErrors.length > 0) {
      throw new Error(`Bootstrap admin role is invalid: ${roleErrors.join(' ')}`);
    }

    const existingUser = await findUserByUsername(client, normalizedUsername);

    if (existingUser && !force) {
      await client.query('COMMIT');
      console.log(`[auth] Admin bootstrap skipped. User "${normalizedUsername}" already exists.`);
      return;
    }

    const passwordErrors = validatePasswordStrength(password, normalizedUsername);
    if (passwordErrors.length > 0) {
      throw new Error(`Bootstrap admin password is too weak: ${passwordErrors.join(' ')}`);
    }
    const passwordHash = await hashPassword(password);
    const user = await upsertUser(client, {
      id: existingUser?.id || crypto.randomUUID(),
      username: normalizedUsername,
      password_hash: passwordHash,
      role: normalizeUserRole(role, 'SYS_ADMIN'),
      is_active: true,
      is_first_login: false,
    });

    await client.query('COMMIT');
    console.log('[auth] Admin bootstrap complete.');
    console.log(JSON.stringify(user, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[auth] Admin bootstrap failed: ${message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[auth] Admin bootstrap failed: ${message}`);
  process.exitCode = 1;
});
