import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const migrationsDir = resolve("database", "migrations");
const migrationFiles = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  for (const file of migrationFiles) {
    const sql = await readFile(resolve(migrationsDir, file), "utf8");
    try {
      await client.query(sql);
      console.log(`Applied ${file}`);
    } catch (error) {
      if (file === "001_initial_schema.sql" && error?.code === "42P07") {
        console.log(`Skipped ${file}; initial schema already exists.`);
        continue;
      }
      throw error;
    }
  }
  console.log("Database migrations completed.");
} finally {
  await client.end();
}
