// Creates (or updates) the BeeFood integration for one organization/program.
// Usage: node scripts/beefood-seed.mjs <organizationId> <programId> [minAmount] [clientId] [clientSecret]
// Needs DATABASE_URL and INTEGRATIONS_ENCRYPTION_KEY. Prints the URLs/secrets to configure.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import pg from "pg";

const [organizationId, programId, minAmount = "0", clientId = "sandbox-client", clientSecret = "sandbox-secret"] = process.argv.slice(2);
if (!organizationId || !programId) {
  console.error("Usage: node scripts/beefood-seed.mjs <organizationId> <programId> [minAmount] [clientId] [clientSecret]");
  process.exit(1);
}
if (!process.env.DATABASE_URL || !process.env.INTEGRATIONS_ENCRYPTION_KEY) {
  console.error("DATABASE_URL and INTEGRATIONS_ENCRYPTION_KEY are required.");
  process.exit(1);
}

function encrypt(plain) {
  const key = createHash("sha256").update(process.env.INTEGRATIONS_ENCRYPTION_KEY).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

const webhookToken = randomBytes(18).toString("base64url");
const counterToken = randomBytes(18).toString("base64url");
const webhookSecret = randomBytes(24).toString("base64url");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? undefined : { rejectUnauthorized: false },
});
await client.connect();
try {
  const result = await client.query(`
    insert into beefood_integrations (organization_id, program_id, enabled, client_id, client_secret_enc, webhook_token, counter_token, webhook_secret, min_amount)
    values ($1, $2, true, $3, $4, $5, $6, $7, $8)
    on conflict (organization_id, program_id) do update set
      enabled = true, client_id = excluded.client_id, client_secret_enc = excluded.client_secret_enc, min_amount = excluded.min_amount, updated_at = now()
    returning webhook_token, counter_token, webhook_secret`,
    [organizationId, programId, clientId, encrypt(clientSecret), webhookToken, counterToken, webhookSecret, minAmount]);
  const row = result.rows[0];
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log(`Webhook URL:    ${base}/api/integrations/beefood/webhook/${row.webhook_token}`);
  console.log(`Webhook secret: ${row.webhook_secret}`);
  console.log(`Counter screen: ${base}/balcao/${row.counter_token}`);
} finally {
  await client.end();
}
