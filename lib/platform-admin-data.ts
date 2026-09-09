import { query } from "./database";

export type PlatformCompany = {
  id: string;
  name: string;
  slug: string;
  taxId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  billingStatus: string;
  billingInterval: "monthly" | "yearly";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  lastPaymentId: string | null;
  mercadoPagoPreapprovalId: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  customersCount: number;
  activeCodesCount: number;
  redeemedCodesCount: number;
};

export type PlatformAdminData = {
  totals: {
    companies: number;
    active: number;
    pending: number;
    trialing: number;
    pastDue: number;
    monthly: number;
    yearly: number;
  };
  companies: PlatformCompany[];
};

type PlatformCompanyRow = {
  id: string;
  name: string;
  slug: string;
  tax_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  subscription_status: string | null;
  subscription_billing_interval: "monthly" | "yearly" | null;
  trial_ends_at: Date | null;
  subscription_current_period_end: Date | null;
  subscription_last_payment_id: string | null;
  mercado_pago_preapproval_id: string | null;
  subscription_last_synced_at: Date | null;
  created_at: Date;
  customers_count: string;
  active_codes_count: string;
  redeemed_codes_count: string;
};

export async function getPlatformAdminData(): Promise<PlatformAdminData> {
  const result = await query<PlatformCompanyRow>(`
    select
      o.id,
      o.name,
      o.slug,
      o.tax_id,
      owner.full_name as owner_name,
      owner.email as owner_email,
      o.subscription_status,
      o.subscription_billing_interval,
      o.trial_ends_at,
      o.subscription_current_period_end,
      o.subscription_last_payment_id,
      o.mercado_pago_preapproval_id,
      o.subscription_last_synced_at,
      o.created_at,
      (select count(*) from customers c where c.organization_id = o.id) as customers_count,
      (select count(*) from redemption_codes rc where rc.organization_id = o.id and rc.status = 'active') as active_codes_count,
      (select count(*) from redemption_codes rc where rc.organization_id = o.id and rc.status = 'redeemed') as redeemed_codes_count
    from organizations o
    left join lateral (
      select u.full_name, u.email
      from organization_members m
      join app_users u on u.id = m.user_id
      where m.organization_id = o.id
      order by case when m.role = 'owner' then 0 else 1 end, u.created_at asc
      limit 1
    ) owner on true
    where o.slug <> 'fidelizarei'
    order by o.created_at desc
    limit 200
  `);

  const companies = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    taxId: row.tax_id,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    billingStatus: row.subscription_status || "pending",
    billingInterval: row.subscription_billing_interval || "monthly",
    trialEndsAt: row.trial_ends_at?.toISOString() ?? null,
    currentPeriodEnd: row.subscription_current_period_end?.toISOString() ?? null,
    lastPaymentId: row.subscription_last_payment_id,
    mercadoPagoPreapprovalId: row.mercado_pago_preapproval_id,
    lastSyncedAt: row.subscription_last_synced_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    customersCount: Number(row.customers_count),
    activeCodesCount: Number(row.active_codes_count),
    redeemedCodesCount: Number(row.redeemed_codes_count),
  }));

  return {
    companies,
    totals: {
      companies: companies.length,
      active: companies.filter((company) => company.billingStatus === "active").length,
      pending: companies.filter((company) => company.billingStatus === "pending").length,
      trialing: companies.filter((company) => company.billingStatus === "trialing").length,
      pastDue: companies.filter((company) => company.billingStatus === "past_due").length,
      monthly: companies.filter((company) => company.billingInterval === "monthly").length,
      yearly: companies.filter((company) => company.billingInterval === "yearly").length,
    },
  };
}
