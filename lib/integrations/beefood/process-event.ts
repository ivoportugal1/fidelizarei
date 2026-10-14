import { query, transaction } from "@/lib/database";
import { makePointCode } from "@/lib/qr-batches";
import { hashCode } from "@/lib/redemption";
import { makeOrderFetcher } from "./client";
import { safeEqual } from "./crypto";
import { evaluateOrder, isPaymentEvent, parseWebhookEvent } from "./rules";
import type { OrderFetcher } from "./types";

type IntegrationRow = {
  id: string; organization_id: string; program_id: string; webhook_secret: string;
  client_id: string | null; client_secret_enc: string | null; min_amount: string; qr_ttl_seconds: number;
};

export type WebhookResult = { status: number; body: Record<string, unknown> };

export async function processBeefoodWebhook(
  token: string,
  secretHeader: string | null,
  rawBody: unknown,
  fetchOrderOverride?: OrderFetcher,
): Promise<WebhookResult> {
  const found = await query<IntegrationRow>(`
    select id, organization_id, program_id, webhook_secret, client_id, client_secret_enc, min_amount, qr_ttl_seconds
    from beefood_integrations where webhook_token = $1 and enabled = true limit 1`, [token]);
  const integration = found.rows[0];
  if (!integration) return { status: 404, body: { ok: false, error: "integration_not_found" } };
  if (!secretHeader || !safeEqual(secretHeader, integration.webhook_secret)) {
    return { status: 401, body: { ok: false, error: "invalid_secret" } };
  }

  const event = parseWebhookEvent(rawBody);
  if (!event) return { status: 400, body: { ok: false, error: "invalid_payload" } };
  if (!isPaymentEvent(event)) return { status: 200, body: { ok: true, ignored: "event_type" } };

  const already = await query("select 1 from beefood_orders where integration_id = $1 and order_id = $2", [integration.id, event.orderId]);
  if (already.rowCount) return { status: 200, body: { ok: true, ignored: "duplicate" } };

  const order = await (fetchOrderOverride ?? makeOrderFetcher(integration))(event.orderId);
  const decision = evaluateOrder(order, Number(integration.min_amount));
  if (!decision.eligible) return { status: 200, body: { ok: true, ignored: decision.reason } };

  const created = await issuePointQr(integration, event.orderId, decision.amount);
  return { status: 200, body: { ok: true, created } };
}

type QrIssuer = { id: string; organization_id: string; program_id: string; qr_ttl_seconds: number };

// Creates the one-point QR for an order (once per order) and retires the previous
// QR of the same counter. Returns false when the order already produced one.
export async function issuePointQr(integration: QrIssuer, orderId: string, amount: number) {
  return transaction(async (client) => {
    const claimed = await client.query<{ id: string }>(`
      insert into beefood_orders (integration_id, order_id, order_amount)
      values ($1, $2, $3) on conflict (integration_id, order_id) do nothing returning id`,
      [integration.id, orderId, amount]);
    if (!claimed.rows[0]) return false;
    // A new sale replaces the previous QR on the counter tablet.
    await client.query(`
      update redemption_codes set status = 'voided'
      where status = 'active' and id in (
        select redemption_code_id from beefood_orders
        where integration_id = $1 and redemption_code_id is not null)`, [integration.id]);
    const code = makePointCode();
    const inserted = await client.query<{ id: string }>(`
      insert into redemption_codes (organization_id, program_id, code_value, code_hash, points, expires_at)
      values ($1, $2, $3, $4, 1, now() + ($5::int * interval '1 second')) returning id`,
      [integration.organization_id, integration.program_id, code, hashCode(code), integration.qr_ttl_seconds]);
    await client.query("update beefood_orders set redemption_code_id = $1 where id = $2", [inserted.rows[0].id, claimed.rows[0].id]);
    return true;
  });
}
