import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAsaasSubscriptionCheckout, type BillingInterval } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { interval?: BillingInterval };
    const interval = body.interval === "yearly" ? "yearly" : "monthly";
    const checkoutUrl = await createAsaasSubscriptionCheckout(user.id, user.email, new URL(request.url).origin, interval);
    return NextResponse.json({ ok: true, checkoutUrl });
  } catch (error) {
    console.error("asaas_checkout_error", error);
    return NextResponse.json({ ok: false, error: "checkout_failed" }, { status: 500 });
  }
}
