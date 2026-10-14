import { query } from "@/lib/database";
import { getBillingStateForUser } from "@/lib/billing";
import { getCurrentUser } from "@/lib/auth";

export type BeefoodSettingsRow = {
  id: string;
  organization_id: string;
  program_id: string;
  qr_ttl_seconds: number;
  enabled: boolean;
  client_id: string | null;
  client_secret_enc: string | null;
  webhook_token: string;
  webhook_secret: string;
  counter_token: string;
  min_amount: string;
};

// The integration only exists for organizations someone enabled it for, so a
// missing row (or a missing table) simply means "no BeeFood for this account".
export async function findBeefoodIntegration(organizationId: string): Promise<BeefoodSettingsRow | null> {
  try {
    const result = await query<BeefoodSettingsRow>(`
      select id, organization_id, program_id, qr_ttl_seconds, enabled, client_id, client_secret_enc, webhook_token, webhook_secret, counter_token, min_amount
      from beefood_integrations where organization_id = $1 order by created_at asc limit 1`, [organizationId]);
    return result.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function hasBeefoodIntegration(organizationId: string) {
  return Boolean(await findBeefoodIntegration(organizationId));
}

// Resolves the signed-in lojista's organization and integration, or null.
export async function getBeefoodContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  const billing = await getBillingStateForUser(user.id).catch(() => null);
  if (!billing || !billing.accessAllowed) return null;
  const integration = await findBeefoodIntegration(billing.organizationId);
  if (!integration) return null;
  return { user, organizationId: billing.organizationId, integration };
}
