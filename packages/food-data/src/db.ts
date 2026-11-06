import { Pool, type PoolConfig } from 'pg';

/**
 * A connection pool for the importers. Uses DIRECT_URL when set (Supabase's
 * direct or session connection), since long COPY batches don't suit the
 * transaction pooler, then DATABASE_URL.
 *
 * `sslmode` is read the way libpq and Prisma read it: `require` encrypts
 * without checking the certificate, `verify-full` checks it too.
 */
export function poolFromEnv(env: NodeJS.ProcessEnv = process.env): Pool {
  const raw = env.DIRECT_URL || env.DATABASE_URL;
  if (!raw) {
    throw new Error('Set DIRECT_URL or DATABASE_URL to the database to import into');
  }
  return new Pool(poolConfig(raw));
}

export function poolConfig(raw: string): PoolConfig {
  const url = new URL(raw);
  const sslmode = url.searchParams.get('sslmode');
  // Prisma-only and libpq-only parameters that pg doesn't understand
  for (const p of ['sslmode', 'pgbouncer', 'connection_limit', 'pool_timeout', 'schema']) {
    url.searchParams.delete(p);
  }
  const ssl =
    sslmode === 'verify-full' || sslmode === 'verify-ca'
      ? { rejectUnauthorized: true }
      : sslmode === 'require' || sslmode === 'prefer'
        ? { rejectUnauthorized: false }
        : undefined;
  return {
    connectionString: url.toString(),
    ssl,
    max: 2,
    // Large batches can take a while on a small database
    statement_timeout: 10 * 60_000,
  };
}
