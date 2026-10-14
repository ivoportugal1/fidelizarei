import { NextResponse } from "next/server";
import { processBeefoodWebhook } from "@/lib/integrations/beefood/process-event";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => null);
    const result = await processBeefoodWebhook(token, request.headers.get("x-webhook-secret"), body);
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    // A 5xx makes BeeFood retry; the unique order key keeps retries harmless.
    return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
  }
}
