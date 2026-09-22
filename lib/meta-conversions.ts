import { query } from "./database";
import { buildMetaPurchaseEvent, isFirstPaidSubscriptionInvoice, type FirstPurchaseInvoice } from "./meta-purchase-payload";
import { publicAppUrl } from "./public-url";

type MetaPurchaseRow = {
  id: string;
  stripe_invoice_id: string;
  status: "pending" | "processing" | "sent" | "failed";
};

type OrganizationTrackingRow = {
  email: string | null;
  meta_purchase_tracking_consent_at: Date | null;
};

type MetaResponse = {
  events_received?: number;
  fbtrace_id?: string;
  messages?: unknown[];
  error?: { message?: string; code?: number };
};

let metaSchemaReady = false;

export async function ensureMetaTrackingSchema() {
  if (metaSchemaReady) return;
  await query(`
    alter table organizations add column if not exists meta_purchase_tracking_consent_at timestamptz;

    create table if not exists meta_purchase_events (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references organizations(id) on delete cascade,
      stripe_invoice_id text not null,
      event_id text not null,
      amount_paid_minor bigint not null,
      currency text not null,
      event_time timestamptz not null,
      status text not null default 'pending',
      attempts integer not null default 0,
      last_attempted_at timestamptz,
      sent_at timestamptz,
      meta_trace_id text,
      last_error text,
      created_at timestamptz not null default now(),
      unique (organization_id),
      unique (stripe_invoice_id),
      unique (event_id)
    );

    create index if not exists meta_purchase_events_status_idx on meta_purchase_events (status, last_attempted_at);
  `);
  metaSchemaReady = true;
}

function metaConfig() {
  if (process.env.META_PURCHASE_TRACKING_ENABLED !== "true") return null;
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim();
  if (!pixelId || !/^\d+$/.test(pixelId)) throw new Error("META_PIXEL_ID is not configured.");
  if (!accessToken) throw new Error("META_CONVERSIONS_API_ACCESS_TOKEN is not configured.");
  return {
    pixelId,
    accessToken,
    testEventCode: process.env.META_TEST_EVENT_CODE?.trim() || null,
  };
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "meta_purchase_failed";
  return message.replace(/EA[A-Za-z0-9_-]{20,}/g, "[redacted]").slice(0, 500);
}

async function organizationTrackingData(organizationId: string) {
  const result = await query<OrganizationTrackingRow>(`
    select owner.email, o.meta_purchase_tracking_consent_at
    from organizations o
    left join lateral (
      select u.email
      from organization_members om
      join app_users u on u.id = om.user_id
      where om.organization_id = o.id
      order by case when om.role = 'owner' then 0 else 1 end, u.created_at asc
      limit 1
    ) owner on true
    where o.id = $1
    limit 1`, [organizationId]);
  return result.rows[0] || null;
}

async function sendToMeta(pixelId: string, accessToken: string, event: ReturnType<typeof buildMetaPurchaseEvent>, testEventCode: string | null) {
  const params = new URLSearchParams();
  params.set("data", JSON.stringify([event]));
  params.set("access_token", accessToken);
  if (testEventCode) params.set("test_event_code", testEventCode);
  const response = await fetch(`https://graph.facebook.com/v26.0/${pixelId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const body = await response.json() as MetaResponse;
  if (!response.ok || body.error || body.events_received !== 1) {
    throw new Error(`meta_api_failed:${response.status}:${body.error?.code || "unknown"}:${body.error?.message || "event_not_received"}`);
  }
  return body;
}

export async function trackFirstSubscriptionPurchase(input: {
  invoice: FirstPurchaseInvoice;
  organizationId: string | null;
  stripeEventCreated: number;
}) {
  if (!input.organizationId || !isFirstPaidSubscriptionInvoice(input.invoice)) {
    return { sent: false, reason: "not_first_paid_invoice" as const };
  }
  const config = metaConfig();
  if (!config) return { sent: false, reason: "tracking_disabled" as const };
  if (input.invoice.livemode === false && !config.testEventCode) {
    return { sent: false, reason: "test_invoice_without_meta_test_code" as const };
  }

  await ensureMetaTrackingSchema();
  const tracking = await organizationTrackingData(input.organizationId);
  if (!tracking?.meta_purchase_tracking_consent_at) return { sent: false, reason: "no_consent" as const };
  if (!tracking.email) return { sent: false, reason: "missing_email" as const };

  const event = buildMetaPurchaseEvent({
    invoice: input.invoice,
    organizationId: input.organizationId,
    email: tracking.email,
    eventSourceUrl: `${publicAppUrl()}/billing`,
    fallbackEventTime: input.stripeEventCreated,
  });

  await query(`
    insert into meta_purchase_events (
      organization_id, stripe_invoice_id, event_id, amount_paid_minor, currency, event_time
    ) values ($1, $2, $3, $4, $5, to_timestamp($6))
    on conflict do nothing`, [
      input.organizationId,
      input.invoice.id,
      event.event_id,
      input.invoice.amount_paid,
      event.custom_data.currency,
      event.event_time,
    ]);

  const existing = await query<MetaPurchaseRow>(`
    select id, stripe_invoice_id, status
    from meta_purchase_events
    where organization_id = $1
    limit 1`, [input.organizationId]);
  const row = existing.rows[0];
  if (!row || row.stripe_invoice_id !== input.invoice.id) return { sent: false, reason: "first_purchase_already_recorded" as const };
  if (row.status === "sent") return { sent: false, reason: "already_sent" as const };

  const claimed = await query<MetaPurchaseRow>(`
    update meta_purchase_events
    set status = 'processing', attempts = attempts + 1, last_attempted_at = now(), last_error = null
    where id = $1
      and (
        status in ('pending', 'failed')
        or (status = 'processing' and last_attempted_at < now() - interval '5 minutes')
      )
    returning id, stripe_invoice_id, status`, [row.id]);
  if (!claimed.rows[0]) return { sent: false, reason: "already_processing" as const };

  try {
    const response = await sendToMeta(config.pixelId, config.accessToken, event, config.testEventCode);
    await query(`
      update meta_purchase_events
      set status = 'sent', sent_at = now(), meta_trace_id = $2, last_error = null
      where id = $1`, [row.id, response.fbtrace_id || null]);
    return { sent: true, eventId: event.event_id };
  } catch (error) {
    await query(`
      update meta_purchase_events
      set status = 'failed', last_error = $2
      where id = $1`, [row.id, safeError(error)]);
    throw error;
  }
}
