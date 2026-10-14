import { decryptSecret } from "./crypto";
import type { BeefoodOrder, OrderFetcher } from "./types";

const baseUrl = () => (process.env.BEEFOOD_API_BASE_URL || "https://api.beefood.app").replace(/\/$/, "");

type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

async function getAccessToken(integrationId: string, clientId: string, clientSecret: string) {
  const cached = tokenCache.get(integrationId);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const response = await fetch(`${baseUrl()}/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!response.ok) throw new Error(`beefood_auth_failed_${response.status}`);
  const body = await response.json() as { accessToken?: string; expiresIn?: number };
  if (!body.accessToken) throw new Error("beefood_auth_failed_no_token");
  tokenCache.set(integrationId, { token: body.accessToken, expiresAt: Date.now() + (body.expiresIn ?? 300) * 1000 });
  return body.accessToken;
}

type Credentials = { id: string; client_id: string | null; client_secret_enc: string | null };

export function makeOrderFetcher(integration: Credentials): OrderFetcher {
  return async (orderId) => {
    if (!integration.client_id || !integration.client_secret_enc) throw new Error("beefood_credentials_missing");
    const token = await getAccessToken(integration.id, integration.client_id, decryptSecret(integration.client_secret_enc));
    const response = await fetch(`${baseUrl()}/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401) tokenCache.delete(integration.id);
    if (!response.ok) throw new Error(`beefood_order_failed_${response.status}`);
    return await response.json() as BeefoodOrder;
  };
}

export async function testConnection(integration: Credentials) {
  if (!integration.client_id || !integration.client_secret_enc) return false;
  tokenCache.delete(integration.id);
  await getAccessToken(integration.id, integration.client_id, decryptSecret(integration.client_secret_enc));
  return true;
}
