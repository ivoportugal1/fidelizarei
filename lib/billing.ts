import { timingSafeEqual, createHmac } from "node:crypto";
import { query } from "./database";
import { publicAppUrl } from "./public-url";

export type BillingStatus = "trialing" | "pending" | "active" | "past_due" | "canceled" | "expired";
export type BillingInterval = "monthly" | "yearly";

export type BillingState = {
  organizationId: string;
  organizationName: string;
  status: BillingStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  checkoutUrl: string | null;
  billingInterval: BillingInterval;
  accessAllowed: boolean;
  message: string;
};

export const billingPlans: Record<BillingInterval, { label: string; amount: number }> = {
  monthly: { label: "Mensal", amount: 60 },
  yearly: { label: "Anual", amount: 600 },
};

type BillingRow = {
  organization_id: string;
  organization_name: string;
  tax_id: string | null;
  owner_email: string | null;
  subscription_status: BillingStatus | null;
  trial_ends_at: Date | null;
  subscription_current_period_end: Date | null;
  mercado_pago_checkout_url: string | null;
  subscription_billing_interval: BillingInterval | null;
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  client_reference_id?: string | null;
  customer?: string | null;
  customer_email?: string | null;
  mode?: string | null;
  payment_status?: string | null;
  subscription?: string | null | { id?: string | null };
  metadata?: Record<string, string> | null;
};

type StripeSubscription = {
  id: string;
  status?: string | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  metadata?: Record<string, string> | null;
};

type StripeInvoice = {
  id: string;
  subscription?: string | null | { id?: string | null; metadata?: Record<string, string> | null };
  subscription_details?: { metadata?: Record<string, string> | null } | null;
  lines?: { data?: Array<{ period?: { end?: number | null } | null }> } | null;
  status?: string | null;
};

type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: unknown };
};

function appUrl(origin?: string) {
  return publicAppUrl(origin);
}

function normalizeCoupon(code?: string) {
  return (code || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isTrialCouponValid(code?: string) {
  const configured = normalizeCoupon(process.env.FIDELIZAREI_TRIAL_COUPON_CODE || "30DIASGRATIS");
  return !!configured && normalizeCoupon(code) === configured;
}

function isAllowed(status: BillingStatus, trialEndsAt: Date | null, currentPeriodEnd: Date | null) {
  const now = Date.now();
  if (status === "active") return !currentPeriodEnd || currentPeriodEnd.getTime() > now;
  if (status === "trialing") return !!trialEndsAt && trialEndsAt.getTime() > now;
  return false;
}

function billingMessage(status: BillingStatus, trialEndsAt: Date | null, currentPeriodEnd: Date | null) {
  if (status === "trialing" && trialEndsAt) return `Teste grátis ativo até ${trialEndsAt.toLocaleDateString("pt-BR")}.`;
  if (status === "active" && currentPeriodEnd) return `Plano ativo até ${currentPeriodEnd.toLocaleDateString("pt-BR")}.`;
  if (status === "active") return "Plano ativo.";
  if (status === "pending") return "Pagamento em análise ou aguardando confirmação.";
  if (status === "past_due") return "Pagamento atrasado. Regularize para liberar o painel.";
  if (status === "canceled") return "Assinatura cancelada. Reative para liberar o painel.";
  return "Assine um plano ou aplique um cupom válido para liberar o painel.";
}

async function getBillingRowForUser(userId: string) {
  const result = await query<BillingRow>(`
    select o.id as organization_id, o.name as organization_name, o.subscription_status,
           o.tax_id,
           owner.email as owner_email,
           o.trial_ends_at, o.subscription_current_period_end, o.mercado_pago_checkout_url,
           o.subscription_billing_interval
    from organization_members m
    join organizations o on o.id = m.organization_id
    left join lateral (
      select u.email
      from organization_members om
      join app_users u on u.id = om.user_id
      where om.organization_id = o.id
      order by case when om.role = 'owner' then 0 else 1 end, u.created_at asc
      limit 1
    ) owner on true
    where m.user_id = $1
    order by o.created_at asc
    limit 1`, [userId]);
  return result.rows[0] ?? null;
}

export async function getBillingStateForUser(userId: string): Promise<BillingState> {
  const row = await getBillingRowForUser(userId);
  if (!row) throw new Error("organization_not_found");

  let status: BillingStatus = row.subscription_status || "trialing";
  if (status === "trialing" && row.trial_ends_at && row.trial_ends_at.getTime() <= Date.now()) {
    status = "expired";
    await query("update organizations set subscription_status = 'expired', access_blocked_at = coalesce(access_blocked_at, now()) where id = $1 and subscription_status = 'trialing'", [row.organization_id]);
  }

  return {
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    status,
    trialEndsAt: row.trial_ends_at?.toISOString() ?? null,
    currentPeriodEnd: row.subscription_current_period_end?.toISOString() ?? null,
    checkoutUrl: row.mercado_pago_checkout_url,
    billingInterval: row.subscription_billing_interval || "monthly",
    accessAllowed: isAllowed(status, row.trial_ends_at, row.subscription_current_period_end),
    message: billingMessage(status, row.trial_ends_at, row.subscription_current_period_end),
  };
}

function stripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return key;
}

function stripePriceId(interval: BillingInterval) {
  const envName = interval === "yearly" ? "STRIPE_PRICE_YEARLY" : "STRIPE_PRICE_MONTHLY";
  const price = process.env[envName];
  if (!price) throw new Error(`${envName} is not configured.`);
  return price;
}

function stripeSubscriptionId(value: StripeCheckoutSession["subscription"] | StripeInvoice["subscription"]) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

async function stripePost<T>(path: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`stripe_request_failed:${response.status}:${body}`);
  return JSON.parse(body) as T;
}

export async function createStripeSubscriptionCheckout(userId: string, userEmail: string, origin: string, interval: BillingInterval) {
  const billing = await getBillingStateForUser(userId);
  const row = await getBillingRowForUser(userId);
  if (!row) throw new Error("organization_not_found");
  const baseUrl = appUrl(origin);
  const plan = billingPlans[interval];
  const params = new URLSearchParams();

  params.set("mode", "subscription");
  params.set("line_items[0][price]", stripePriceId(interval));
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", billing.organizationId);
  params.set("customer_email", row.owner_email || userEmail);
  params.set("success_url", `${baseUrl}/billing?return=stripe&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${baseUrl}/billing?canceled=1`);
  params.set("metadata[organizationId]", billing.organizationId);
  params.set("metadata[plan]", interval);
  params.set("subscription_data[metadata][organizationId]", billing.organizationId);
  params.set("subscription_data[metadata][plan]", interval);
  params.set("payment_method_types[0]", "card");
  params.set("payment_method_types[1]", "boleto");
  params.set("payment_method_options[boleto][expires_after_days]", "3");
  params.set("locale", "pt-BR");
  params.set("billing_address_collection", "auto");

  const session = await stripePost<StripeCheckoutSession>("/checkout/sessions", params);
  if (!session.url) throw new Error("stripe_checkout_url_missing");

  await query(`
    update organizations
    set mercado_pago_preapproval_id = $2,
        mercado_pago_checkout_url = $3,
        subscription_billing_interval = $4,
        subscription_status = case when subscription_status = 'trialing' and trial_ends_at > now() then subscription_status else 'pending' end,
        subscription_last_synced_at = now()
    where id = $1`, [billing.organizationId, session.id, session.url, interval]);

  return session.url;
}

export async function applyTrialCouponForUser(userId: string, interval: BillingInterval, couponCode?: string) {
  if (!isTrialCouponValid(couponCode)) return { ok: false, error: "invalid_coupon" as const };
  const row = await getBillingRowForUser(userId);
  if (!row) return { ok: false, error: "organization_not_found" as const };
  if (row.subscription_status === "active") return { ok: false, error: "already_active" as const };

  await query(`
    update organizations
    set subscription_status = 'trialing',
        trial_started_at = now(),
        trial_ends_at = now() + interval '30 days',
        subscription_billing_interval = $2,
        subscription_coupon_code = $3,
        access_blocked_at = null,
        subscription_last_synced_at = now()
    where id = $1`, [row.organization_id, interval, normalizeCoupon(couponCode)]);

  return { ok: true };
}

function dateFromUnix(value?: number | null) {
  if (!value) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function looksLikeUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapStripeSubscriptionStatus(status?: string | null): BillingStatus {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid" || status === "incomplete_expired") return "past_due";
  if (status === "canceled") return "canceled";
  return "pending";
}

async function updateOrganizationFromStripeSubscription(subscription: StripeSubscription) {
  const organizationId = subscription.metadata?.organizationId || null;
  if (!looksLikeUuid(organizationId)) return null;
  const status = mapStripeSubscriptionStatus(subscription.status);
  const currentPeriodEnd = dateFromUnix(subscription.current_period_end);
  await query(`
    update organizations
    set subscription_status = $2,
        mercado_pago_preapproval_id = $3,
        subscription_current_period_end = coalesce($4, subscription_current_period_end),
        access_blocked_at = case when $2 in ('active', 'trialing') then null else coalesce(access_blocked_at, now()) end,
        subscription_last_synced_at = now()
    where id = $1`, [organizationId, status, subscription.id, currentPeriodEnd]);
  return organizationId;
}

async function updateOrganizationFromCheckoutSession(session: StripeCheckoutSession) {
  const organizationId = session.client_reference_id || session.metadata?.organizationId || null;
  if (!looksLikeUuid(organizationId)) return null;
  const subscriptionId = stripeSubscriptionId(session.subscription);
  const status: BillingStatus = session.payment_status === "paid" ? "active" : "pending";
  await query(`
    update organizations
    set subscription_status = $2,
        mercado_pago_preapproval_id = coalesce($3, mercado_pago_preapproval_id),
        subscription_last_payment_id = $4,
        access_blocked_at = case when $2 = 'active' then null else access_blocked_at end,
        subscription_last_synced_at = now()
    where id = $1`, [organizationId, status, subscriptionId, session.id]);
  return organizationId;
}

async function updateOrganizationFromInvoice(invoice: StripeInvoice) {
  const organizationId = invoice.subscription_details?.metadata?.organizationId
    || (typeof invoice.subscription === "object" ? invoice.subscription?.metadata?.organizationId : null)
    || null;
  const subscriptionId = stripeSubscriptionId(invoice.subscription);
  if (!looksLikeUuid(organizationId) && !subscriptionId) return null;
  const periodEnd = dateFromUnix(invoice.lines?.data?.[0]?.period?.end || null);
  const result = await query<{ id: string }>(`
    update organizations
    set subscription_status = 'active',
        mercado_pago_preapproval_id = coalesce($2, mercado_pago_preapproval_id),
        subscription_last_payment_id = $3,
        subscription_current_period_end = coalesce($4, subscription_current_period_end),
        access_blocked_at = null,
        subscription_last_synced_at = now()
    where ($1::uuid is not null and id = $1::uuid)
       or ($2::text is not null and mercado_pago_preapproval_id = $2::text)
    returning id`, [looksLikeUuid(organizationId) ? organizationId : null, subscriptionId, invoice.id, periodEnd]);
  return result.rows[0]?.id || organizationId || null;
}

function verifyStripeSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  if (!signatureHeader) throw new Error("missing_stripe_signature");

  const parts = signatureHeader.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=", 2);
    if (!key || !value) return acc;
    acc[key] = acc[key] || [];
    acc[key].push(value);
    return acc;
  }, {});
  const timestamp = parts.t?.[0];
  const signatures = parts.v1 || [];
  if (!timestamp || !signatures.length) throw new Error("invalid_stripe_signature");
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) throw new Error("stale_stripe_signature");

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const valid = signatures.some((signature) => {
    const received = Buffer.from(signature, "hex");
    return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
  });
  if (!valid) throw new Error("invalid_stripe_signature");
}

export async function processStripeWebhook(request: Request) {
  const rawBody = await request.text();
  verifyStripeSignature(rawBody, request.headers.get("stripe-signature"));
  const payload = JSON.parse(rawBody) as StripeEvent;
  const object = payload.data?.object;
  const providerResourceId = object && typeof object === "object" && "id" in object ? String((object as { id?: unknown }).id || "") : payload.id;

  const event = await query<{ id: string }>(`
    insert into billing_events (provider, provider_event_id, provider_resource_id, event_type, action, payload)
    values ('stripe', $1, $2, $3, $4, $5)
    on conflict (provider, provider_event_id) do update set payload = excluded.payload
    returning id`, [payload.id, providerResourceId, payload.type, null, JSON.stringify(payload)]);

  let organizationId: string | null = null;
  if (payload.type === "checkout.session.completed") {
    organizationId = await updateOrganizationFromCheckoutSession(object as StripeCheckoutSession);
  } else if (payload.type === "customer.subscription.updated" || payload.type === "customer.subscription.deleted") {
    organizationId = await updateOrganizationFromStripeSubscription(object as StripeSubscription);
  } else if (payload.type === "invoice.payment_succeeded") {
    organizationId = await updateOrganizationFromInvoice(object as StripeInvoice);
  }

  await query("update billing_events set organization_id = $2, processed_at = now() where id = $1", [event.rows[0].id, organizationId]);
  return { organizationId };
}
