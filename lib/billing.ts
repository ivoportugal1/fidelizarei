import { createHmac, timingSafeEqual } from "node:crypto";
import { query } from "./database";

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

export const billingPlans: Record<BillingInterval, { label: string; amount: number; frequency: number; frequencyType: "months" }> = {
  monthly: { label: "Mensal", amount: 60, frequency: 1, frequencyType: "months" },
  yearly: { label: "Anual", amount: 600, frequency: 12, frequencyType: "months" },
};

type BillingRow = {
  organization_id: string;
  organization_name: string;
  subscription_status: BillingStatus | null;
  trial_ends_at: Date | null;
  subscription_current_period_end: Date | null;
  mercado_pago_checkout_url: string | null;
  subscription_billing_interval: BillingInterval | null;
};

type MercadoPagoPreapproval = {
  id: string;
  status?: string;
  external_reference?: string | number;
  init_point?: string;
  sandbox_init_point?: string;
  next_payment_date?: string;
};

type MercadoPagoPayment = {
  id: string | number;
  status?: string;
  external_reference?: string | number;
  preapproval_id?: string;
  subscription_id?: string;
};

type MercadoPagoAuthorizedPayment = {
  id: string | number;
  status?: string;
  preapproval_id?: string;
  payment?: { id?: string | number; status?: string };
};

function appUrl(origin?: string) {
  return process.env.NEXT_PUBLIC_APP_URL || origin || "http://localhost:3000";
}

function mercadoPagoToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN is not configured.");
  return token;
}

function planAmount(interval: BillingInterval) {
  const envName = interval === "yearly" ? "MERCADOPAGO_PLAN_YEARLY_AMOUNT" : "MERCADOPAGO_PLAN_MONTHLY_AMOUNT";
  const amount = Number(process.env[envName] || billingPlans[interval].amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${envName} must be a positive number.`);
  return amount;
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
           o.trial_ends_at, o.subscription_current_period_end, o.mercado_pago_checkout_url,
           o.subscription_billing_interval
    from organization_members m
    join organizations o on o.id = m.organization_id
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

async function mercadoPagoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mercadoPagoToken()}`,
      ...(init?.headers || {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`mercadopago_request_failed:${response.status}:${body}`);
  return JSON.parse(body) as T;
}

export async function createMercadoPagoSubscriptionCheckout(userId: string, userEmail: string, origin: string, interval: BillingInterval) {
  const billing = await getBillingStateForUser(userId);
  const baseUrl = appUrl(origin);
  const plan = billingPlans[interval];

  const payload: Record<string, unknown> = {
    reason: `Fidelizarei - Plano ${plan.label}`,
    external_reference: billing.organizationId,
    payer_email: userEmail,
    back_url: `${baseUrl}/billing?return=mercadopago`,
    notification_url: `${baseUrl}/api/billing/webhook/mercadopago`,
    auto_recurring: {
      frequency: plan.frequency,
      frequency_type: plan.frequencyType,
      transaction_amount: planAmount(interval),
      currency_id: "BRL",
    },
  };

  const preapproval = await mercadoPagoRequest<MercadoPagoPreapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const checkoutUrl = preapproval.init_point || preapproval.sandbox_init_point || null;
  await query(`
    update organizations
    set mercado_pago_preapproval_id = $2,
        mercado_pago_checkout_url = $3,
        subscription_billing_interval = $4,
        subscription_status = case when subscription_status = 'trialing' and trial_ends_at > now() then subscription_status else 'pending' end,
        subscription_last_synced_at = now()
    where id = $1`, [billing.organizationId, preapproval.id, checkoutUrl, interval]);

  if (!checkoutUrl) throw new Error("mercadopago_checkout_url_missing");
  return checkoutUrl;
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

function mapPreapprovalStatus(status?: string): BillingStatus {
  if (status === "authorized") return "active";
  if (status === "pending") return "pending";
  if (status === "paused") return "past_due";
  if (status === "cancelled" || status === "canceled") return "canceled";
  return "pending";
}

function mapPaymentStatus(status?: string): BillingStatus | null {
  if (status === "approved" || status === "authorized") return "active";
  if (status === "pending" || status === "in_process") return "pending";
  if (status === "rejected" || status === "cancelled" || status === "refunded" || status === "charged_back") return "past_due";
  return null;
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function looksLikeUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function applyPreapproval(preapproval: MercadoPagoPreapproval) {
  const organizationId = String(preapproval.external_reference || "");
  if (!looksLikeUuid(organizationId)) return null;
  const status = mapPreapprovalStatus(preapproval.status);
  const nextPaymentDate = parseDate(preapproval.next_payment_date);
  await query(`
    update organizations
    set subscription_status = $2,
        mercado_pago_preapproval_id = $3,
        mercado_pago_checkout_url = coalesce($4, mercado_pago_checkout_url),
        subscription_current_period_end = coalesce($5, subscription_current_period_end),
        access_blocked_at = case when $2 in ('active', 'trialing') then null else coalesce(access_blocked_at, now()) end,
        subscription_last_synced_at = now()
    where id = $1`, [organizationId, status, preapproval.id, preapproval.init_point || preapproval.sandbox_init_point || null, nextPaymentDate]);
  return organizationId;
}

async function applyPayment(payment: MercadoPagoPayment) {
  let organizationId = String(payment.external_reference || "");
  if (!looksLikeUuid(organizationId) && (payment.preapproval_id || payment.subscription_id)) {
    const preapproval = await mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${payment.preapproval_id || payment.subscription_id}`);
    organizationId = String(preapproval.external_reference || "");
  }
  if (!looksLikeUuid(organizationId)) return null;
  const status = mapPaymentStatus(payment.status);
  if (!status) return organizationId;
  await query(`
    update organizations
    set subscription_status = $2,
        subscription_last_payment_id = $3,
        subscription_current_period_end = case
          when $2 = 'active' and subscription_billing_interval = 'yearly' then now() + interval '1 year'
          when $2 = 'active' then now() + interval '1 month'
          else subscription_current_period_end
        end,
        access_blocked_at = case when $2 = 'active' then null else coalesce(access_blocked_at, now()) end,
        subscription_last_synced_at = now()
    where id = $1`, [organizationId, status, String(payment.id)]);
  return organizationId;
}

export function validateMercadoPagoWebhookSignature(request: Request, dataId: string) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(signature.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key?.trim(), value?.trim()];
  }));
  if (!parts.ts || !parts.v1) return false;
  const normalizedDataId = /[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${normalizedDataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

export async function processMercadoPagoWebhook(request: Request, payload: { id?: string | number; type?: string; action?: string; data?: { id?: string | number } }, url: URL) {
  const resourceId = String(url.searchParams.get("data.id") || payload.data?.id || "");
  const type = url.searchParams.get("type") || payload.type || "";
  if (!resourceId) return { organizationId: null };
  if (!validateMercadoPagoWebhookSignature(request, resourceId)) throw new Error("invalid_webhook_signature");

  const event = await query<{ id: string }>(`
    insert into billing_events (provider_event_id, provider_resource_id, event_type, action, payload)
    values ($1, $2, $3, $4, $5)
    on conflict (provider, provider_event_id) do update set payload = excluded.payload
    returning id`, [payload.id ? String(payload.id) : `${type}:${resourceId}`, resourceId, type, payload.action || null, JSON.stringify(payload)]);

  let organizationId: string | null = null;
  if (type === "subscription_preapproval" || type === "preapproval") {
    organizationId = await applyPreapproval(await mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${resourceId}`));
  } else if (type === "payment") {
    organizationId = await applyPayment(await mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${resourceId}`));
  } else if (type === "subscription_authorized_payment") {
    const authorized = await mercadoPagoRequest<MercadoPagoAuthorizedPayment>(`/authorized_payments/${resourceId}`);
    if (authorized.preapproval_id) {
      organizationId = await applyPreapproval(await mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${authorized.preapproval_id}`));
    }
    if (authorized.payment?.id) {
      organizationId = await applyPayment({ id: authorized.payment.id, status: authorized.payment.status, preapproval_id: authorized.preapproval_id });
    }
  }

  await query("update billing_events set organization_id = $2, processed_at = now() where id = $1", [event.rows[0].id, organizationId]);
  return { organizationId };
}
