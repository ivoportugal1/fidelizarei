import { createHash } from "node:crypto";

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export type FirstPurchaseInvoice = {
  id: string;
  amount_paid?: number | null;
  billing_reason?: string | null;
  currency?: string | null;
  paid?: boolean | null;
  status?: string | null;
  status_transitions?: { paid_at?: number | null } | null;
  livemode?: boolean | null;
};

export function isFirstPaidSubscriptionInvoice(invoice: FirstPurchaseInvoice) {
  return invoice.billing_reason === "subscription_create"
    && invoice.paid === true
    && invoice.status === "paid"
    && Number.isInteger(invoice.amount_paid)
    && Number(invoice.amount_paid) > 0
    && typeof invoice.currency === "string"
    && invoice.currency.length === 3;
}

export function stripeAmountToMajor(amountMinor: number, currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase();
  const divisor = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 1 : 100;
  return amountMinor / divisor;
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizedEmailHash(email: string) {
  return sha256(email.trim().toLowerCase());
}

export function buildMetaPurchaseEvent(input: {
  invoice: FirstPurchaseInvoice;
  organizationId: string;
  email: string;
  eventSourceUrl: string;
  fallbackEventTime: number;
}) {
  const amountMinor = Number(input.invoice.amount_paid);
  const currency = String(input.invoice.currency).toUpperCase();
  const eventTime = input.invoice.status_transitions?.paid_at || input.fallbackEventTime;

  return {
    event_name: "Purchase",
    event_time: eventTime,
    event_id: `stripe_invoice_${input.invoice.id}`,
    action_source: "website",
    event_source_url: input.eventSourceUrl,
    user_data: {
      em: [normalizedEmailHash(input.email)],
      external_id: [sha256(input.organizationId)],
    },
    custom_data: {
      currency,
      value: stripeAmountToMajor(amountMinor, currency),
      order_id: input.invoice.id,
      content_type: "product",
      content_name: "Assinatura Fidelizarei",
    },
  };
}
