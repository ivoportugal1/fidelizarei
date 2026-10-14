import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOrder, isPaymentEvent, parseWebhookEvent } from "../lib/integrations/beefood/rules.ts";

const paid = { orderType: "PDV", total: { orderAmount: 50 }, payments: { pending: 0 } };

test("paid in-store order above the minimum earns a point", () => {
  assert.deepEqual(evaluateOrder(paid, 20), { eligible: true, amount: 50 });
  assert.deepEqual(evaluateOrder({ ...paid, orderType: "TABLE" }, 50), { eligible: true, amount: 50 });
});

test("order below the minimum is ignored", () => {
  assert.deepEqual(evaluateOrder(paid, 60), { eligible: false, reason: "below_minimum" });
});

test("delivery orders are ignored", () => {
  assert.deepEqual(evaluateOrder({ ...paid, orderType: "DELIVERY" }, 0), { eligible: false, reason: "not_in_store" });
});

test("orders with pending payment are ignored", () => {
  assert.deepEqual(evaluateOrder({ ...paid, payments: { pending: 12.5 } }, 0), { eligible: false, reason: "payment_pending" });
});

test("incomplete orders are rejected instead of guessed", () => {
  assert.deepEqual(evaluateOrder({ orderType: "PDV" }, 0), { eligible: false, reason: "invalid_order" });
});

test("only payment events are processed and payloads are validated", () => {
  const event = parseWebhookEvent({ eventType: "payment_created", orderId: 123 });
  assert.deepEqual(event, { eventType: "payment_created", orderId: "123" });
  assert.equal(isPaymentEvent(event!), true);
  assert.equal(isPaymentEvent({ eventType: "order_created", orderId: "1" }), false);
  assert.equal(parseWebhookEvent({ eventType: "payment_created" }), null);
  assert.equal(parseWebhookEvent("nope"), null);
});
