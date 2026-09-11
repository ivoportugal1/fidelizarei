import { NextResponse } from "next/server";
import { processAsaasWebhook } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown = {};
  try {
    payload = await request.json();
    await processAsaasWebhook(request, payload as Parameters<typeof processAsaasWebhook>[1]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("asaas_webhook_error", error, payload);
    const message = error instanceof Error ? error.message : "webhook_failed";
    return NextResponse.json(
      { ok: false, error: message === "invalid_webhook_token" ? message : "webhook_failed" },
      { status: message === "invalid_webhook_token" ? 401 : 500 },
    );
  }
}
