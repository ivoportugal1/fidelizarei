import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var fidelizaPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return new Pool({
    connectionString,
    max: 1,
    // Render requires TLS for external connections. Local PostgreSQL keeps its normal settings.
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
}

export function db() {
  global.fidelizaPool ??= createPool();
  return global.fidelizaPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return db().query<T>(text, values);
}

export async function transaction<T>(operation: (client: PoolClient) => Promise<T>) {
  const client = await db().connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
