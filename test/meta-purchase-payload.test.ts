import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetaPurchaseEvent,
  isFirstPaidSubscriptionInvoice,
  normalizedEmailHash,
  stripeAmountToMajor,
} from "../lib/meta-purchase-payload.ts";

test("accepts only a genuinely paid first subscription invoice", () => {
  const paid = { id: "in_first", billing_reason: "subscription_create", paid: true, status: "paid", amount_paid: 6000, currency: "brl" };
  assert.equal(isFirstPaidSubscriptionInvoice(paid), true);
  assert.equal(isFirstPaidSubscriptionInvoice({ ...paid, billing_reason: "subscription_cycle" }), false);
  assert.equal(isFirstPaidSubscriptionInvoice({ ...paid, paid: false }), false);
  assert.equal(isFirstPaidSubscriptionInvoice({ ...paid, status: "open" }), false);
  assert.equal(isFirstPaidSubscriptionInvoice({ ...paid, amount_paid: 0 }), false);
});

test("uses Stripe's amount and currency without hard-coded plan values", () => {
  assert.equal(stripeAmountToMajor(6000, "BRL"), 60);
  assert.equal(stripeAmountToMajor(60000, "BRL"), 600);
  assert.equal(stripeAmountToMajor(500, "JPY"), 500);
});

test("builds a stable deduplication id and hashes customer identifiers", () => {
  const event = buildMetaPurchaseEvent({
    invoice: {
      id: "in_first",
      billing_reason: "subscription_create",
      paid: true,
      status: "paid",
      amount_paid: 6000,
      currency: "brl",
      status_transitions: { paid_at: 1_800_000_000 },
    },
    organizationId: "org-123",
    email: " Cliente@Example.com ",
    eventSourceUrl: "https://www.fidelizarei.com.br/billing",
    fallbackEventTime: 1_700_000_000,
  });

  assert.equal(event.event_name, "Purchase");
  assert.equal(event.event_id, "stripe_invoice_in_first");
  assert.equal(event.event_time, 1_800_000_000);
  assert.equal(event.custom_data.value, 60);
  assert.equal(event.custom_data.currency, "BRL");
  assert.equal(event.user_data.em[0], normalizedEmailHash("cliente@example.com"));
  assert.notEqual(event.user_data.em[0], "cliente@example.com");
});
