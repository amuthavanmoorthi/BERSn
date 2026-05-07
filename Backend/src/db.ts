import pg from 'pg';

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '5432',
  DB_NAME = 'bersn_auth',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
  DB_POOL_MAX = '20',
  DB_IDLE_TIMEOUT_MS = '30000',
  DB_CONNECTION_TIMEOUT_MS = '5000',
  DB_STATEMENT_TIMEOUT_MS = '15000',
  DB_QUERY_TIMEOUT_MS = '20000',
} = process.env;

const pool = new pg.Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  max: Number(DB_POOL_MAX),
  idleTimeoutMillis: Number(DB_IDLE_TIMEOUT_MS),
  connectionTimeoutMillis: Number(DB_CONNECTION_TIMEOUT_MS),
  statement_timeout: Number(DB_STATEMENT_TIMEOUT_MS),
  query_timeout: Number(DB_QUERY_TIMEOUT_MS),
});

export default pool;
