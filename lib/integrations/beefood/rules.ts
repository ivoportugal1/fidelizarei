import type { BeefoodOrder, BeefoodWebhookEvent } from "./types";

export const PAYMENT_EVENTS = ["payment_created", "payment_updated"];
export const IN_STORE_ORDER_TYPES = ["PDV", "TABLE"];

export type OrderDecision =
  | { eligible: true; amount: number }
  | { eligible: false; reason: "not_in_store" | "payment_pending" | "below_minimum" | "invalid_order" };

export function parseWebhookEvent(body: unknown): BeefoodWebhookEvent | null {
  if (!body || typeof body !== "object") return null;
  const { eventType, orderId } = body as Record<string, unknown>;
  if (typeof eventType !== "string" || !eventType) return null;
  if (typeof orderId !== "string" && typeof orderId !== "number") return null;
  const id = String(orderId).trim();
  if (!id) return null;
  return { eventType, orderId: id };
}

export function isPaymentEvent(event: BeefoodWebhookEvent) {
  return PAYMENT_EVENTS.includes(event.eventType);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateOrder(order: BeefoodOrder, minAmount: number): OrderDecision {
  const amount = toNumber(order.total?.orderAmount);
  const pending = toNumber(order.payments?.pending);
  if (amount === null || pending === null) return { eligible: false, reason: "invalid_order" };
  if (!order.orderType || !IN_STORE_ORDER_TYPES.includes(order.orderType)) return { eligible: false, reason: "not_in_store" };
  if (pending !== 0) return { eligible: false, reason: "payment_pending" };
  if (amount < minAmount) return { eligible: false, reason: "below_minimum" };
  return { eligible: true, amount };
}
