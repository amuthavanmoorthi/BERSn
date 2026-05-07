import crypto from 'crypto';

import pool from '../db.js';
import { upsertUser } from '../models/authModel.js';
import { hashPassword } from '../services/authCrypto.js';
import { validatePasswordStrength } from '../services/passwordPolicy.js';
import { normalizeUserRole, validateUserRole, validateUsername } from '../services/userPolicy.js';

async function main(): Promise<void> {
  const [username, password, role = 'VENDOR_USER'] = process.argv.slice(2);
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');
  const normalizedRole = normalizeUserRole(String(role || 'VENDOR_USER').trim());

  if (!normalizedUsername || !normalizedPassword) {
    console.error('Usage: npm run auth:provision-user -- <username> <password> [role]');
    process.exitCode = 1;
    return;
  }

  const passwordErrors = validatePasswordStrength(normalizedPassword, normalizedUsername);
  const usernameErrors = validateUsername(normalizedUsername);
  const roleErrors = validateUserRole(normalizedRole);
  if (usernameErrors.length > 0) {
    console.error('Username does not meet the security policy:');
    for (const error of usernameErrors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }
  if (roleErrors.length > 0) {
    console.error('Role does not meet the security policy:');
    for (const error of roleErrors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }
  if (passwordErrors.length > 0) {
    console.error('Password does not meet the security policy:');
    for (const error of passwordErrors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(normalizedPassword);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const user = await upsertUser(client, {
      id: crypto.randomUUID(),
      username: normalizedUsername,
      password_hash: passwordHash,
      role: normalizedRole,
      is_active: true,
      is_first_login: false,
    });
    await client.query('COMMIT');

    console.log('Provisioned user successfully.');
    console.log(JSON.stringify(user, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to provision user: ${message}`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to provision user: ${message}`);
  process.exitCode = 1;
});
