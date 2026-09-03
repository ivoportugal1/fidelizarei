import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const migrationPath = resolve("database", "migrations", "001_initial_schema.sql");
const sql = await readFile(migrationPath, "utf8");

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log("Database migration completed.");
} finally {
  await client.end();
}
