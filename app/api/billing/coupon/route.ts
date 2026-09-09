import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { applyTrialCouponForUser, type BillingInterval } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { couponCode?: string; interval?: BillingInterval };
  const interval = body.interval === "yearly" ? "yearly" : "monthly";
  const result = await applyTrialCouponForUser(user.id, interval, body.couponCode);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
