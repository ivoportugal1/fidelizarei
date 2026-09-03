import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL || "admin@fidelizarei.com";
const adminPassword = process.env.ADMIN_PASSWORD;
const organizationName = process.env.ORGANIZATION_NAME || "Fidelizarei";
const programName = process.env.PROGRAM_NAME || "Programa Fidelizarei";
const rewardName = process.env.REWARD_NAME || "Recompensa";

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!adminPassword) {
  console.error("ADMIN_PASSWORD is required.");
  process.exit(1);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query("begin");
  const org = await client.query(
    `insert into organizations (name, slug, plan)
     values ($1, 'fidelizarei', 'starter')
     on conflict (slug) do update set name = excluded.name
     returning id`,
    [organizationName],
  );
  const user = await client.query(
    `insert into app_users (email, password_hash, full_name)
     values ($1, $2, 'Admin')
     on conflict (email) do update set password_hash = excluded.password_hash
     returning id`,
    [adminEmail, hashPassword(adminPassword)],
  );
  await client.query(
    `insert into organization_members (organization_id, user_id, role)
     values ($1, $2, 'owner')
     on conflict (organization_id, user_id) do nothing`,
    [org.rows[0].id, user.rows[0].id],
  );
  await client.query(
    `insert into loyalty_programs (organization_id, name, reward_name, points_to_reward, points_per_code)
     select $1, $2, $3, 7, 1
     where not exists (select 1 from loyalty_programs where organization_id = $1)`,
    [org.rows[0].id, programName, rewardName],
  );
  await client.query("commit");
  console.log(`Seed completed for ${adminEmail}.`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
