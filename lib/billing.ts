import { timingSafeEqual } from "node:crypto";
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
  tax_id: string | null;
  owner_email: string | null;
  subscription_status: BillingStatus | null;
  trial_ends_at: Date | null;
  subscription_current_period_end: Date | null;
  mercado_pago_checkout_url: string | null;
  subscription_billing_interval: BillingInterval | null;
};

type AsaasCustomer = {
  id: string;
};

type AsaasList<T> = {
  data?: T[];
};

type AsaasPayment = {
  id: string;
  status?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  dueDate?: string;
  confirmedDate?: string;
  paymentDate?: string;
};

function appUrl(origin?: string) {
  return process.env.NEXT_PUBLIC_APP_URL || origin || "http://localhost:3000";
}

function asaasToken() {
  const token = process.env.ASAAS_API_KEY;
  if (!token) throw new Error("ASAAS_API_KEY is not configured.");
  return token;
}

function asaasBaseUrl() {
  return process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

function planAmount(interval: BillingInterval) {
  const envName = interval === "yearly" ? "ASAAS_PLAN_YEARLY_AMOUNT" : "ASAAS_PLAN_MONTHLY_AMOUNT";
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

async function asaasRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${asaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `Fidelizarei/1.0 (${process.env.ASAAS_ENV || "sandbox"})`,
      access_token: asaasToken(),
      ...(init?.headers || {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`asaas_request_failed:${response.status}:${body}`);
  return JSON.parse(body) as T;
}

function cleanCpfCnpj(value: string | null) {
  return (value || "").replace(/\D/g, "");
}

function asaasCpfCnpjForCustomer(value: string | null) {
  const cleaned = cleanCpfCnpj(value);
  if (cleaned) return cleaned;
  if (process.env.ASAAS_ENV !== "production") return "11144477735";
  throw new Error("customer_tax_id_required");
}

async function createAsaasCustomer(billing: BillingState & { taxId?: string | null }, userEmail: string) {
  const cpfCnpj = asaasCpfCnpjForCustomer(billing.taxId || null);
  const search = new URLSearchParams();
  search.set("externalReference", billing.organizationId);
  search.set("cpfCnpj", cpfCnpj);
  const existing = await asaasRequest<AsaasList<AsaasCustomer>>(`/customers?${search.toString()}`);
  const customer = existing.data?.[0];
  if (customer?.id) return customer;

  return asaasRequest<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: billing.organizationName,
      email: userEmail,
      cpfCnpj,
      externalReference: billing.organizationId,
    }),
  });
}

function dueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function createAsaasSubscriptionCheckout(userId: string, userEmail: string, origin: string, interval: BillingInterval) {
  const billing = await getBillingStateForUser(userId);
  const row = await getBillingRowForUser(userId);
  if (!row) throw new Error("organization_not_found");
  const baseUrl = appUrl(origin);
  const plan = billingPlans[interval];
  const customer = await createAsaasCustomer({ ...billing, taxId: row.tax_id }, userEmail);

  const payment = await asaasRequest<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType: "UNDEFINED",
      value: planAmount(interval),
      dueDate: dueDate(),
      description: `Fidelizarei - Plano ${plan.label}`,
      externalReference: billing.organizationId,
      callback: {
        successUrl: `${baseUrl}/billing?return=asaas`,
        autoRedirect: true,
      },
    }),
  });

  const checkoutUrl = payment.invoiceUrl || payment.bankSlipUrl || null;
  await query(`
    update organizations
    set mercado_pago_preapproval_id = $2,
        mercado_pago_checkout_url = $3,
        subscription_billing_interval = $4,
        subscription_status = case when subscription_status = 'trialing' and trial_ends_at > now() then subscription_status else 'pending' end,
        subscription_last_synced_at = now()
    where id = $1`, [billing.organizationId, payment.id, checkoutUrl, interval]);

  if (!checkoutUrl) throw new Error("asaas_checkout_url_missing");
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

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function looksLikeUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapAsaasPaymentStatus(status?: string): BillingStatus | null {
  if (status === "CONFIRMED" || status === "RECEIVED" || status === "RECEIVED_IN_CASH") return "active";
  if (status === "PENDING" || status === "AWAITING_RISK_ANALYSIS" || status === "AUTHORIZED") return "pending";
  if (status === "OVERDUE") return "past_due";
  if (status === "REFUNDED" || status === "REFUND_REQUESTED" || status === "CHARGEBACK_REQUESTED" || status === "CHARGEBACK_DISPUTE" || status === "AWAITING_CHARGEBACK_REVERSAL") return "past_due";
  if (status === "DELETED") return "canceled";
  return null;
}

async function applyAsaasPayment(payment: AsaasPayment) {
  const organizationId = String(payment.externalReference || "");
  if (!looksLikeUuid(organizationId)) return null;
  const status = mapAsaasPaymentStatus(payment.status);
  if (!status) return organizationId;
  const paidAt = parseDate(payment.confirmedDate || payment.paymentDate);
  await query(`
    update organizations
    set subscription_status = $2,
        subscription_last_payment_id = $3,
        subscription_current_period_end = case
          when $2 = 'active' and subscription_billing_interval = 'yearly' then coalesce($4, now()) + interval '1 year'
          when $2 = 'active' then coalesce($4, now()) + interval '1 month'
          else subscription_current_period_end
        end,
        access_blocked_at = case when $2 = 'active' then null else coalesce(access_blocked_at, now()) end,
        subscription_last_synced_at = now()
    where id = $1`, [organizationId, status, payment.id, paidAt]);
  return organizationId;
}

export function validateAsaasWebhookToken(request: Request) {
  const secret = process.env.ASAAS_WEBHOOK_SECRET;
  if (!secret) return true;
  const received = request.headers.get("asaas-access-token") || request.headers.get("asaas_access_token") || "";
  return received.length === secret.length && timingSafeEqual(Buffer.from(received), Buffer.from(secret));
}

export async function processAsaasWebhook(request: Request, payload: { id?: string; event?: string; payment?: AsaasPayment }) {
  if (!validateAsaasWebhookToken(request)) throw new Error("invalid_webhook_token");
  const payment = payload.payment;
  if (!payment?.id) return { organizationId: null };

  const event = await query<{ id: string }>(`
    insert into billing_events (provider, provider_event_id, provider_resource_id, event_type, action, payload)
    values ('asaas', $1, $2, $3, $4, $5)
    on conflict (provider, provider_event_id) do update set payload = excluded.payload
    returning id`, [payload.id || `${payload.event}:${payment.id}`, payment.id, payload.event || payment.status || "PAYMENT_UPDATED", null, JSON.stringify(payload)]);

  const organizationId = await applyAsaasPayment(payment);
  await query("update billing_events set organization_id = $2, processed_at = now() where id = $1", [event.rows[0].id, organizationId]);
  return { organizationId };
}
