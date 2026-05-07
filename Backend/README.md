# BERSn Backend Auth API

Secure authentication API for `FrontEnd/bern3`.

## Docker

Run the full auth stack from [docker-compose.yml](/Users/gaby/114-1/Internship/One%20Work/Project%20Bern/BERSn/Backend/docker-compose.yml):

```bash
docker compose up --build
```

That starts:

- PostgreSQL on `localhost:5433`
- Backend API on `http://localhost:4000`

The local stack bootstraps the first admin from environment variables on startup, so the user ID is generated as a real random UUID instead of keeping the old fixed seed ID.

## Endpoints

- `POST /api/auth/login`
- `POST /api/auth/webauthn/login/options`
- `POST /api/auth/webauthn/login/verify`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `POST /api/auth/admin/users`
- `POST /api/auth/webauthn/register/options`
- `POST /api/auth/webauthn/register/verify`
- `GET /api/auth/me`
- `GET /health`
- `GET /ready`

## Local Development

1. Configure PostgreSQL and Redis via environment variables.
2. Run migrations:

```bash
npm run db:migrate
```

3. Start the API:

```bash
npm run dev
```

There are no built-in default credentials anymore.

To bootstrap the first admin for local testing, set these environment variables before startup:

- `AUTH_BOOTSTRAP_ADMIN_USERNAME`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- Optional: `AUTH_BOOTSTRAP_ADMIN_ROLE`

Or provision one manually:

```bash
npm run auth:provision-user -- <username> <strong-password> admin
```

## Production

- The production image builds compiled output into `dist/` and runs Node directly.
- `AUTH_JWT_PRIVATE_KEY_PEM` and `AUTH_JWT_PUBLIC_KEY_PEM` are required when `NODE_ENV=production`.
- `AUTH_WEBAUTHN_RP_ID` and `AUTH_WEBAUTHN_ORIGINS` must match the frontend origin you actually serve in production.
- Bootstrap the first admin with:
- `AUTH_BOOTSTRAP_ADMIN_USERNAME`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- Optional: `AUTH_BOOTSTRAP_ADMIN_ROLE`

## Security Notes

- Passwords are stored with Argon2id.
- Refresh tokens are random, rotated, and stored hashed.
- Audit logs are append-only and tamper-evident in PostgreSQL via an immutable hash chain and DB triggers.
- Passkeys are verified with WebAuthn using `@simplewebauthn/server` and `@simplewebauthn/browser`.

## Postman

Base URL:

- `http://localhost:4000`

Required header for auth requests:

- `X-Device-Fingerprint: postman-local`

Recommended Postman setting:

- Enable cookie persistence so refresh/logout reuse the HttpOnly cookies set by login.

Example login body:

```json
{
  "username": "admin",
  "password": "<your-password>",
  "remember_me": false
}
```

Example change-password body:

```json
{
  "current_password": "OldPassword!123",
  "new_password": "NewStrongPassword!123"
}
```

Example admin-only user creation body:

```json
{
  "username": "reviewer.one",
  "password": "ProvisionedUser!123",
  "role": "reviewer"
}
```

Example passkey login options body:

```json
{
  "username": "reviewer.one"
}
```

Example passkey login verify body:

```json
{
  "username": "reviewer.one",
  "remember_me": false,
  "response": {
    "...": "WebAuthn browser response"
  }
}
```
