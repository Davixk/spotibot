import path from 'node:path';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;

export interface DbHandle {
  pool: Pool;
  db: Database;
}

export function createDb(databaseUrl: string): DbHandle {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

/**
 * Applies any pending migrations. The `drizzle` folder is resolved relative to
 * the process working directory, which is the server package root in dev and
 * the image WORKDIR (`/app`) in production.
 */
export async function runMigrations(db: Database): Promise<void> {
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  await migrate(db, { migrationsFolder });
}
