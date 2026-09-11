import { NextResponse } from "next/server";
import { processStripeWebhook } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await processStripeWebhook(request);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("stripe_webhook_error", error);
    const message = error instanceof Error ? error.message : "webhook_failed";
    const status = message.includes("signature") || message.includes("STRIPE_WEBHOOK_SECRET") ? 401 : 500;
    return NextResponse.json({ ok: false, error: status === 401 ? message : "webhook_failed" }, { status });
  }
}
