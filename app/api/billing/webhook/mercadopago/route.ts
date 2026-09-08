import { NextResponse } from "next/server";
import { processMercadoPagoWebhook } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: { id?: string | number; type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    payload = await request.json();
    await processMercadoPagoWebhook(request, payload, new URL(request.url));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("mercadopago_webhook_error", error, payload);
    const message = error instanceof Error ? error.message : "webhook_failed";
    return NextResponse.json({ ok: false, error: message === "invalid_webhook_signature" ? message : "webhook_failed" }, { status: message === "invalid_webhook_signature" ? 401 : 500 });
  }
}
