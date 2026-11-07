import { Pool } from 'pg';
import { poolConfig } from './db';

const TABLES = [
  'foods',
  'food_barcodes',
  'food_servings',
  'food_nutrients',
  'food_names',
  'food_sources',
] as const;

/**
 * For the database tests: copies of the food tables (columns, defaults,
 * indexes and the foreign keys between them) in a schema of their own, and
 * a pool whose connections use it. Real imported rows in `public` are never
 * read or written, whatever ids or barcodes a test uses. Needs DATABASE_URL
 * (or DIRECT_URL) with the backend's migrations applied.
 */
export async function testSchema(name: string) {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Set DATABASE_URL to a database with the migrations applied',
    );
  }
  const schema = `food_data_test_${name}_${process.pid}`;
  const admin = new Pool({ ...poolConfig(url), max: 1 });
  try {
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    for (const t of TABLES) {
      await admin.query(
        `CREATE TABLE ${schema}.${t} (LIKE public.${t} INCLUDING ALL)`,
      );
    }
    for (const t of TABLES.slice(1)) {
      await admin.query(
        `ALTER TABLE ${schema}.${t} ADD FOREIGN KEY ("foodId")
         REFERENCES ${schema}.foods (id) ON DELETE CASCADE`,
      );
    }
  } finally {
    await admin.end();
  }
  const pool = new Pool({
    ...poolConfig(url),
    options: `-c search_path=${schema},public`,
  });
  return {
    schema,
    pool,
    async drop() {
      await pool.end();
      const cleanup = new Pool({ ...poolConfig(url), max: 1 });
      try {
        await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await cleanup.end();
      }
    },
  };
}
