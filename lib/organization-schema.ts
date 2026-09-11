import { query } from "./database";

let organizationSchemaReady = false;

export async function ensureOrganizationSchema() {
  if (organizationSchemaReady) return;
  await query(`
    alter table organizations
      add column if not exists salesperson_name text;
  `);
  organizationSchemaReady = true;
}
