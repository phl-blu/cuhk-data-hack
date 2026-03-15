import pg from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import dns from 'dns';

// Force IPv4 DNS resolution — Railway does not support IPv6
dns.setDefaultResultOrder('ipv4first');

// Load .env from repo root — safe to call multiple times (dotenv is idempotent)
const __filename = fileURLToPath(import.meta.url);
const __rootDir = path.resolve(path.dirname(__filename), '../../../');
dotenv.config({ path: path.join(__rootDir, '.env') });

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    const dbUrl = process.env['DATABASE_URL'] ?? '';
    _pool = new pg.Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 5, // Supabase free tier has low connection limits
      ssl: dbUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    });

    _pool.on('error', (err) => {
      console.error('[db] Pool error (idle client):', err.message);
    });
  }
  return _pool;
}

// Proxy so existing code using `pool.query(...)` and `pool.connect()` works unchanged
const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getPool() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export default pool;
